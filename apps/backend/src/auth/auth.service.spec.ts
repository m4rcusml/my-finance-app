import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import type { LoginDto, RegisterDto } from './auth.dto';
import { AuthService, generateRefreshToken, parseRefreshToken } from './auth.service';
import { CSRF_COOKIE_NAME, INVALID_CREDENTIALS_MESSAGE, INVALID_SESSION_MESSAGE } from './constants';
import { assertDoubleSubmitCsrf } from './cookies';

jest.mock('argon2');

const USER_ID = '11111111-2222-4333-8444-555555555555';

const sessionUser = {
  id: USER_ID,
  email: 'maria@exemplo.com.br',
  name: 'Maria',
  tokenVersion: 3,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

const storedUser = { ...sessionUser, passwordHash: '$argon2id$stored' };

type PrismaMock = {
  refreshToken: {
    findUnique: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

function createPrismaMock(): PrismaMock {
  const mock: PrismaMock = {
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'new-row' }),
      delete: jest.fn().mockResolvedValue({ id: 'old-row' }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn(),
  };
  mock.$transaction.mockImplementation(async (ops: unknown) =>
    Array.isArray(ops) ? Promise.all(ops) : (ops as (tx: PrismaMock) => unknown)(mock),
  );
  return mock;
}

const ENV: Record<string, unknown> = {
  JWT_SECRET: 'a'.repeat(48),
  ACCESS_TOKEN_TTL_SECONDS: 900,
  REFRESH_TOKEN_TTL_SECONDS: 2_592_000,
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaMock;
  let users: jest.Mocked<Pick<UsersService, 'findByEmailWithPassword' | 'findSessionUser' | 'createUser'>>;
  let jwt: { signAsync: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    jwt = { signAsync: jest.fn().mockResolvedValue('signed.access.token') };
    users = {
      findByEmailWithPassword: jest.fn(),
      findSessionUser: jest.fn(),
      createUser: jest.fn(),
    } as unknown as jest.Mocked<Pick<UsersService, 'findByEmailWithPassword' | 'findSessionUser' | 'createUser'>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: users },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: { get: (key: string) => ENV[key] } },
      ],
    }).compile();

    service = module.get(AuthService);
    (argon2.hash as jest.Mock).mockResolvedValue('$argon2id$fresh');
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------

  describe('opaque refresh tokens', () => {
    it('binds the token to a user without storing the raw value', () => {
      const { token, tokenHash } = generateRefreshToken(USER_ID);

      expect(token.startsWith(`${USER_ID}.`)).toBe(true);
      expect(tokenHash).toHaveLength(64);
      expect(tokenHash).not.toContain(token);
      expect(parseRefreshToken(token)).toEqual({ userId: USER_ID, tokenHash });
    });

    it('rejects malformed cookie values instead of guessing', () => {
      expect(parseRefreshToken(undefined)).toBeNull();
      expect(parseRefreshToken('')).toBeNull();
      expect(parseRefreshToken('no-separator')).toBeNull();
      expect(parseRefreshToken('not-a-uuid.secret')).toBeNull();
      expect(parseRefreshToken(`${USER_ID}.`)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------

  describe('login', () => {
    const dto: LoginDto = { email: 'maria@exemplo.com.br', password: 'uma-senha-bem-longa' };

    it('issues a session and never exposes the password hash', async () => {
      users.findByEmailWithPassword.mockResolvedValue(storedUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const issued = await service.login(dto);

      expect(issued.session.accessToken).toBe('signed.access.token');
      expect(issued.session.expiresIn).toBe(900);
      expect(issued.session.user).toEqual({
        id: USER_ID,
        email: 'maria@exemplo.com.br',
        name: 'Maria',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      });
      expect(JSON.stringify(issued)).not.toContain('passwordHash');
      expect(JSON.stringify(issued)).not.toContain('$argon2id$stored');
      // tokenVersion travels in the JWT so the guard can revoke on password change.
      expect(jwt.signAsync).toHaveBeenCalledWith(
        { sub: USER_ID, email: 'maria@exemplo.com.br', tokenVersion: 3 },
        expect.objectContaining({ expiresIn: 900 }),
      );
    });

    it('persists only the SHA-256 of the refresh token', async () => {
      users.findByEmailWithPassword.mockResolvedValue(storedUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const issued = await service.login(dto);

      const created = prisma.refreshToken.create.mock.calls[0][0] as {
        data: { userId: string; tokenHash: string; expiresAt: Date };
      };
      expect(created.data.userId).toBe(USER_ID);
      expect(created.data.tokenHash).toHaveLength(64);
      expect(created.data.tokenHash).not.toBe(issued.refreshToken);
      expect(created.data.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('answers an unknown e-mail with the SAME generic 401 as a wrong password', async () => {
      users.findByEmailWithPassword.mockResolvedValue(null);
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      const unknown = await service.login(dto).catch((error: unknown) => error);

      users.findByEmailWithPassword.mockResolvedValue(storedUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      const wrongPassword = await service.login(dto).catch((error: unknown) => error);

      expect(unknown).toBeInstanceOf(UnauthorizedException);
      expect(wrongPassword).toBeInstanceOf(UnauthorizedException);
      expect((unknown as UnauthorizedException).message).toBe(INVALID_CREDENTIALS_MESSAGE);
      expect((wrongPassword as UnauthorizedException).message).toBe(INVALID_CREDENTIALS_MESSAGE);
      // Not a 404 — a 404 here would confirm which e-mails are registered.
      expect((unknown as UnauthorizedException).getStatus()).toBe(401);
      expect((wrongPassword as UnauthorizedException).getStatus()).toBe(401);
    });

    it('burns an argon2 verify when the e-mail is unknown so timing does not leak', async () => {
      users.findByEmailWithPassword.mockResolvedValue(null);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);

      expect(argon2.hash).toHaveBeenCalled();
      expect(argon2.verify).toHaveBeenCalledTimes(1);
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('treats a corrupt stored hash as a failed login, not a 500', async () => {
      users.findByEmailWithPassword.mockResolvedValue({ ...storedUser, passwordHash: 'garbage' });
      (argon2.verify as jest.Mock).mockRejectedValue(new Error('pchstr'));

      await expect(service.login(dto)).rejects.toThrow(INVALID_CREDENTIALS_MESSAGE);
    });
  });

  // -------------------------------------------------------------------------

  describe('register', () => {
    it('creates the user and opens a session in one go', async () => {
      const dto: RegisterDto = {
        email: 'nova@exemplo.com.br',
        password: 'uma-senha-bem-longa',
        name: 'Nova',
      };
      users.createUser.mockResolvedValue({ ...sessionUser, email: dto.email, name: 'Nova' });

      const issued = await service.register(dto);

      expect(users.createUser).toHaveBeenCalledWith({
        email: 'nova@exemplo.com.br',
        password: 'uma-senha-bem-longa',
        name: 'Nova',
      });
      expect(issued.session.user.email).toBe('nova@exemplo.com.br');
      expect(issued.refreshToken.startsWith(`${USER_ID}.`)).toBe(true);
      expect(issued.csrfToken.length).toBeGreaterThan(20);
      expect(JSON.stringify(issued)).not.toContain('passwordHash');
    });
  });

  // -------------------------------------------------------------------------

  describe('refresh', () => {
    const live = {
      id: 'row-1',
      userId: USER_ID,
      tokenHash: 'ignored',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    };

    it('rotates: the presented row is deleted and a new one created in one transaction', async () => {
      const { token } = generateRefreshToken(USER_ID);
      prisma.refreshToken.findUnique.mockResolvedValue(live);
      users.findSessionUser.mockResolvedValue(sessionUser);

      const issued = await service.refresh(token);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { id: 'row-1' } });
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      // A brand new opaque value, not the one that was presented.
      expect(issued.refreshToken).not.toBe(token);
      // ... and a brand new CSRF token, rotated in lockstep.
      expect(issued.csrfToken).toBeTruthy();
    });

    it('detects reuse: a token that matches no row revokes the whole family', async () => {
      const { token } = generateRefreshToken(USER_ID);
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh(token)).rejects.toThrow(INVALID_SESSION_MESSAGE);

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('treats a rotated-then-replayed token as reuse', async () => {
      const { token } = generateRefreshToken(USER_ID);
      // First call rotates it away...
      prisma.refreshToken.findUnique.mockResolvedValueOnce(live);
      users.findSessionUser.mockResolvedValue(sessionUser);
      await service.refresh(token);

      // ... the second presentation of the same cookie finds nothing.
      prisma.refreshToken.findUnique.mockResolvedValueOnce(null);
      await expect(service.refresh(token)).rejects.toThrow(UnauthorizedException);

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    });

    it('revokes the family when the row was explicitly revoked', async () => {
      const { token } = generateRefreshToken(USER_ID);
      prisma.refreshToken.findUnique.mockResolvedValue({ ...live, revokedAt: new Date() });

      await expect(service.refresh(token)).rejects.toThrow(UnauthorizedException);

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    });

    it('drops only the expired row — expiry is not an attack', async () => {
      const { token } = generateRefreshToken(USER_ID);
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...live,
        expiresAt: new Date(Date.now() - 1_000),
      });

      await expect(service.refresh(token)).rejects.toThrow(INVALID_SESSION_MESSAGE);

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { id: 'row-1' } });
      expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
    });

    it('rejects a row whose user id does not match the token prefix', async () => {
      const { token } = generateRefreshToken(USER_ID);
      prisma.refreshToken.findUnique.mockResolvedValue({ ...live, userId: 'someone-else' });

      await expect(service.refresh(token)).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('rejects a missing or malformed cookie without touching the database', async () => {
      await expect(service.refresh(undefined)).rejects.toThrow(INVALID_SESSION_MESSAGE);
      await expect(service.refresh('garbage')).rejects.toThrow(INVALID_SESSION_MESSAGE);

      expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
      expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled();
    });

    it('fails closed when the user behind a live token is gone', async () => {
      const { token } = generateRefreshToken(USER_ID);
      prisma.refreshToken.findUnique.mockResolvedValue(live);
      users.findSessionUser.mockResolvedValue(null);

      await expect(service.refresh(token)).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    });
  });

  // -------------------------------------------------------------------------

  describe('logout', () => {
    it('deletes only the presented row, scoped to the authenticated user', async () => {
      const { token, tokenHash } = generateRefreshToken(USER_ID);

      await service.logout(USER_ID, token);

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, tokenHash },
      });
    });

    it('is idempotent with no cookie at all', async () => {
      await expect(service.logout(USER_ID, undefined)).resolves.toBeUndefined();
      expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------

describe('double-submit CSRF (POST /auth/refresh)', () => {
  function requestWith(cookie?: string, header?: string): Request {
    return {
      cookies: cookie === undefined ? {} : { [CSRF_COOKIE_NAME]: cookie },
      header: () => header,
    } as unknown as Request;
  }

  it('accepts a header that matches the cookie', () => {
    expect(() => assertDoubleSubmitCsrf(requestWith('token-abc', 'token-abc'))).not.toThrow();
  });

  it('rejects when the header is missing — the cross-site case', () => {
    expect(() => assertDoubleSubmitCsrf(requestWith('token-abc', undefined))).toThrow(ForbiddenException);
  });

  it('rejects when the cookie is missing', () => {
    expect(() => assertDoubleSubmitCsrf(requestWith(undefined, 'token-abc'))).toThrow(ForbiddenException);
  });

  it('rejects when the two values differ', () => {
    expect(() => assertDoubleSubmitCsrf(requestWith('token-abc', 'token-xyz'))).toThrow(
      'Token CSRF ausente ou inválido.',
    );
  });

  it('rejects two empty values instead of treating them as a match', () => {
    expect(() => assertDoubleSubmitCsrf(requestWith('', ''))).toThrow(ForbiddenException);
  });
});
