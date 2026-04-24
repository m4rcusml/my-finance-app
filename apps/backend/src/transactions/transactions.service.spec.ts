import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from '../accounts/accounts.service';
import { CategoriesService } from '../categories/categories.service';
import { CreditCardsService } from '../credit-cards/credit-cards.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto, ListTransactionsQueryDto, UpdateTransactionDto } from './transactions.dto';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: jest.Mocked<PrismaService>;
  let accountsService: jest.Mocked<AccountsService>;
  let categoriesService: jest.Mocked<CategoriesService>;
  let creditCardsService: jest.Mocked<CreditCardsService>;

  const userId = 'user-1';
  const transactionId = 'transaction-1';
  const accountId = 'account-1';
  const categoryId = 'category-1';

  const baseTransaction = {
    id: transactionId,
    userId,
    type: 'expense' as const,
    value: 100,
    date: new Date('2025-01-15'),
    accountId,
    categoryId,
    description: 'Grocery',
    source: 'manual',
    externalId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: PrismaService,
          useValue: {
            transaction: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
          },
        },
        {
          provide: AccountsService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: CategoriesService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: CreditCardsService,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    prisma = module.get(PrismaService);
    accountsService = module.get(AccountsService);
    categoriesService = module.get(CategoriesService);
    creditCardsService = module.get(CreditCardsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create transaction when account exists', async () => {
      const dto: CreateTransactionDto = {
        type: 'expense',
        value: 50,
        date: '2025-01-20',
        accountId,
        description: 'Coffee',
      };
      accountsService.findById.mockResolvedValue({ id: accountId, name: 'Main' } as any);
      prisma.transaction.create.mockResolvedValue({ ...baseTransaction, ...dto } as any);

      const result = await service.create(userId, dto);

      expect(accountsService.findById).toHaveBeenCalledWith(userId, accountId);
      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: { ...dto, userId },
      });
      expect(result.value).toBe(50);
    });

    it('should validate category when categoryId is provided', async () => {
      const dto: CreateTransactionDto = {
        type: 'expense',
        value: 50,
        date: '2025-01-20',
        accountId,
        categoryId,
      };
      accountsService.findById.mockResolvedValue({ id: accountId } as any);
      categoriesService.findById.mockResolvedValue({ id: categoryId } as any);
      prisma.transaction.create.mockResolvedValue({ ...baseTransaction, ...dto } as any);

      await service.create(userId, dto);

      expect(categoriesService.findById).toHaveBeenCalledWith(userId, categoryId);
    });

    it('should propagate NotFoundException when account does not exist', async () => {
      const dto: CreateTransactionDto = {
        type: 'expense',
        value: 50,
        date: '2025-01-20',
        accountId,
      };
      accountsService.findById.mockRejectedValue(new NotFoundException());

      await expect(service.create(userId, dto)).rejects.toThrow(NotFoundException);
    });

    it('should create transaction with creditCardId instead of accountId', async () => {
      const dto: CreateTransactionDto = {
        type: 'expense',
        value: 50,
        date: '2025-01-20',
        creditCardId: 'cc-1',
      };
      creditCardsService.findById.mockResolvedValue({ id: 'cc-1' } as any);
      prisma.transaction.create.mockResolvedValue({ ...baseTransaction, ...dto, accountId: null } as any);

      const result = await service.create(userId, dto);

      expect(creditCardsService.findById).toHaveBeenCalledWith(userId, 'cc-1');
      expect(accountsService.findById).not.toHaveBeenCalled();
      expect(result.creditCardId).toBe('cc-1');
    });

    it('should throw BadRequestException when neither accountId nor creditCardId is provided', async () => {
      const dto: CreateTransactionDto = {
        type: 'expense',
        value: 50,
        date: '2025-01-20',
      };

      await expect(service.create(userId, dto)).rejects.toThrow('Either accountId or creditCardId must be provided');
    });

    it('should throw BadRequestException when both accountId and creditCardId are provided', async () => {
      const dto: CreateTransactionDto = {
        type: 'expense',
        value: 50,
        date: '2025-01-20',
        accountId,
        creditCardId: 'cc-1',
      };

      await expect(service.create(userId, dto)).rejects.toThrow('Cannot provide both accountId and creditCardId');
    });
  });

  describe('findAllByUser', () => {
    it('should return transactions ordered by date desc', async () => {
      prisma.transaction.findMany.mockResolvedValue([baseTransaction]);
      prisma.transaction.count.mockResolvedValue(1);

      const result = await service.findAllByUser(userId);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          orderBy: { date: 'desc' },
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.meta.totalItems).toBe(1);
    });

    it('should apply type filter', async () => {
      const filters: ListTransactionsQueryDto = { type: 'income' };
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      await service.findAllByUser(userId, filters);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId, type: 'income' }),
        }),
      );
    });

    it('should apply date range filter', async () => {
      const filters: ListTransactionsQueryDto = { fromDate: '2025-01-01', toDate: '2025-01-31' };
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      await service.findAllByUser(userId, filters);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            date: {
              gte: new Date('2025-01-01'),
              lte: new Date('2025-01-31'),
            },
          }),
        }),
      );
    });

    it('should apply accountId and categoryId filters', async () => {
      const filters: ListTransactionsQueryDto = { accountId, categoryId };
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      await service.findAllByUser(userId, filters);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId, accountId, categoryId }),
        }),
      );
    });
  });

  describe('findUncategorized', () => {
    it('should return transactions with null categoryId', async () => {
      prisma.transaction.findMany.mockResolvedValue([{ ...baseTransaction, categoryId: null }]);
      prisma.transaction.count.mockResolvedValue(1);

      const result = await service.findUncategorized(userId);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, categoryId: null },
          orderBy: { date: 'desc' },
        }),
      );
      expect(result.data[0].categoryId).toBeNull();
      expect(result.meta.totalItems).toBe(1);
    });

    it('should apply filters to uncategorized transactions', async () => {
      const filters: ListTransactionsQueryDto = { type: 'expense', fromDate: '2025-01-01' };
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      await service.findUncategorized(userId, filters);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            categoryId: null,
            type: 'expense',
            date: { gte: new Date('2025-01-01') },
          }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return transaction when found and owned', async () => {
      prisma.transaction.findUnique.mockResolvedValue(baseTransaction);

      const result = await service.findById(userId, transactionId);

      expect(result.id).toBe(transactionId);
    });

    it('should throw NotFoundException when transaction does not exist', async () => {
      prisma.transaction.findUnique.mockResolvedValue(null);

      await expect(service.findById(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when transaction belongs to another user', async () => {
      prisma.transaction.findUnique.mockResolvedValue({ ...baseTransaction, userId: 'other-user' });

      await expect(service.findById(userId, transactionId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update transaction when owned', async () => {
      const dto: UpdateTransactionDto = { value: 200 };
      prisma.transaction.findUnique.mockResolvedValue(baseTransaction);
      prisma.transaction.update.mockResolvedValue({ ...baseTransaction, ...dto });

      const result = await service.update(userId, transactionId, dto);

      expect(prisma.transaction.update).toHaveBeenCalledWith({
        data: dto,
        where: { id: transactionId },
      });
      expect(result.value).toBe(200);
    });

    it('should validate new categoryId when provided', async () => {
      const dto: UpdateTransactionDto = { categoryId: 'new-category' };
      prisma.transaction.findUnique.mockResolvedValue(baseTransaction);
      categoriesService.findById.mockResolvedValue({ id: 'new-category' } as any);
      prisma.transaction.update.mockResolvedValue({ ...baseTransaction, ...dto });

      await service.update(userId, transactionId, dto);

      expect(categoriesService.findById).toHaveBeenCalledWith(userId, 'new-category');
    });

    it('should validate new accountId when provided', async () => {
      const dto: UpdateTransactionDto = { accountId: 'new-account' };
      prisma.transaction.findUnique.mockResolvedValue(baseTransaction);
      accountsService.findById.mockResolvedValue({ id: 'new-account' } as any);
      prisma.transaction.update.mockResolvedValue({ ...baseTransaction, ...dto });

      await service.update(userId, transactionId, dto);

      expect(accountsService.findById).toHaveBeenCalledWith(userId, 'new-account');
    });

    it('should validate new creditCardId when provided', async () => {
      const dto: UpdateTransactionDto = { creditCardId: 'cc-1' };
      prisma.transaction.findUnique.mockResolvedValue(baseTransaction);
      creditCardsService.findById.mockResolvedValue({ id: 'cc-1' } as any);
      prisma.transaction.update.mockResolvedValue({ ...baseTransaction, ...dto });

      await service.update(userId, transactionId, dto);

      expect(creditCardsService.findById).toHaveBeenCalledWith(userId, 'cc-1');
    });

    it('should throw BadRequestException when both accountId and creditCardId are provided in update', async () => {
      const dto: UpdateTransactionDto = { accountId: 'new-account', creditCardId: 'cc-1' };
      prisma.transaction.findUnique.mockResolvedValue(baseTransaction);

      await expect(service.update(userId, transactionId, dto)).rejects.toThrow(
        'Cannot provide both accountId and creditCardId',
      );
    });

    it('should throw NotFoundException when transaction does not exist', async () => {
      prisma.transaction.findUnique.mockResolvedValue(null);

      await expect(service.update(userId, transactionId, {})).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when updating another user transaction', async () => {
      prisma.transaction.findUnique.mockResolvedValue({ ...baseTransaction, userId: 'other-user' });

      await expect(service.update(userId, transactionId, {})).rejects.toThrow(ForbiddenException);
    });
  });

  describe('delete', () => {
    it('should delete transaction when owned', async () => {
      prisma.transaction.findUnique.mockResolvedValue(baseTransaction);
      prisma.transaction.delete.mockResolvedValue(baseTransaction);

      await service.delete(userId, transactionId);

      expect(prisma.transaction.delete).toHaveBeenCalledWith({ where: { id: transactionId } });
    });

    it('should throw NotFoundException when transaction does not exist', async () => {
      prisma.transaction.findUnique.mockResolvedValue(null);

      await expect(service.delete(userId, transactionId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when deleting another user transaction', async () => {
      prisma.transaction.findUnique.mockResolvedValue({ ...baseTransaction, userId: 'other-user' });

      await expect(service.delete(userId, transactionId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getSummary', () => {
    it('should calculate income, expense and net for the period', async () => {
      prisma.transaction.findMany.mockResolvedValue([
        { ...baseTransaction, type: 'income', value: 5000 },
        { ...baseTransaction, type: 'expense', value: 2000 },
        { ...baseTransaction, type: 'expense', value: 1500 },
      ]);

      const result = await service.getSummary(userId, '2026-04-01', '2026-04-30');

      expect(result.income).toBe(5000);
      expect(result.expense).toBe(3500);
      expect(result.net).toBe(1500);
    });

    it('should handle Decimal-like values', async () => {
      prisma.transaction.findMany.mockResolvedValue([
        { ...baseTransaction, type: 'income', value: { toNumber: () => 1000 } },
        { ...baseTransaction, type: 'expense', value: { toNumber: () => 300 } },
      ]);

      const result = await service.getSummary(userId, '2026-04-01', '2026-04-30');

      expect(result.income).toBe(1000);
      expect(result.expense).toBe(300);
      expect(result.net).toBe(700);
    });

    it('should return zero when no transactions in period', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);

      const result = await service.getSummary(userId, '2026-04-01', '2026-04-30');

      expect(result.income).toBe(0);
      expect(result.expense).toBe(0);
      expect(result.net).toBe(0);
    });
  });

  describe('getProjection', () => {
    it('should calculate projected expense from last 3 months', async () => {
      prisma.transaction.findMany.mockResolvedValue([
        { ...baseTransaction, type: 'expense', value: 3000, date: new Date('2026-01-15') },
        { ...baseTransaction, type: 'expense', value: 3000, date: new Date('2026-02-15') },
        { ...baseTransaction, type: 'expense', value: 3000, date: new Date('2026-03-15') },
        { ...baseTransaction, type: 'expense', value: 3000, date: new Date('2026-04-15') },
      ]);

      const result = await service.getProjection(userId);

      expect(result.projectedExpense).toBe(3000);
    });

    it('should handle fewer than 3 months of data', async () => {
      prisma.transaction.findMany.mockResolvedValue([
        { ...baseTransaction, type: 'expense', value: 2000, date: new Date('2026-04-15') },
      ]);

      const result = await service.getProjection(userId);

      expect(result.projectedExpense).toBe(2000);
    });

    it('should return zero when no expense transactions exist', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);

      const result = await service.getProjection(userId);

      expect(result.projectedExpense).toBe(0);
    });
  });
});
