import type { UserProfile } from '@finance/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { ACCOUNT_DELETION_CONFIRMATION, normalizeEmail } from '../auth/constants';
import { passwordPolicyViolation } from '../auth/password-policy';
import { PrismaService } from '../prisma/prisma.service';
import type { ChangePasswordDto, DeleteAccountDto, UpdateProfileDto } from './users.dto';

/**
 * The columns a user is allowed to leave the process in. `passwordHash` is
 * absent from every select in this file except the three places that verify a
 * password, and those never return it to a caller.
 */
const PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** `PROFILE_SELECT` plus the revocation counter the session layer needs. */
const SESSION_SELECT = { ...PROFILE_SELECT, tokenVersion: true } as const;

type ProfileRow = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SessionUser = ProfileRow & { tokenVersion: number };

/** The only place a database row becomes a wire-visible user. */
export function toUserProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function isUniqueEmailViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'P2002';
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  /**
   * The profile behind `GET /users/me` and `GET /auth/me`.
   *
   * A valid access token for a user that no longer exists (deleted account,
   * restored-from-backup database) is a 404, not a `200 null`: the client can
   * then drop the session instead of rendering an empty screen.
   */
  async findProfile(userId: string): Promise<UserProfile> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PROFILE_SELECT,
    });
    if (!row) throw new NotFoundException('Usuário não encontrado.');
    return toUserProfile(row);
  }

  /** Profile + `tokenVersion`, for minting a session. Never includes the hash. */
  async findSessionUser(userId: string): Promise<SessionUser | null> {
    return this.prisma.user.findUnique({ where: { id: userId }, select: SESSION_SELECT });
  }

  /**
   * Single-column primary-key lookup used by `AuthGuard` on every authenticated
   * request. Returns `null` when the user is gone, which the guard treats as an
   * invalid session.
   */
  async findTokenVersion(userId: string): Promise<number | null> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tokenVersion: true },
    });
    return row?.tokenVersion ?? null;
  }

  /**
   * The one read that returns `passwordHash`. Only `AuthService.login` calls it,
   * and it strips the hash before anything is returned to a controller.
   */
  async findByEmailWithPassword(email: string): Promise<(SessionUser & { passwordHash: string }) | null> {
    return this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: { ...SESSION_SELECT, passwordHash: true },
    });
  }

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  /**
   * Creates a user and returns the session-shaped row (no hash). The uniqueness
   * race is resolved by the database, not by a check-then-insert: `P2002`
   * becomes a clean 409.
   */
  async createUser(input: { email: string; password: string; name?: string | null }): Promise<SessionUser> {
    const passwordHash = await argon2.hash(input.password);
    try {
      return await this.prisma.user.create({
        data: {
          email: normalizeEmail(input.email),
          passwordHash,
          name: input.name ?? null,
        },
        select: SESSION_SELECT,
      });
    } catch (error) {
      if (isUniqueEmailViolation(error)) {
        throw new ConflictException('Este e-mail já está em uso.');
      }
      throw error;
    }
  }

  /**
   * `PATCH /users/me`. Only `name` and `email` are writable, and only through
   * this explicit mapping — a raw `Prisma.UserUpdateInput` from the body would
   * let a caller set `passwordHash` or `tokenVersion` directly.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfile> {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { ...PROFILE_SELECT, passwordHash: true },
    });
    if (!current) throw new NotFoundException('Usuário não encontrado.');

    // Compute the final state first, then validate the invariants against it.
    const data: { name?: string | null; email?: string } = {};

    if (dto.name !== undefined) {
      data.name = dto.name === null || dto.name === '' ? null : dto.name;
    }

    if (dto.email !== undefined) {
      const nextEmail = normalizeEmail(dto.email);
      if (nextEmail !== current.email) {
        // Changing the e-mail moves where a future password reset lands, so it
        // is treated as a credential change and re-authenticated.
        if (!dto.currentPassword) {
          throw new BadRequestException('Informe a senha atual para alterar o e-mail.');
        }
        await this.assertPasswordMatches(current.passwordHash, dto.currentPassword);
        data.email = nextEmail;
      }
    }

    if (Object.keys(data).length === 0) return toUserProfile(current);

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data,
        select: PROFILE_SELECT,
      });
      return toUserProfile(updated);
    } catch (error) {
      if (isUniqueEmailViolation(error)) {
        throw new ConflictException('Este e-mail já está em uso.');
      }
      throw error;
    }
  }

  /**
   * `PATCH /users/me/password`. Bumping `tokenVersion` kills every outstanding
   * access token; deleting the refresh rows kills every outstanding session.
   * Both happen in one transaction so a partial revocation is impossible.
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!current) throw new NotFoundException('Usuário não encontrado.');

    await this.assertPasswordMatches(current.passwordHash, dto.currentPassword);

    // The DTO already enforced this; re-checked here so the policy holds even
    // if this service is ever called from outside the HTTP pipeline.
    const violation = passwordPolicyViolation(dto.newPassword);
    if (violation) throw new BadRequestException(violation);

    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException('A nova senha deve ser diferente da senha atual.');
    }

    const passwordHash = await argon2.hash(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash, tokenVersion: { increment: 1 } },
        select: { id: true },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);
  }

  /**
   * `DELETE /users/me`. Returns nothing — the previous implementation returned
   * the deleted row, which included `passwordHash`.
   */
  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    // Checked here as well as in the DTO: an irreversible operation should not
    // depend on a single layer of validation staying configured correctly.
    if (dto.confirmation !== ACCOUNT_DELETION_CONFIRMATION) {
      throw new BadRequestException(`Digite exatamente "${ACCOUNT_DELETION_CONFIRMATION}" para confirmar.`);
    }

    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!current) throw new NotFoundException('Usuário não encontrado.');

    await this.assertPasswordMatches(current.passwordHash, dto.password);

    // Every `*.user_id` foreign key is `ON DELETE CASCADE`, so this one
    // statement removes the entire dataset described in the controller docs.
    await this.prisma.user.delete({ where: { id: userId }, select: { id: true } });
  }

  /**
   * Verifies a password and throws the same 401 whether argon2 says "no" or
   * throws on a malformed stored hash — the caller never learns which.
   */
  private async assertPasswordMatches(passwordHash: string, candidate: string): Promise<void> {
    let matches = false;
    try {
      matches = await argon2.verify(passwordHash, candidate);
    } catch {
      matches = false;
    }
    if (!matches) throw new UnauthorizedException('Senha atual incorreta.');
  }
}
