import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AuthSessionResponse } from '@finance/contracts';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { EnvConfig } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { type SessionUser, toUserProfile, UsersService } from '../users/users.service';
import type { LoginDto, RegisterDto } from './auth.dto';
import {
  CSRF_TOKEN_BYTES,
  INVALID_CREDENTIALS_MESSAGE,
  INVALID_SESSION_MESSAGE,
  REFRESH_TOKEN_BYTES,
} from './constants';

/**
 * What the controller needs to answer a session request: the JSON body plus the
 * two values that only ever travel as cookies.
 */
export interface IssuedSession {
  session: AuthSessionResponse;
  refreshToken: string;
  csrfToken: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * A refresh token is `<userId>.<base64url(32 random bytes)>`.
 *
 * The random half is the whole secret; the id prefix is public and is never
 * trusted for authentication (the row lookup is by hash of the *full* string).
 * It exists solely so reuse detection can name the family to revoke after the
 * row it pointed at has already been deleted by rotation. A uuid contains no
 * `.`, so splitting on the first one is unambiguous.
 */
export function generateRefreshToken(userId: string): { token: string; tokenHash: string } {
  const token = `${userId}.${randomBytes(REFRESH_TOKEN_BYTES).toString('base64url')}`;
  return { token, tokenHash: sha256(token) };
}

export function parseRefreshToken(raw: string | undefined | null): { userId: string; tokenHash: string } | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const separator = raw.indexOf('.');
  if (separator <= 0 || separator === raw.length - 1) return null;
  const userId = raw.slice(0, separator);
  if (!UUID_PATTERN.test(userId)) return null;
  return { userId, tokenHash: sha256(raw) };
}

@Injectable()
export class AuthService {
  /**
   * Lazily built argon2 hash of a value nobody knows, verified against when the
   * e-mail is unknown so a login for a non-existent account costs the same
   * wall-clock time as one for a real account. Built once per process.
   */
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  // -------------------------------------------------------------------------
  // Entry points
  // -------------------------------------------------------------------------

  async register(dto: RegisterDto): Promise<IssuedSession> {
    // The password policy already ran in the DTO; a duplicate e-mail surfaces
    // from the unique index as a 409, not from a racy check-then-insert.
    const user = await this.users.createUser({
      email: dto.email,
      password: dto.password,
      name: dto.name ?? null,
    });
    return this.issueSession(user);
  }

  /**
   * Both failure modes — unknown e-mail and wrong password — produce the exact
   * same 401 body and (thanks to the dummy verify) the same latency, so the
   * endpoint cannot be used to enumerate registered accounts.
   */
  async login(dto: LoginDto): Promise<IssuedSession> {
    const user = await this.users.findByEmailWithPassword(dto.email);

    if (!user) {
      await this.burnPasswordVerifyTime(dto.password);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    let matches = false;
    try {
      matches = await argon2.verify(user.passwordHash, dto.password);
    } catch {
      matches = false;
    }
    if (!matches) throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);

    const { passwordHash: _passwordHash, ...sessionUser } = user;
    return this.issueSession(sessionUser);
  }

  /**
   * Rotates the presented refresh token.
   *
   * A token that matches no row was either forged or already rotated. Both mean
   * somebody is replaying a cookie, so the entire family for that user is
   * deleted before answering with the generic 401.
   */
  async refresh(rawToken: string | undefined): Promise<IssuedSession> {
    const parsed = parseRefreshToken(rawToken);
    if (!parsed) throw new UnauthorizedException(INVALID_SESSION_MESSAGE);

    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: parsed.tokenHash },
    });

    if (!row || row.userId !== parsed.userId || row.revokedAt !== null) {
      await this.revokeFamily(parsed.userId);
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    if (row.expiresAt.getTime() <= Date.now()) {
      // Plain expiry is not an attack; drop this row only.
      await this.prisma.refreshToken.deleteMany({ where: { id: row.id } });
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    const user = await this.users.findSessionUser(row.userId);
    if (!user) {
      await this.revokeFamily(parsed.userId);
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    return this.issueSession(user, row.id);
  }

  /**
   * Idempotent. Scoped to the authenticated user so a stolen cookie cannot be
   * used to log somebody else out, and `deleteMany` means a second call (or a
   * call with no cookie at all) is a no-op rather than a `P2025`.
   */
  async logout(userId: string, rawToken: string | undefined): Promise<void> {
    const parsed = parseRefreshToken(rawToken);
    if (!parsed) return;
    await this.prisma.refreshToken.deleteMany({
      where: { userId, tokenHash: parsed.tokenHash },
    });
  }

  // -------------------------------------------------------------------------
  // Session minting
  // -------------------------------------------------------------------------

  /**
   * Signs an access token and persists a fresh refresh row. When `rotatesRowId`
   * is given, deleting the old row and inserting the new one happen in one
   * transaction, so a crash can never leave two live tokens for one session.
   */
  private async issueSession(user: SessionUser, rotatesRowId?: string): Promise<IssuedSession> {
    const accessTtl = this.config.get('ACCESS_TOKEN_TTL_SECONDS', { infer: true });
    const refreshTtl = this.config.get('REFRESH_TOKEN_TTL_SECONDS', { infer: true });

    const { token, tokenHash } = generateRefreshToken(user.id);
    const expiresAt = new Date(Date.now() + refreshTtl * 1000);
    const created = { data: { userId: user.id, tokenHash, expiresAt } };

    if (rotatesRowId) {
      await this.prisma.$transaction([
        this.prisma.refreshToken.deleteMany({ where: { id: rotatesRowId } }),
        this.prisma.refreshToken.create(created),
      ]);
    } else {
      await this.prisma.refreshToken.create(created);
    }

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, tokenVersion: user.tokenVersion },
      {
        secret: this.config.get('JWT_SECRET', { infer: true }),
        expiresIn: accessTtl,
      },
    );

    return {
      session: { accessToken, expiresIn: accessTtl, user: toUserProfile(user) },
      refreshToken: token,
      csrfToken: randomBytes(CSRF_TOKEN_BYTES).toString('base64url'),
    };
  }

  private async revokeFamily(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  /** Spends the same argon2 budget as a real verify, then discards the result. */
  private async burnPasswordVerifyTime(candidate: string): Promise<void> {
    try {
      this.dummyHash ??= argon2.hash(randomUUID());
      await argon2.verify(await this.dummyHash, candidate);
    } catch {
      // A failed dummy verify is the expected outcome and is never surfaced.
    }
  }
}
