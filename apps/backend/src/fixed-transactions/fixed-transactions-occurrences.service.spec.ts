import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FixedTransactionsOccurrencesService } from './fixed-transactions-occurrences.service';
import { PrismaService } from '../prisma/prisma.service';
import { FixedTransactionsService } from './fixed-transactions.service';
import { TransactionsService } from '../transactions/transactions.service';

describe('FixedTransactionsOccurrencesService', () => {
  let service: FixedTransactionsOccurrencesService;
  let prisma: jest.Mocked<PrismaService>;
  let fixedTransactionsService: jest.Mocked<FixedTransactionsService>;
  let transactionsService: jest.Mocked<TransactionsService>;

  const userId = 'user-1';
  const occurrenceId = 'occ-1';
  const fixedTransactionId = 'fixed-1';
  const transactionId = 'transaction-1';

  const baseOccurrence = {
    id: occurrenceId,
    userId,
    fixedTransactionId,
    periodYear: 2025,
    periodMonth: 1,
    status: 'PENDING' as const,
    realDate: null,
    transactionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const baseFixedTransaction = {
    id: fixedTransactionId,
    userId,
    type: 'expense' as const,
    value: { toNumber: () => 100 },
    referenceDay: 5,
    marginDays: 2,
    accountId: 'account-1',
    categoryId: 'category-1',
    description: 'Netflix',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FixedTransactionsOccurrencesService,
        {
          provide: PrismaService,
          useValue: {
            fixedTransactionOccurrence: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: FixedTransactionsService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: TransactionsService,
          useValue: {
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FixedTransactionsOccurrencesService>(FixedTransactionsOccurrencesService);
    prisma = module.get(PrismaService);
    fixedTransactionsService = module.get(FixedTransactionsService);
    transactionsService = module.get(TransactionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOccurrence', () => {
    it('should create a pending occurrence', async () => {
      prisma.fixedTransactionOccurrence.create.mockResolvedValue(baseOccurrence);

      const result = await service.createOccurrence(userId, fixedTransactionId, 2025, 1);

      expect(prisma.fixedTransactionOccurrence.create).toHaveBeenCalledWith({
        data: {
          userId,
          fixedTransactionId,
          periodYear: 2025,
          periodMonth: 1,
          status: 'PENDING',
          realDate: null,
          transactionId: null,
        },
      });
      expect(result.status).toBe('PENDING');
    });
  });

  describe('listAllByUser', () => {
    it('should return occurrences filtered by year, month and status', async () => {
      prisma.fixedTransactionOccurrence.findMany.mockResolvedValue([baseOccurrence]);

      const result = await service.listAllByUser(userId, { year: 2025, month: 1, status: 'PENDING' });

      expect(prisma.fixedTransactionOccurrence.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          status: 'PENDING',
          periodYear: 2025,
          periodMonth: 1,
        },
      });
      expect(result).toHaveLength(1);
    });

    it('should allow listing without status filter', async () => {
      prisma.fixedTransactionOccurrence.findMany.mockResolvedValue([baseOccurrence]);

      await service.listAllByUser(userId, { year: 2025, month: 1 });

      expect(prisma.fixedTransactionOccurrence.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          status: undefined,
          periodYear: 2025,
          periodMonth: 1,
        },
      });
    });
  });

  describe('confirmOccurrence', () => {
    it('should create transaction and confirm occurrence', async () => {
      prisma.fixedTransactionOccurrence.findUnique.mockResolvedValue(baseOccurrence);
      fixedTransactionsService.findById.mockResolvedValue(baseFixedTransaction as any);
      transactionsService.create.mockResolvedValue({ id: transactionId } as any);
      prisma.fixedTransactionOccurrence.update.mockResolvedValue({
        ...baseOccurrence,
        status: 'CONFIRMED',
        transactionId,
      });

      const result = await service.confirmOccurrence(userId, occurrenceId);

      expect(fixedTransactionsService.findById).toHaveBeenCalledWith(userId, fixedTransactionId);
      expect(transactionsService.create).toHaveBeenCalled();
      expect(prisma.fixedTransactionOccurrence.update).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: 'CONFIRMED', transactionId }),
        where: { id: occurrenceId },
      });
      expect(result.status).toBe('CONFIRMED');
    });

    it('should use provided realDate when given', async () => {
      const realDate = '2025-01-10T00:00:00Z';
      prisma.fixedTransactionOccurrence.findUnique.mockResolvedValue(baseOccurrence);
      fixedTransactionsService.findById.mockResolvedValue(baseFixedTransaction as any);
      transactionsService.create.mockResolvedValue({ id: transactionId } as any);
      prisma.fixedTransactionOccurrence.update.mockResolvedValue({
        ...baseOccurrence,
        status: 'CONFIRMED',
        transactionId,
        realDate,
      });

      const result = await service.confirmOccurrence(userId, occurrenceId, realDate);

      expect(transactionsService.create).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ date: realDate }),
      );
      expect(result.realDate).toBe(realDate);
    });

    it('should return existing occurrence if already confirmed', async () => {
      prisma.fixedTransactionOccurrence.findUnique.mockResolvedValue({
        ...baseOccurrence,
        status: 'CONFIRMED',
        transactionId,
      });

      const result = await service.confirmOccurrence(userId, occurrenceId);

      expect(transactionsService.create).not.toHaveBeenCalled();
      expect(result.status).toBe('CONFIRMED');
    });

    it('should throw NotFoundException when occurrence does not exist', async () => {
      prisma.fixedTransactionOccurrence.findUnique.mockResolvedValue(null);

      await expect(service.confirmOccurrence(userId, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when occurrence belongs to another user', async () => {
      prisma.fixedTransactionOccurrence.findUnique.mockResolvedValue({
        ...baseOccurrence,
        userId: 'other-user',
      });

      await expect(service.confirmOccurrence(userId, occurrenceId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('skipOccurrence', () => {
    it('should mark occurrence as skipped', async () => {
      prisma.fixedTransactionOccurrence.findUnique.mockResolvedValue(baseOccurrence);
      prisma.fixedTransactionOccurrence.update.mockResolvedValue({
        ...baseOccurrence,
        status: 'SKIPPED',
      });

      const result = await service.skipOccurrence(userId, occurrenceId);

      expect(prisma.fixedTransactionOccurrence.update).toHaveBeenCalledWith({
        data: { status: 'SKIPPED' },
        where: { id: occurrenceId },
      });
      expect(result.status).toBe('SKIPPED');
    });

    it('should throw NotFoundException when occurrence does not exist', async () => {
      prisma.fixedTransactionOccurrence.findUnique.mockResolvedValue(null);

      await expect(service.skipOccurrence(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when occurrence belongs to another user', async () => {
      prisma.fixedTransactionOccurrence.findUnique.mockResolvedValue({
        ...baseOccurrence,
        userId: 'other-user',
      });

      await expect(service.skipOccurrence(userId, occurrenceId)).rejects.toThrow(ForbiddenException);
    });
  });
});
