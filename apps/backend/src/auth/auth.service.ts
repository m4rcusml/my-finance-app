import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AuthSessionResponse } from '@finance/contracts';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
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
  REFRESH_CONCURRENCY_WINDOW_MS,
  REFRESH_CONFLICT_MESSAGE,
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

interface LockedRefreshToken {
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  rotatedAt: Date | null;
  successorTokenId: string | null;
}

type RefreshOutcome =
  | { kind: 'issued'; refreshToken: string; user: SessionUser }
  | { kind: 'concurrent' }
  | { kind: 'invalid' };

const OPAQUE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Creates a 256-bit value that carries no user or family metadata. */
export function generateRefreshToken(): { token: string; tokenHash: string } {
  const token = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  return { token, tokenHash: sha256(token) };
}

/** Hash only syntactically valid values, keeping garbage away from the store. */
export function hashRefreshToken(raw: string | undefined | null): string | null {
  if (typeof raw !== 'string' || !OPAQUE_TOKEN_PATTERN.test(raw)) return null;
  return sha256(raw);
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
   * Atomically claims and rotates one refresh token.
   *
   * The raw value contains no identity. Only a successful hash lookup can name
   * a family, so an arbitrary forged cookie is a side-effect-free 401. A row is
   * locked before inspection: a concurrent waiter observes the committed
   * tombstone and cannot mint a second successor.
   */
  async refresh(rawToken: string | undefined): Promise<IssuedSession> {
    const tokenHash = hashRefreshToken(rawToken);
    if (!tokenHash) throw new UnauthorizedException(INVALID_SESSION_MESSAGE);

    const outcome = await this.prisma.$transaction(async (tx): Promise<RefreshOutcome> => {
      const rows = await tx.$queryRaw<LockedRefreshToken[]>`
        SELECT
          "id",
          "user_id" AS "userId",
          "family_id" AS "familyId",
          "expires_at" AS "expiresAt",
          "revoked_at" AS "revokedAt",
          "rotated_at" AS "rotatedAt",
          "successor_token_id" AS "successorTokenId"
        FROM "refresh_tokens"
        WHERE "token_hash" = ${tokenHash}
        FOR UPDATE
      `;
      const row = rows[0];
      if (!row) return { kind: 'invalid' };

      const now = new Date();
      if (row.expiresAt.getTime() <= now.getTime()) {
        // Tombstones only need to survive until expiry.
        await tx.refreshToken.deleteMany({ where: { id: row.id } });
        return { kind: 'invalid' };
      }

      if (row.revokedAt) {
        const isConcurrent =
          row.rotatedAt !== null &&
          row.successorTokenId !== null &&
          now.getTime() - row.rotatedAt.getTime() <= REFRESH_CONCURRENCY_WINDOW_MS;

        if (isConcurrent) return { kind: 'concurrent' };

        // Known replay outside the response race: revoke this session family,
        // never all sessions belonging to the user.
        await tx.refreshToken.updateMany({
          where: { familyId: row.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return { kind: 'invalid' };
      }

      const user = await tx.user.findUnique({
        where: { id: row.userId },
        select: {
          id: true,
          email: true,
          name: true,
          tokenVersion: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!user) {
        await tx.refreshToken.updateMany({
          where: { familyId: row.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return { kind: 'invalid' };
      }

      const next = generateRefreshToken();
      const nextId = randomUUID();
      const expiresAt = new Date(now.getTime() + this.refreshTtlSeconds() * 1000);

      await tx.refreshToken.create({
        data: {
          id: nextId,
          userId: row.userId,
          familyId: row.familyId,
          tokenHash: next.tokenHash,
          expiresAt,
        },
      });
      await tx.refreshToken.update({
        where: { id: row.id },
        data: {
          revokedAt: now,
          rotatedAt: now,
          successorTokenId: nextId,
        },
      });

      return { kind: 'issued', refreshToken: next.token, user };
    });

    if (outcome.kind === 'concurrent') throw new ConflictException(REFRESH_CONFLICT_MESSAGE);
    if (outcome.kind === 'invalid') throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    return this.finishSession(outcome.user, outcome.refreshToken);
  }

  /**
   * Idempotent. Scoped to the authenticated user so a stolen cookie cannot be
   * used to log somebody else out, and `deleteMany` means a second call (or a
   * call with no cookie at all) is a no-op rather than a `P2025`.
   */
  async logout(userId: string, rawToken: string | undefined): Promise<void> {
    const tokenHash = hashRefreshToken(rawToken);
    if (!tokenHash) return;
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // -------------------------------------------------------------------------
  // Session minting
  // -------------------------------------------------------------------------

  /** A login/register starts an independent family, so logout remains local. */
  private async issueSession(user: SessionUser): Promise<IssuedSession> {
    const refresh = generateRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId: randomUUID(),
        tokenHash: refresh.tokenHash,
        expiresAt: new Date(Date.now() + this.refreshTtlSeconds() * 1000),
      },
    });
    return this.finishSession(user, refresh.token);
  }

  private async finishSession(user: SessionUser, refreshToken: string): Promise<IssuedSession> {
    const accessTtl = this.config.get('ACCESS_TOKEN_TTL_SECONDS', { infer: true });
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, tokenVersion: user.tokenVersion },
      {
        secret: this.config.get('JWT_SECRET', { infer: true }),
        expiresIn: accessTtl,
      },
    );

    return {
      session: { accessToken, expiresIn: accessTtl, user: toUserProfile(user) },
      refreshToken,
      csrfToken: randomBytes(CSRF_TOKEN_BYTES).toString('base64url'),
    };
  }

  private refreshTtlSeconds(): number {
    return this.config.get('REFRESH_TOKEN_TTL_SECONDS', { infer: true });
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
