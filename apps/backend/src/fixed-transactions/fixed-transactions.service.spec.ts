import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FixedTransactionsService } from './fixed-transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';
import { CategoriesService } from '../categories/categories.service';
import { CreateFixedTransactionDto, UpdateFixedTransactionDto } from './fixed-transactions.dto';

describe('FixedTransactionsService', () => {
  let service: FixedTransactionsService;
  let prisma: jest.Mocked<PrismaService>;
  let accountsService: jest.Mocked<AccountsService>;
  let categoriesService: jest.Mocked<CategoriesService>;

  const userId = 'user-1';
  const fixedId = 'fixed-1';
  const accountId = 'account-1';
  const categoryId = 'category-1';

  const baseFixedTransaction = {
    id: fixedId,
    userId,
    type: 'expense' as const,
    value: 100,
    referenceDay: 5,
    marginDays: 2,
    accountId,
    categoryId,
    description: 'Netflix',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FixedTransactionsService,
        {
          provide: PrismaService,
          useValue: {
            fixedTransaction: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
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
      ],
    }).compile();

    service = module.get<FixedTransactionsService>(FixedTransactionsService);
    prisma = module.get(PrismaService);
    accountsService = module.get(AccountsService);
    categoriesService = module.get(CategoriesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createFixedTransaction', () => {
    it('should create fixed transaction when account and category exist', async () => {
      const dto: CreateFixedTransactionDto = {
        type: 'expense',
        value: 50,
        referenceDay: 10,
        marginDays: 3,
        accountId,
        categoryId,
        description: 'Spotify',
      };
      accountsService.findById.mockResolvedValue({ id: accountId } as any);
      categoriesService.findById.mockResolvedValue({ id: categoryId } as any);
      prisma.fixedTransaction.create.mockResolvedValue({ ...baseFixedTransaction, ...dto } as any);

      const result = await service.createFixedTransaction(userId, dto);

      expect(accountsService.findById).toHaveBeenCalledWith(userId, accountId);
      expect(categoriesService.findById).toHaveBeenCalledWith(userId, categoryId);
      expect(prisma.fixedTransaction.create).toHaveBeenCalledWith({
        data: { ...dto, accountId, categoryId, userId },
      });
      expect(result.description).toBe('Spotify');
    });
  });

  describe('findAllByUser', () => {
    it('should return all fixed transactions for user', async () => {
      prisma.fixedTransaction.findMany.mockResolvedValue([baseFixedTransaction]);

      const result = await service.findAllByUser(userId);

      expect(prisma.fixedTransaction.findMany).toHaveBeenCalledWith({ where: { userId } });
      expect(result).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('should return fixed transaction when found and owned', async () => {
      prisma.fixedTransaction.findUnique.mockResolvedValue(baseFixedTransaction);

      const result = await service.findById(userId, fixedId);

      expect(result.id).toBe(fixedId);
    });

    it('should throw NotFoundException when fixed transaction does not exist', async () => {
      prisma.fixedTransaction.findUnique.mockResolvedValue(null);

      await expect(service.findById(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when fixed transaction belongs to another user', async () => {
      prisma.fixedTransaction.findUnique.mockResolvedValue({
        ...baseFixedTransaction,
        userId: 'other-user',
      });

      await expect(service.findById(userId, fixedId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAllActive', () => {
    it('should return all active fixed transactions when no userId provided', async () => {
      prisma.fixedTransaction.findMany.mockResolvedValue([baseFixedTransaction]);

      const result = await service.findAllActive();

      expect(prisma.fixedTransaction.findMany).toHaveBeenCalledWith({ where: { isActive: true } });
      expect(result).toHaveLength(1);
    });

    it('should filter by userId when provided', async () => {
      prisma.fixedTransaction.findMany.mockResolvedValue([
        baseFixedTransaction,
        { ...baseFixedTransaction, id: 'fixed-2', userId: 'other-user' },
      ]);

      const result = await service.findAllActive(userId);

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(userId);
    });
  });

  describe('updateFixedTransaction', () => {
    it('should update fixed transaction when owned', async () => {
      const dto: UpdateFixedTransactionDto = { value: 200 };
      prisma.fixedTransaction.findUnique.mockResolvedValue(baseFixedTransaction);
      prisma.fixedTransaction.update.mockResolvedValue({ ...baseFixedTransaction, ...dto });

      const result = await service.updateFixedTransaction(userId, fixedId, dto);

      expect(prisma.fixedTransaction.update).toHaveBeenCalledWith({
        data: dto,
        where: { id: fixedId },
      });
      expect(result.value).toBe(200);
    });

    it('should validate new categoryId when provided', async () => {
      const dto: UpdateFixedTransactionDto = { categoryId: 'new-category' };
      prisma.fixedTransaction.findUnique.mockResolvedValue(baseFixedTransaction);
      categoriesService.findById.mockResolvedValue({ id: 'new-category' } as any);
      prisma.fixedTransaction.update.mockResolvedValue({ ...baseFixedTransaction, ...dto });

      await service.updateFixedTransaction(userId, fixedId, dto);

      expect(categoriesService.findById).toHaveBeenCalledWith(userId, 'new-category');
    });

    it('should validate new accountId when provided', async () => {
      const dto: UpdateFixedTransactionDto = { accountId: 'new-account' };
      prisma.fixedTransaction.findUnique.mockResolvedValue(baseFixedTransaction);
      accountsService.findById.mockResolvedValue({ id: 'new-account' } as any);
      prisma.fixedTransaction.update.mockResolvedValue({ ...baseFixedTransaction, ...dto });

      await service.updateFixedTransaction(userId, fixedId, dto);

      expect(accountsService.findById).toHaveBeenCalledWith(userId, 'new-account');
    });

    it('should throw NotFoundException when fixed transaction does not exist', async () => {
      prisma.fixedTransaction.findUnique.mockResolvedValue(null);

      await expect(service.updateFixedTransaction(userId, fixedId, {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when updating another user fixed transaction', async () => {
      prisma.fixedTransaction.findUnique.mockResolvedValue({
        ...baseFixedTransaction,
        userId: 'other-user',
      });

      await expect(service.updateFixedTransaction(userId, fixedId, {})).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('toggleActive', () => {
    it('should toggle isActive status', async () => {
      prisma.fixedTransaction.findUnique.mockResolvedValue(baseFixedTransaction);
      prisma.fixedTransaction.update.mockResolvedValue({ ...baseFixedTransaction, isActive: false });

      const result = await service.toggleActive(userId, fixedId, false);

      expect(prisma.fixedTransaction.update).toHaveBeenCalledWith({
        data: { isActive: false },
        where: { id: fixedId },
      });
      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException when fixed transaction does not exist', async () => {
      prisma.fixedTransaction.findUnique.mockResolvedValue(null);

      await expect(service.toggleActive(userId, fixedId, false)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when toggling another user fixed transaction', async () => {
      prisma.fixedTransaction.findUnique.mockResolvedValue({
        ...baseFixedTransaction,
        userId: 'other-user',
      });

      await expect(service.toggleActive(userId, fixedId, false)).rejects.toThrow(ForbiddenException);
    });
  });
});
