import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import type { BackupData } from './backup.dto';
import { BackupService } from './backup.service';

describe('BackupService', () => {
  let service: BackupService;
  let prisma: jest.Mocked<PrismaService>;

  const userId = 'user-1';
  const now = new Date();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupService,
        {
          provide: PrismaService,
          useValue: {
            account: {
              findMany: jest.fn(),
              create: jest.fn(),
            },
            category: {
              findMany: jest.fn(),
              create: jest.fn(),
            },
            creditCard: {
              findMany: jest.fn(),
              create: jest.fn(),
            },
            marketAsset: {
              findMany: jest.fn(),
              create: jest.fn(),
            },
            transaction: {
              findMany: jest.fn(),
              create: jest.fn(),
            },
            fixedTransaction: {
              findMany: jest.fn(),
              create: jest.fn(),
            },
            investment: {
              findMany: jest.fn(),
              create: jest.fn(),
            },
            goal: {
              findMany: jest.fn(),
              create: jest.fn(),
            },
            importedFile: {
              findMany: jest.fn(),
              create: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<BackupService>(BackupService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('export', () => {
    it('should return structured backup data', async () => {
      (prisma.account.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.category.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.creditCard.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.marketAsset.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.fixedTransaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.investment.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.goal.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.importedFile.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
      });

      const result = await service.export(userId);

      expect(result.version).toBe('1.0');
      expect(result.user.id).toBe(userId);
      expect(result.user.email).toBe('test@example.com');
      expect(Array.isArray(result.accounts)).toBe(true);
      expect(Array.isArray(result.categories)).toBe(true);
      expect(Array.isArray(result.transactions)).toBe(true);
    });

    it('should include all entity types', async () => {
      (prisma.account.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'acc-1',
          name: 'Account',
          institution: 'Bank',
          type: 'checking',
          initialBalance: 100,
          isActive: true,
          userId,
        },
      ]);
      (prisma.category.findMany as jest.Mock).mockResolvedValue([
        { id: 'cat-1', name: 'Food', type: 'expense', userId },
      ]);
      (prisma.creditCard.findMany as jest.Mock).mockResolvedValue([
        { id: 'cc-1', name: 'Card', institution: 'Bank', limitTotal: 1000, closingDay: 10, isActive: true, userId },
      ]);
      (prisma.marketAsset.findMany as jest.Mock).mockResolvedValue([
        { id: 'ma-1', symbol: 'PETR4', type: 'stock', exchange: 'B3', name: 'Petrobras', userId },
      ]);
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'txn-1',
          type: 'expense',
          value: 50,
          date: now,
          accountId: 'acc-1',
          creditCardId: null,
          categoryId: 'cat-1',
          description: 'Lunch',
          source: 'manual',
          externalId: null,
          userId,
        },
      ]);
      (prisma.fixedTransaction.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'ft-1',
          type: 'expense',
          value: 100,
          referenceDay: 5,
          marginDays: 2,
          accountId: 'acc-1',
          creditCardId: null,
          categoryId: 'cat-1',
          description: 'Rent',
          isActive: true,
          userId,
        },
      ]);
      (prisma.investment.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'inv-1',
          marketAssetId: 'ma-1',
          broker: 'XP',
          type: 'stock',
          quantity: 10,
          buyPrice: 25,
          investedAmount: 250,
          buyDate: now,
          userId,
        },
      ]);
      (prisma.goal.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'goal-1',
          name: 'Emergency Fund',
          type: 'savings',
          targetAmount: 10000,
          currentAmount: 5000,
          deadline: now,
          relatedCategoryId: null,
          relatedAccountId: 'acc-1',
          userId,
        },
      ]);
      (prisma.importedFile.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'imp-1',
          origin: 'inter',
          fileName: 'extrato.csv',
          fileType: 'csv',
          status: 'completed',
          importedAt: now,
          totalRecords: 5,
          userId,
        },
      ]);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: userId, email: 'test@example.com', name: 'Test' });

      const result = await service.export(userId);

      expect(result.accounts).toHaveLength(1);
      expect(result.categories).toHaveLength(1);
      expect(result.creditCards).toHaveLength(1);
      expect(result.marketAssets).toHaveLength(1);
      expect(result.transactions).toHaveLength(1);
      expect(result.fixedTransactions).toHaveLength(1);
      expect(result.investments).toHaveLength(1);
      expect(result.goals).toHaveLength(1);
      expect(result.importedFiles).toHaveLength(1);

      expect(result.accounts[0].initialBalance).toBe(100);
      expect(result.transactions[0].value).toBe(50);
      expect(result.investments[0].quantity).toBe(10);
    });
  });

  describe('restore', () => {
    const createBackupData = (): BackupData => ({
      version: '1.0',
      exportedAt: now.toISOString(),
      user: { id: userId, email: 'test@example.com', name: 'Test' },
      accounts: [
        { id: 'acc-1', name: 'Account', institution: 'Bank', type: 'checking', initialBalance: 100, isActive: true },
      ],
      categories: [{ id: 'cat-1', name: 'Food', type: 'expense' }],
      creditCards: [
        { id: 'cc-1', name: 'Card', institution: 'Bank', limitTotal: 1000, closingDay: 10, isActive: true },
      ],
      marketAssets: [{ id: 'ma-1', symbol: 'PETR4', type: 'stock', exchange: 'B3', name: 'Petrobras' }],
      transactions: [
        {
          id: 'txn-1',
          type: 'expense',
          value: 50,
          date: now.toISOString(),
          accountId: 'acc-1',
          categoryId: 'cat-1',
          description: 'Lunch',
          source: 'manual',
        },
      ],
      fixedTransactions: [
        {
          id: 'ft-1',
          type: 'expense',
          value: 100,
          referenceDay: 5,
          marginDays: 2,
          accountId: 'acc-1',
          categoryId: 'cat-1',
          description: 'Rent',
          isActive: true,
        },
      ],
      investments: [
        {
          id: 'inv-1',
          marketAssetId: 'ma-1',
          broker: 'XP',
          type: 'stock',
          quantity: 10,
          buyPrice: 25,
          investedAmount: 250,
          buyDate: now.toISOString(),
        },
      ],
      goals: [
        {
          id: 'goal-1',
          name: 'Emergency Fund',
          type: 'savings',
          targetAmount: 10000,
          currentAmount: 5000,
          deadline: now.toISOString(),
          relatedAccountId: 'acc-1',
        },
      ],
      importedFiles: [
        {
          id: 'imp-1',
          origin: 'inter',
          fileName: 'extrato.csv',
          fileType: 'csv',
          status: 'completed',
          importedAt: now.toISOString(),
          totalRecords: 5,
        },
      ],
    });

    it('should restore all entities with mapped IDs', async () => {
      const backup = createBackupData();

      (prisma.account.create as jest.Mock).mockResolvedValue({ id: 'new-acc-1' });
      (prisma.category.create as jest.Mock).mockResolvedValue({ id: 'new-cat-1' });
      (prisma.creditCard.create as jest.Mock).mockResolvedValue({ id: 'new-cc-1' });
      (prisma.marketAsset.create as jest.Mock).mockResolvedValue({ id: 'new-ma-1' });
      (prisma.transaction.create as jest.Mock).mockResolvedValue({ id: 'new-txn-1' });
      (prisma.fixedTransaction.create as jest.Mock).mockResolvedValue({ id: 'new-ft-1' });
      (prisma.investment.create as jest.Mock).mockResolvedValue({ id: 'new-inv-1' });
      (prisma.goal.create as jest.Mock).mockResolvedValue({ id: 'new-goal-1' });
      (prisma.importedFile.create as jest.Mock).mockResolvedValue({ id: 'new-imp-1' });

      const result = await service.restore(userId, backup);

      expect(prisma.account.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId, name: 'Account' }),
          select: { id: true },
        }),
      );
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            accountId: 'new-acc-1',
            categoryId: 'new-cat-1',
          }),
        }),
      );
      expect(prisma.investment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            marketAssetId: 'new-ma-1',
          }),
        }),
      );
      expect(result.restored.accounts).toBe(1);
      expect(result.restored.transactions).toBe(1);
    });

    it('should handle null/undefined foreign keys', async () => {
      const backup = createBackupData();
      backup.transactions[0].accountId = undefined;
      backup.transactions[0].creditCardId = undefined;
      backup.transactions[0].categoryId = undefined;
      backup.investments[0].marketAssetId = undefined;
      backup.goals[0].relatedAccountId = undefined;
      backup.goals[0].relatedCategoryId = undefined;

      (prisma.account.create as jest.Mock).mockResolvedValue({ id: 'new-acc-1' });
      (prisma.category.create as jest.Mock).mockResolvedValue({ id: 'new-cat-1' });
      (prisma.creditCard.create as jest.Mock).mockResolvedValue({ id: 'new-cc-1' });
      (prisma.marketAsset.create as jest.Mock).mockResolvedValue({ id: 'new-ma-1' });

      await service.restore(userId, backup);

      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountId: null,
            creditCardId: null,
            categoryId: null,
          }),
        }),
      );
      expect(prisma.investment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ marketAssetId: null }),
        }),
      );
    });

    it('should reject invalid backup data', async () => {
      await expect(service.restore(userId, null as any)).rejects.toThrow(BadRequestException);
      await expect(service.restore(userId, {} as any)).rejects.toThrow(BadRequestException);
      await expect(service.restore(userId, { accounts: 'not-array' } as any)).rejects.toThrow(BadRequestException);
    });
  });
});
