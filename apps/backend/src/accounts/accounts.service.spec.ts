import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { createMockPrismaService, type MockedPrismaService } from '../prisma/prisma.mock';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from './accounts.service';

describe('AccountsService', () => {
  let service: AccountsService;
  let prisma: MockedPrismaService;

  const userId = 'user-1';
  const accountId = 'account-1';
  const createdAt = new Date('2026-01-10T12:00:00.000Z');
  const updatedAt = new Date('2026-01-11T12:00:00.000Z');

  const baseAccount = {
    id: accountId,
    userId,
    name: 'Conta corrente',
    institution: 'Banco Inter',
    type: 'checking' as const,
    initialBalance: 1000,
    isActive: true,
    archivedAt: null,
    createdAt,
    updatedAt,
  };

  /** No dependent rows anywhere — the hard-delete branch. */
  function withoutDependents() {
    prisma.transaction.count.mockResolvedValue(0);
    prisma.fixedTransaction.count.mockResolvedValue(0);
    prisma.fixedTransactionOccurrence.count.mockResolvedValue(0);
    prisma.goal.count.mockResolvedValue(0);
  }

  beforeEach(async () => {
    prisma = createMockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [AccountsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(AccountsService);
    // Most paths re-read the balance; an empty aggregate means "no movement".
    prisma.transaction.groupBy.mockResolvedValue([]);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates the account and returns the contract shape', async () => {
      prisma.account.create.mockResolvedValue(baseAccount);

      const result = await service.create(userId, {
        name: 'Conta corrente',
        institution: 'Banco Inter',
        type: 'checking',
        initialBalance: 1000,
      });

      expect(prisma.account.create).toHaveBeenCalledWith({
        data: {
          userId,
          name: 'Conta corrente',
          institution: 'Banco Inter',
          type: 'checking',
          initialBalance: 1000,
        },
      });
      expect(result).toEqual({
        id: accountId,
        name: 'Conta corrente',
        institution: 'Banco Inter',
        type: 'checking',
        initialBalance: 1000,
        balance: 1000,
        isActive: true,
        archivedAt: null,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      });
    });
  });

  describe('findAll', () => {
    it('computes the balance from a single grouped aggregate, never from joined rows', async () => {
      prisma.account.findMany.mockResolvedValue([baseAccount]);
      prisma.account.count.mockResolvedValue(1);
      prisma.transaction.groupBy.mockResolvedValue([
        { accountId, type: 'income', _sum: { value: 500 } },
        { accountId, type: 'expense', _sum: { value: 200 } },
      ]);

      const result = await service.findAll(userId, {});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].balance).toBe(1300); // 1000 + 500 - 200
      expect(result.data[0]).not.toHaveProperty('transactions');
      expect(result.meta.totalItems).toBe(1);

      // One aggregate for the page, and no `include` on the account query.
      expect(prisma.transaction.groupBy).toHaveBeenCalledTimes(1);
      expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['accountId', 'type'],
          where: { userId, accountId: { in: [accountId] } },
          _sum: { value: true },
        }),
      );
      expect(prisma.account.findMany.mock.calls[0][0]).not.toHaveProperty('include');
    });

    it('hides archived accounts by default', async () => {
      prisma.account.findMany.mockResolvedValue([]);
      prisma.account.count.mockResolvedValue(0);

      await service.findAll(userId, {});

      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId, isActive: true }, take: 20, skip: 0 }),
      );
      // Nothing to aggregate: no id list, no query.
      expect(prisma.transaction.groupBy).not.toHaveBeenCalled();
    });

    it('includes archived accounts when asked', async () => {
      prisma.account.findMany.mockResolvedValue([{ ...baseAccount, isActive: false, archivedAt: updatedAt }]);
      prisma.account.count.mockResolvedValue(1);

      const result = await service.findAll(userId, { includeArchived: true });

      expect(prisma.account.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId } }));
      expect(result.data[0].isActive).toBe(false);
      expect(result.data[0].archivedAt).toBe(updatedAt.toISOString());
    });

    it('applies pagination', async () => {
      prisma.account.findMany.mockResolvedValue([]);
      prisma.account.count.mockResolvedValue(45);

      const result = await service.findAll(userId, { page: 3, limit: 10 });

      expect(prisma.account.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
      expect(result.meta).toEqual({
        page: 3,
        limit: 10,
        totalItems: 45,
        totalPages: 5,
        hasPreviousPage: true,
        hasNextPage: true,
      });
    });
  });

  describe('findOne', () => {
    it('returns the account with its balance', async () => {
      prisma.account.findUnique.mockResolvedValue(baseAccount);
      prisma.transaction.groupBy.mockResolvedValue([{ accountId, type: 'income', _sum: { value: 300 } }]);

      const result = await service.findOne(userId, accountId);

      expect(result.id).toBe(accountId);
      expect(result.balance).toBe(1300);
    });

    it('throws 404 when the account does not exist', async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(service.findOne(userId, 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws 404 — never 403 — for an account owned by someone else', async () => {
      prisma.account.findUnique.mockResolvedValue({ ...baseAccount, userId: 'other-user' });

      await expect(service.findOne(userId, accountId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('only writes the keys present in the patch', async () => {
      prisma.account.findUnique.mockResolvedValue(baseAccount);
      prisma.account.update.mockResolvedValue({ ...baseAccount, name: 'Conta salário' });

      const result = await service.update(userId, accountId, { name: 'Conta salário' });

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: accountId },
        data: { name: 'Conta salário' },
      });
      expect(result.name).toBe('Conta salário');
    });

    it('throws 404 for an account owned by someone else', async () => {
      prisma.account.findUnique.mockResolvedValue({ ...baseAccount, userId: 'other-user' });

      await expect(service.update(userId, accountId, { name: 'x' })).rejects.toThrow(NotFoundException);
      expect(prisma.account.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('archives instead of deleting when the account has history', async () => {
      prisma.account.findUnique.mockResolvedValue(baseAccount);
      withoutDependents();
      prisma.transaction.count.mockResolvedValue(3);
      prisma.account.update.mockResolvedValue({ ...baseAccount, isActive: false, archivedAt: updatedAt });

      const result = await service.remove(userId, accountId);

      expect(prisma.account.delete).not.toHaveBeenCalled();
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: accountId },
        data: { isActive: false, archivedAt: expect.any(Date) },
      });
      expect(result.isActive).toBe(false);
      expect(result.archivedAt).toBe(updatedAt.toISOString());
    });

    it('archives when only a goal points at the account', async () => {
      prisma.account.findUnique.mockResolvedValue(baseAccount);
      withoutDependents();
      prisma.goal.count.mockResolvedValue(1);
      prisma.account.update.mockResolvedValue({ ...baseAccount, isActive: false, archivedAt: updatedAt });

      await service.remove(userId, accountId);

      expect(prisma.account.delete).not.toHaveBeenCalled();
      expect(prisma.account.update).toHaveBeenCalled();
    });

    it('hard-deletes only when nothing references the account', async () => {
      prisma.account.findUnique.mockResolvedValue(baseAccount);
      withoutDependents();
      prisma.account.delete.mockResolvedValue(baseAccount);

      const result = await service.remove(userId, accountId);

      expect(prisma.account.delete).toHaveBeenCalledWith({ where: { id: accountId } });
      expect(prisma.account.update).not.toHaveBeenCalled();
      expect(result.id).toBe(accountId);
    });

    it('throws 404 for an account owned by someone else', async () => {
      prisma.account.findUnique.mockResolvedValue({ ...baseAccount, userId: 'other-user' });

      await expect(service.remove(userId, accountId)).rejects.toThrow(NotFoundException);
      expect(prisma.account.delete).not.toHaveBeenCalled();
    });
  });

  describe('archive / restore', () => {
    it('archives an active account', async () => {
      prisma.account.findUnique.mockResolvedValue(baseAccount);
      prisma.account.update.mockResolvedValue({ ...baseAccount, isActive: false, archivedAt: updatedAt });

      const result = await service.archive(userId, accountId);

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: accountId },
        data: { isActive: false, archivedAt: expect.any(Date) },
      });
      expect(result.isActive).toBe(false);
    });

    it('is idempotent when the account is already archived', async () => {
      prisma.account.findUnique.mockResolvedValue({ ...baseAccount, isActive: false, archivedAt: updatedAt });

      const result = await service.archive(userId, accountId);

      expect(prisma.account.update).not.toHaveBeenCalled();
      expect(result.isActive).toBe(false);
    });

    it('restores an archived account and clears archivedAt', async () => {
      prisma.account.findUnique.mockResolvedValue({ ...baseAccount, isActive: false, archivedAt: updatedAt });
      prisma.account.update.mockResolvedValue(baseAccount);

      const result = await service.restore(userId, accountId);

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: accountId },
        data: { isActive: true, archivedAt: null },
      });
      expect(result.isActive).toBe(true);
      expect(result.archivedAt).toBeNull();
    });

    it('is idempotent when the account is already active', async () => {
      prisma.account.findUnique.mockResolvedValue(baseAccount);

      const result = await service.restore(userId, accountId);

      expect(prisma.account.update).not.toHaveBeenCalled();
      expect(result.isActive).toBe(true);
    });
  });

  describe('getBalancesByType', () => {
    it('splits cash from investment balances in a single database round trip', async () => {
      prisma.$queryRaw.mockResolvedValue([{ cashBalance: '1500.00', investmentBalance: '2500.50' }]);

      const result = await service.getBalancesByType(userId);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ cashBalance: 1500, investmentBalance: 2500.5 });
    });

    it('returns zeros when the user has no accounts', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(service.getBalancesByType(userId)).resolves.toEqual({
        cashBalance: 0,
        investmentBalance: 0,
      });
    });
  });
});
