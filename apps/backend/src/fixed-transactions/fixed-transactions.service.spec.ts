import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { fromCivilDate } from '../common/civil-date';
import { createMockPrismaService, type MockedPrismaService } from '../prisma/prisma.mock';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateFixedTransactionDto, UpdateFixedTransactionDto } from './fixed-transactions.dto';
import { FixedTransactionsService } from './fixed-transactions.service';
import { currentPeriod } from './recurrence';

const TIME_ZONE = 'America/Sao_Paulo';

const userId = 'user-1';
const fixedId = '550e8400-e29b-41d4-a716-446655440003';
const accountId = '550e8400-e29b-41d4-a716-446655440001';
const categoryId = '550e8400-e29b-41d4-a716-446655440002';
const creditCardId = '550e8400-e29b-41d4-a716-446655440009';

const baseTemplate = {
  id: fixedId,
  userId,
  type: 'expense' as const,
  value: 1250.9,
  referenceDay: 10,
  marginDays: 3,
  accountId,
  creditCardId: null,
  categoryId,
  description: 'Aluguel',
  isActive: true,
  archivedAt: null,
  createdAt: new Date('2026-01-05T12:00:00.000Z'),
  updatedAt: new Date('2026-01-05T12:00:00.000Z'),
};

describe('FixedTransactionsService', () => {
  let service: FixedTransactionsService;
  let prisma: MockedPrismaService;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FixedTransactionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn(() => TIME_ZONE) } },
      ],
    }).compile();

    service = module.get(FixedTransactionsService);

    // Sane defaults so propagation paths do not iterate `undefined`.
    prisma.fixedTransactionOccurrence.updateMany.mockResolvedValue({ count: 0 });
    prisma.fixedTransactionOccurrence.deleteMany.mockResolvedValue({ count: 0 });
    prisma.fixedTransactionOccurrence.findMany.mockResolvedValue([]);
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------

  describe('create', () => {
    const dto: CreateFixedTransactionDto = {
      type: 'expense',
      value: 1250.9,
      referenceDay: 10,
      marginDays: 3,
      accountId,
      categoryId,
      description: 'Aluguel',
    };

    it('creates an account-backed template and returns the contract shape', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: categoryId, userId });
      prisma.account.findFirst.mockResolvedValue({ id: accountId, userId });
      prisma.fixedTransaction.create.mockResolvedValue(baseTemplate);

      const result = await service.create(userId, dto);

      expect(prisma.fixedTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId, accountId, creditCardId: null, marginDays: 3 }),
      });
      expect(result).toEqual({
        id: fixedId,
        type: 'expense',
        value: 1250.9,
        referenceDay: 10,
        marginDays: 3,
        accountId,
        creditCardId: null,
        categoryId,
        description: 'Aluguel',
        isActive: true,
        archivedAt: null,
        createdAt: '2026-01-05T12:00:00.000Z',
        updatedAt: '2026-01-05T12:00:00.000Z',
      });
    });

    it('creates a card-backed template (the old DTO made these unreachable)', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: categoryId, userId });
      prisma.creditCard.findFirst.mockResolvedValue({ id: creditCardId, userId });
      prisma.fixedTransaction.create.mockResolvedValue({ ...baseTemplate, accountId: null, creditCardId });

      const result = await service.create(userId, { ...dto, accountId: null, creditCardId });

      expect(prisma.creditCard.findFirst).toHaveBeenCalledWith({
        where: { id: creditCardId, userId },
        select: { id: true, userId: true },
      });
      expect(prisma.account.findFirst).not.toHaveBeenCalled();
      expect(result.creditCardId).toBe(creditCardId);
      expect(result.accountId).toBeNull();
    });

    it('rejects two sources', async () => {
      await expect(service.create(userId, { ...dto, creditCardId })).rejects.toThrow(BadRequestException);
      expect(prisma.fixedTransaction.create).not.toHaveBeenCalled();
    });

    it('rejects no source at all', async () => {
      await expect(service.create(userId, { ...dto, accountId: null })).rejects.toThrow(BadRequestException);
      expect(prisma.fixedTransaction.create).not.toHaveBeenCalled();
    });

    it('404s on a category owned by somebody else', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(service.create(userId, dto)).rejects.toThrow(NotFoundException);
      expect(prisma.fixedTransaction.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------

  describe('findAll', () => {
    it('always returns the paginated envelope', async () => {
      prisma.fixedTransaction.findMany.mockResolvedValue([baseTemplate]);
      prisma.fixedTransaction.count.mockResolvedValue(1);

      const result = await service.findAll(userId, { page: 1, limit: 20 });

      expect(prisma.fixedTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId }, take: 20, skip: 0 }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        totalItems: 1,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      });
    });

    it('filters by isActive when asked', async () => {
      prisma.fixedTransaction.findMany.mockResolvedValue([]);
      prisma.fixedTransaction.count.mockResolvedValue(0);

      await service.findAll(userId, { page: 1, limit: 20, isActive: false });

      expect(prisma.fixedTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId, isActive: false } }),
      );
    });
  });

  describe('findOne', () => {
    it('404s instead of 403 for another user row', async () => {
      prisma.fixedTransaction.findFirst.mockResolvedValue(null);

      await expect(service.findOne(userId, fixedId)).rejects.toThrow(NotFoundException);
      expect(prisma.fixedTransaction.findFirst).toHaveBeenCalledWith({ where: { id: fixedId, userId } });
    });
  });

  // -------------------------------------------------------------------------

  describe('update', () => {
    it('leaves omitted keys untouched and writes the final state', async () => {
      prisma.fixedTransaction.findFirst.mockResolvedValue(baseTemplate);
      prisma.fixedTransaction.update.mockResolvedValue({ ...baseTemplate, value: 1400 });

      const dto: UpdateFixedTransactionDto = { value: 1400 };
      await service.update(userId, fixedId, dto);

      expect(prisma.fixedTransaction.update).toHaveBeenCalledWith({
        where: { id: fixedId },
        data: expect.objectContaining({
          value: 1400,
          type: 'expense',
          referenceDay: 10,
          marginDays: 3,
          accountId,
          creditCardId: null,
          categoryId,
          description: 'Aluguel',
          isActive: true,
        }),
      });
    });

    it('treats an explicit null as "clear this relation" and validates the final state', async () => {
      prisma.fixedTransaction.findFirst.mockResolvedValue(baseTemplate);

      // Clearing the only source leaves the row with none — rejected as a whole.
      await expect(service.update(userId, fixedId, { accountId: null })).rejects.toThrow(BadRequestException);
      expect(prisma.fixedTransaction.update).not.toHaveBeenCalled();
    });

    it('accepts swapping an account for a card in a single patch', async () => {
      prisma.fixedTransaction.findFirst.mockResolvedValue(baseTemplate);
      prisma.creditCard.findFirst.mockResolvedValue({ id: creditCardId, userId });
      prisma.fixedTransaction.update.mockResolvedValue({ ...baseTemplate, accountId: null, creditCardId });

      const result = await service.update(userId, fixedId, { accountId: null, creditCardId });

      expect(result.accountId).toBeNull();
      expect(result.creditCardId).toBe(creditCardId);
    });

    it('propagates only to pending occurrences of strictly future periods', async () => {
      const period = currentPeriod(TIME_ZONE);
      prisma.fixedTransaction.findFirst.mockResolvedValue(baseTemplate);
      prisma.fixedTransaction.update.mockResolvedValue({ ...baseTemplate, value: 1400 });

      await service.update(userId, fixedId, { value: 1400 });

      expect(prisma.fixedTransactionOccurrence.updateMany).toHaveBeenCalledWith({
        where: {
          fixedTransactionId: fixedId,
          userId,
          status: 'pending',
          OR: [
            { periodYear: { gt: period.year } },
            { periodYear: period.year, periodMonth: { gt: period.month } },
          ],
        },
        data: expect.objectContaining({ value: 1400 }),
      });
    });

    it('recomputes dueDate per period when referenceDay changes', async () => {
      prisma.fixedTransaction.findFirst.mockResolvedValue(baseTemplate);
      prisma.fixedTransaction.update.mockResolvedValue({ ...baseTemplate, referenceDay: 31 });
      prisma.fixedTransactionOccurrence.findMany.mockResolvedValue([
        { id: 'occ-feb', periodYear: 2028, periodMonth: 2 },
        { id: 'occ-mar', periodYear: 2028, periodMonth: 3 },
      ]);

      await service.update(userId, fixedId, { referenceDay: 31 });

      // 2028 is a leap year: the 31st clamps to the 29th.
      expect(prisma.fixedTransactionOccurrence.update).toHaveBeenCalledWith({
        where: { id: 'occ-feb' },
        data: { dueDate: fromCivilDate('2028-02-29') },
      });
      expect(prisma.fixedTransactionOccurrence.update).toHaveBeenCalledWith({
        where: { id: 'occ-mar' },
        data: { dueDate: fromCivilDate('2028-03-31') },
      });
    });

    it('deactivating drops only future pending placeholders and stamps archivedAt', async () => {
      const period = currentPeriod(TIME_ZONE);
      prisma.fixedTransaction.findFirst.mockResolvedValue(baseTemplate);
      prisma.fixedTransaction.update.mockResolvedValue({ ...baseTemplate, isActive: false, archivedAt: new Date() });

      await service.update(userId, fixedId, { isActive: false });

      expect(prisma.fixedTransaction.update).toHaveBeenCalledWith({
        where: { id: fixedId },
        data: expect.objectContaining({ isActive: false, archivedAt: expect.any(Date) }),
      });
      expect(prisma.fixedTransactionOccurrence.deleteMany).toHaveBeenCalledWith({
        where: {
          fixedTransactionId: fixedId,
          userId,
          status: 'pending',
          transactionId: null,
          OR: [
            { periodYear: { gt: period.year } },
            { periodYear: period.year, periodMonth: { gt: period.month } },
          ],
        },
      });
      expect(prisma.fixedTransactionOccurrence.updateMany).not.toHaveBeenCalled();
    });

    it('reactivating clears archivedAt', async () => {
      prisma.fixedTransaction.findFirst.mockResolvedValue({
        ...baseTemplate,
        isActive: false,
        archivedAt: new Date('2026-02-01T00:00:00.000Z'),
      });
      prisma.fixedTransaction.update.mockResolvedValue(baseTemplate);

      await service.update(userId, fixedId, { isActive: true });

      expect(prisma.fixedTransaction.update).toHaveBeenCalledWith({
        where: { id: fixedId },
        data: expect.objectContaining({ isActive: true, archivedAt: null }),
      });
    });

    it('404s for a template the user does not own', async () => {
      prisma.fixedTransaction.findFirst.mockResolvedValue(null);

      await expect(service.update(userId, fixedId, { value: 10 })).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------

  describe('archive / restore / remove', () => {
    it('archives instead of deleting and never calls delete', async () => {
      prisma.fixedTransaction.findFirst.mockResolvedValue(baseTemplate);
      prisma.fixedTransaction.update.mockResolvedValue({
        ...baseTemplate,
        isActive: false,
        archivedAt: new Date('2026-05-01T00:00:00.000Z'),
      });

      const result = await service.archive(userId, fixedId);

      expect(result.isActive).toBe(false);
      expect(result.archivedAt).toBe('2026-05-01T00:00:00.000Z');
      expect(prisma.fixedTransaction.delete).not.toHaveBeenCalled();
      expect(prisma.fixedTransaction.deleteMany).not.toHaveBeenCalled();
    });

    it('archive is a no-op for an already archived template', async () => {
      prisma.fixedTransaction.findFirst.mockResolvedValue({ ...baseTemplate, isActive: false, archivedAt: new Date() });

      await service.archive(userId, fixedId);

      expect(prisma.fixedTransaction.update).not.toHaveBeenCalled();
    });

    it('restore reactivates and clears archivedAt', async () => {
      prisma.fixedTransaction.findFirst.mockResolvedValue({ ...baseTemplate, isActive: false, archivedAt: new Date() });
      prisma.fixedTransaction.update.mockResolvedValue(baseTemplate);

      const result = await service.restore(userId, fixedId);

      expect(prisma.fixedTransaction.update).toHaveBeenCalledWith({
        where: { id: fixedId },
        data: { isActive: true, archivedAt: null },
      });
      expect(result.isActive).toBe(true);
    });

    it('DELETE archives rather than destroying history', async () => {
      prisma.fixedTransaction.findFirst.mockResolvedValue(baseTemplate);
      prisma.fixedTransaction.update.mockResolvedValue({ ...baseTemplate, isActive: false, archivedAt: new Date() });

      await service.remove(userId, fixedId);

      expect(prisma.fixedTransaction.update).toHaveBeenCalledWith({
        where: { id: fixedId },
        data: expect.objectContaining({ isActive: false }),
      });
      expect(prisma.fixedTransaction.delete).not.toHaveBeenCalled();
    });
  });
});
