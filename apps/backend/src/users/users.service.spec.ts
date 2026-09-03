import { BadRequestException, ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ACCOUNT_DELETION_CONFIRMATION } from '../auth/constants';
import { PrismaService } from '../prisma/prisma.service';
import { DeleteAccountDto } from './users.dto';
import { UsersService } from './users.service';

jest.mock('argon2');

const USER_ID = '11111111-2222-4333-8444-555555555555';

const dbUser = {
  id: USER_ID,
  email: 'maria@exemplo.com.br',
  name: 'Maria',
  tokenVersion: 2,
  passwordHash: '$argon2id$stored',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

const profileRow = {
  id: dbUser.id,
  email: dbUser.email,
  name: dbUser.name,
  createdAt: dbUser.createdAt,
  updatedAt: dbUser.updatedAt,
};

type PrismaMock = {
  user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
  refreshToken: { deleteMany: jest.Mock };
  $transaction: jest.Mock;
};

/** Everything this suite asserts must never appear in a response. */
function assertNoSecrets(value: unknown): void {
  const serialised = JSON.stringify(value ?? null);
  expect(serialised).not.toContain('passwordHash');
  expect(serialised).not.toContain('$argon2id$');
  expect(serialised).not.toContain('tokenVersion');
}

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn().mockResolvedValue({ id: USER_ID }),
      },
      refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 4 }) },
      $transaction: jest.fn().mockImplementation(async (ops: unknown) => Promise.all(ops as unknown[])),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(UsersService);
    (argon2.hash as jest.Mock).mockResolvedValue('$argon2id$fresh');
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------

  describe('findProfile', () => {
    it('selects only public columns and returns ISO timestamps', async () => {
      prisma.user.findUnique.mockResolvedValue(profileRow);

      const result = await service.findProfile(USER_ID);

      const select = prisma.user.findUnique.mock.calls[0][0].select as Record<string, boolean>;
      expect(select.passwordHash).toBeUndefined();
      expect(result).toEqual({
        id: USER_ID,
        email: 'maria@exemplo.com.br',
        name: 'Maria',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      });
      assertNoSecrets(result);
    });

    it('404s when the user is gone instead of resolving null', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findProfile(USER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findSessionUser / findTokenVersion', () => {
    it('never selects the password hash', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...profileRow, tokenVersion: 2 });
      const session = await service.findSessionUser(USER_ID);

      const select = prisma.user.findUnique.mock.calls[0][0].select as Record<string, boolean>;
      expect(select.passwordHash).toBeUndefined();
      expect(select.tokenVersion).toBe(true);
      expect(session).not.toHaveProperty('passwordHash');
    });

    it('reads a single column and reports a missing user as null', async () => {
      prisma.user.findUnique.mockResolvedValue({ tokenVersion: 7 });
      await expect(service.findTokenVersion(USER_ID)).resolves.toBe(7);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: USER_ID },
        select: { tokenVersion: true },
      });

      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findTokenVersion(USER_ID)).resolves.toBeNull();
    });
  });

  describe('findByEmailWithPassword', () => {
    it('normalises the e-mail before looking it up', async () => {
      prisma.user.findUnique.mockResolvedValue(dbUser);

      await service.findByEmailWithPassword('  Maria@Exemplo.COM.BR ');

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'maria@exemplo.com.br' } }),
      );
    });
  });

  // -------------------------------------------------------------------------

  describe('createUser', () => {
    it('hashes the password, normalises the e-mail and returns no hash', async () => {
      prisma.user.create.mockResolvedValue({ ...profileRow, tokenVersion: 0 });

      const result = await service.createUser({
        email: ' Nova@Exemplo.com.BR ',
        password: 'uma-senha-bem-longa',
        name: 'Nova',
      });

      expect(argon2.hash).toHaveBeenCalledWith('uma-senha-bem-longa');
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { email: 'nova@exemplo.com.br', passwordHash: '$argon2id$fresh', name: 'Nova' },
        }),
      );
      const select = prisma.user.create.mock.calls[0][0].select as Record<string, boolean>;
      expect(select.passwordHash).toBeUndefined();
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('turns a unique-index violation into a pt-BR 409', async () => {
      prisma.user.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));

      const error = await service
        .createUser({ email: 'maria@exemplo.com.br', password: 'uma-senha-bem-longa' })
        .catch((thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).message).toBe('Este e-mail já está em uso.');
    });
  });

  // -------------------------------------------------------------------------

  describe('updateProfile', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ ...profileRow, passwordHash: dbUser.passwordHash });
      prisma.user.update.mockResolvedValue(profileRow);
    });

    it('leaves omitted keys untouched', async () => {
      await service.updateProfile(USER_ID, { name: 'Maria Silva' });

      expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { name: 'Maria Silva' } }));
    });

    it('treats an explicit null as "clear this field"', async () => {
      await service.updateProfile(USER_ID, { name: null });

      expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { name: null } }));
    });

    it('refuses an e-mail change without the current password', async () => {
      await expect(service.updateProfile(USER_ID, { email: 'outra@exemplo.com.br' })).rejects.toThrow(
        BadRequestException,
      );

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('refuses an e-mail change when the current password is wrong', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.updateProfile(USER_ID, {
          email: 'outra@exemplo.com.br',
          currentPassword: 'errada',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('accepts an e-mail change with the correct password', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.updateProfile(USER_ID, {
        email: ' Outra@Exemplo.com.br ',
        currentPassword: 'uma-senha-bem-longa',
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { email: 'outra@exemplo.com.br' } }),
      );
      assertNoSecrets(result);
    });

    it('does not ask for a password when the e-mail is unchanged', async () => {
      const result = await service.updateProfile(USER_ID, { email: 'MARIA@exemplo.com.br' });

      expect(argon2.verify).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(result.email).toBe('maria@exemplo.com.br');
    });

    it('turns a taken e-mail into a 409', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));

      await expect(
        service.updateProfile(USER_ID, {
          email: 'ocupado@exemplo.com.br',
          currentPassword: 'uma-senha-bem-longa',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('404s for a user that no longer exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.updateProfile(USER_ID, { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------

  describe('changePassword', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID, passwordHash: dbUser.passwordHash });
    });

    it('rejects a wrong current password and changes nothing', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(USER_ID, {
          currentPassword: 'errada',
          newPassword: 'uma-senha-bem-longa',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled();
    });

    it('rejects a new password that fails the policy', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await expect(
        service.changePassword(USER_ID, { currentPassword: 'atual-longa', newPassword: 'curta' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.changePassword(USER_ID, {
          currentPassword: 'atual-longa',
          newPassword: 'password123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects reusing the current password', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await expect(
        service.changePassword(USER_ID, {
          currentPassword: 'uma-senha-bem-longa',
          newPassword: 'uma-senha-bem-longa',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('revokes every session: bumps tokenVersion AND deletes all refresh rows, atomically', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await service.changePassword(USER_ID, {
        currentPassword: 'uma-senha-bem-longa',
        newPassword: 'outra-senha-bem-longa',
      });

      expect(argon2.hash).toHaveBeenCalledWith('outra-senha-bem-longa');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { passwordHash: '$argon2id$fresh', tokenVersion: { increment: 1 } },
        select: { id: true },
      });
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
      // Both writes go through the same transaction — never one without the other.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------

  describe('deleteAccount', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ id: USER_ID, passwordHash: dbUser.passwordHash });
      (argon2.verify as jest.Mock).mockResolvedValue(true);
    });

    it('requires the confirmation string exactly, before touching anything', async () => {
      for (const confirmation of [
        'excluir minha conta',
        'EXCLUIR MINHA CONTA ',
        'EXCLUIR CONTA',
        'DELETE MY ACCOUNT',
        '',
      ]) {
        await expect(service.deleteAccount(USER_ID, { password: 'uma-senha-bem-longa', confirmation })).rejects.toThrow(
          BadRequestException,
        );
      }

      expect(prisma.user.delete).not.toHaveBeenCalled();
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('rejects a wrong password even with a correct confirmation', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.deleteAccount(USER_ID, {
          password: 'errada',
          confirmation: ACCOUNT_DELETION_CONFIRMATION,
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('deletes and returns nothing — never the user row', async () => {
      const result = await service.deleteAccount(USER_ID, {
        password: 'uma-senha-bem-longa',
        confirmation: ACCOUNT_DELETION_CONFIRMATION,
      });

      expect(result).toBeUndefined();
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: USER_ID },
        select: { id: true },
      });
      assertNoSecrets(result);
    });
  });

  // -------------------------------------------------------------------------

  describe('DeleteAccountDto', () => {
    it('only validates the exact confirmation phrase', () => {
      const accepted = plainToInstance(DeleteAccountDto, {
        password: 'uma-senha-bem-longa',
        confirmation: ACCOUNT_DELETION_CONFIRMATION,
      });
      expect(validateSync(accepted)).toHaveLength(0);

      const rejected = plainToInstance(DeleteAccountDto, {
        password: 'uma-senha-bem-longa',
        confirmation: 'excluir minha conta',
      });
      expect(validateSync(rejected).length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------

  describe('serialisation safety', () => {
    it('no method resolves an object carrying passwordHash', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...profileRow, tokenVersion: 1 });
      prisma.user.create.mockResolvedValue({ ...profileRow, tokenVersion: 0 });
      prisma.user.update.mockResolvedValue(profileRow);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const responses: unknown[] = [
        await service.findProfile(USER_ID),
        await service.updateProfile(USER_ID, { name: 'Maria Silva' }),
        await service.createUser({ email: 'x@y.com.br', password: 'uma-senha-bem-longa' }),
      ];

      for (const response of responses) {
        expect(response).not.toHaveProperty('passwordHash');
        expect(JSON.stringify(response)).not.toContain('passwordHash');
        expect(JSON.stringify(response)).not.toContain('$argon2id$');
      }
    });
  });
});
