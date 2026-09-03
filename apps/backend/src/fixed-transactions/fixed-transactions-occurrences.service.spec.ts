import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { fromCivilDate } from '../common/civil-date';
import { createMockPrismaService, type MockedPrismaService } from '../prisma/prisma.mock';
import { PrismaService } from '../prisma/prisma.service';
import { FixedTransactionsOccurrencesService } from './fixed-transactions-occurrences.service';

const userId = 'user-1';
const occurrenceId = '550e8400-e29b-41d4-a716-446655440004';
const fixedTransactionId = '550e8400-e29b-41d4-a716-446655440003';
const accountId = '550e8400-e29b-41d4-a716-446655440001';
const categoryId = '550e8400-e29b-41d4-a716-446655440002';
const transactionId = '550e8400-e29b-41d4-a716-446655440005';

/** Due 2026-04-10 with a 3-day margin, so the window is 2026-04-07 .. 2026-04-13. */
const pendingOccurrence = {
  id: occurrenceId,
  fixedTransactionId,
  userId,
  periodYear: 2026,
  periodMonth: 4,
  status: 'pending' as const,
  realDate: null,
  dueDate: new Date('2026-04-10T00:00:00.000Z'),
  transactionId: null,
  type: 'expense' as const,
  value: 1250.9,
  description: 'Aluguel',
  categoryId,
  accountId,
  creditCardId: null,
  createdAt: new Date('2026-03-01T03:00:00.000Z'),
  updatedAt: new Date('2026-03-01T03:00:00.000Z'),
  fixedTransaction: { id: fixedTransactionId, description: 'Aluguel', referenceDay: 10, marginDays: 3 },
  category: { id: categoryId, name: 'Moradia', type: 'expense' as const },
};

describe('FixedTransactionsOccurrencesService', () => {
  let service: FixedTransactionsOccurrencesService;
  let prisma: MockedPrismaService;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [FixedTransactionsOccurrencesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(FixedTransactionsOccurrencesService);
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // Listing
  // -------------------------------------------------------------------------

  describe('list', () => {
    it('omits year/month from the filter when they are not supplied (no NaN in the where)', async () => {
      prisma.fixedTransactionOccurrence.findMany.mockResolvedValue([pendingOccurrence]);
      prisma.fixedTransactionOccurrence.count.mockResolvedValue(1);

      const result = await service.list(userId, { page: 1, limit: 20 });

      expect(prisma.fixedTransactionOccurrence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId }, take: 20, skip: 0 }),
      );
      expect(result.meta.totalItems).toBe(1);
      expect(result.data[0].dueDate).toBe('2026-04-10');
      expect(result.data[0].value).toBe(1250.9);
      expect(result.data[0].fixedTransaction).toEqual({
        id: fixedTransactionId,
        description: 'Aluguel',
        referenceDay: 10,
      });
      // marginDays is selected for the confirm window but is not part of the contract.
      expect(result.data[0].fixedTransaction).not.toHaveProperty('marginDays');
    });

    it('applies every optional filter that is supplied', async () => {
      prisma.fixedTransactionOccurrence.findMany.mockResolvedValue([]);
      prisma.fixedTransactionOccurrence.count.mockResolvedValue(0);

      await service.list(userId, { page: 2, limit: 5, year: 2026, month: 4, status: 'pending', fixedTransactionId });

      expect(prisma.fixedTransactionOccurrence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, periodYear: 2026, periodMonth: 4, status: 'pending', fixedTransactionId },
          skip: 5,
          take: 5,
        }),
      );
    });
  });

  describe('findPendingForPeriod', () => {
    it('filters by an inclusive due-date range and always caps the result set', async () => {
      prisma.fixedTransactionOccurrence.findMany.mockResolvedValue([pendingOccurrence]);

      const result = await service.findPendingForPeriod(userId, '2026-04-01', '2026-04-30', 5);

      expect(prisma.fixedTransactionOccurrence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId,
            status: 'pending',
            // The last day of the range is genuinely included.
            dueDate: { gte: fromCivilDate('2026-04-01'), lt: fromCivilDate('2026-05-01') },
          },
          take: 5,
        }),
      );
      expect(result).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // pending -> confirmed
  // -------------------------------------------------------------------------

  describe('confirm', () => {
    /** The pre-flight read sees `pending`; the read-back sees the confirmed row. */
    function arrangeHappyPath() {
      prisma.fixedTransactionOccurrence.findFirst
        .mockResolvedValueOnce(pendingOccurrence)
        .mockResolvedValue({
          ...pendingOccurrence,
          status: 'confirmed',
          realDate: new Date('2026-04-10T00:00:00.000Z'),
          transactionId,
        });
      prisma.fixedTransactionOccurrence.updateMany.mockResolvedValue({ count: 1 });
      prisma.transaction.create.mockResolvedValue({ id: transactionId });
    }

    it('moves pending -> confirmed and books the transaction on the due date by default', async () => {
      arrangeHappyPath();

      const result = await service.confirm(userId, occurrenceId, {});

      // status, realDate and the link move in one statement, as the CHECK
      // constraint `confirmed_has_transaction` requires.
      expect(prisma.fixedTransactionOccurrence.updateMany).toHaveBeenCalledWith({
        where: { id: occurrenceId, userId, status: 'pending' },
        data: { status: 'confirmed', realDate: fromCivilDate('2026-04-10'), value: 1250.9, transactionId },
      });
      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: {
          userId,
          type: 'expense',
          value: 1250.9,
          date: fromCivilDate('2026-04-10'),
          accountId,
          creditCardId: null,
          categoryId,
          description: 'Aluguel',
          source: 'fixed',
        },
        select: { id: true },
      });
      expect(result.status).toBe('confirmed');
      expect(result.transactionId).toBe(transactionId);
      expect(result.realDate).toBe('2026-04-10');
    });

    it('books on realDate when it is inside the margin window', async () => {
      arrangeHappyPath();

      await service.confirm(userId, occurrenceId, { realDate: '2026-04-13' });

      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ date: fromCivilDate('2026-04-13') }) }),
      );
    });

    it('honours a per-period value override on both the transaction and the occurrence', async () => {
      arrangeHappyPath();

      await service.confirm(userId, occurrenceId, { value: 1310.55 });

      expect(prisma.fixedTransactionOccurrence.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ value: 1310.55 }) }),
      );
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ value: 1310.55 }) }),
      );
    });

    it('rejects a realDate outside the margin window, before touching anything', async () => {
      prisma.fixedTransactionOccurrence.findFirst.mockResolvedValue(pendingOccurrence);

      await expect(service.confirm(userId, occurrenceId, { realDate: '2026-04-20' })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('falls back to the competence month when the template has no margin', async () => {
      prisma.fixedTransactionOccurrence.findFirst.mockResolvedValue({
        ...pendingOccurrence,
        fixedTransaction: { ...pendingOccurrence.fixedTransaction, marginDays: 0 },
      });
      prisma.fixedTransactionOccurrence.updateMany.mockResolvedValue({ count: 1 });
      prisma.transaction.create.mockResolvedValue({ id: transactionId });

      // Far from the due day, but still April 2026.
      await expect(service.confirm(userId, occurrenceId, { realDate: '2026-04-28' })).resolves.toBeDefined();

      // May is a different competence period.
      await expect(service.confirm(userId, occurrenceId, { realDate: '2026-05-01' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a syntactically valid but impossible calendar day', async () => {
      prisma.fixedTransactionOccurrence.findFirst.mockResolvedValue(pendingOccurrence);

      await expect(service.confirm(userId, occurrenceId, { realDate: '2026-02-30' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('404s (never 403) for an occurrence belonging to somebody else', async () => {
      prisma.fixedTransactionOccurrence.findFirst.mockResolvedValue(null);

      await expect(service.confirm(userId, occurrenceId, {})).rejects.toThrow(NotFoundException);
    });

    it('409s when the occurrence was already skipped (skipped -> confirmed is illegal)', async () => {
      prisma.fixedTransactionOccurrence.findFirst.mockResolvedValue({ ...pendingOccurrence, status: 'skipped' });

      await expect(service.confirm(userId, occurrenceId, {})).rejects.toThrow(ConflictException);
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('409s when the occurrence was already confirmed', async () => {
      prisma.fixedTransactionOccurrence.findFirst.mockResolvedValue({
        ...pendingOccurrence,
        status: 'confirmed',
        transactionId,
      });

      await expect(service.confirm(userId, occurrenceId, {})).rejects.toThrow(ConflictException);
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Concurrency and crash safety
  // -------------------------------------------------------------------------

  describe('confirm under concurrency', () => {
    it('two simultaneous confirms create exactly one transaction', async () => {
      // Both requests read the row while it is still pending — the flip is what
      // arbitrates, not the read.
      prisma.fixedTransactionOccurrence.findFirst.mockResolvedValue(pendingOccurrence);
      prisma.fixedTransactionOccurrence.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });
      prisma.transaction.create.mockResolvedValue({ id: transactionId });
      prisma.fixedTransactionOccurrence.update.mockResolvedValue({
        ...pendingOccurrence,
        status: 'confirmed',
        transactionId,
      });

      const results = await Promise.allSettled([
        service.confirm(userId, occurrenceId, {}),
        service.confirm(userId, occurrenceId, {}),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(rejected.reason).toBeInstanceOf(ConflictException);
      expect(prisma.transaction.create).toHaveBeenCalledTimes(1);
    });

    it('a failure mid-confirm rolls back: no orphan transaction and the row stays pending', async () => {
      // A tiny store with real rollback semantics, so this asserts the state a
      // retry actually sees rather than just the call order.
      let row: { status: string; realDate: Date | null; transactionId: string | null } = {
        status: 'pending',
        realDate: null,
        transactionId: null,
      };
      const committedTransactions: string[] = [];

      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const rowSnapshot = { ...row };
        const txSnapshot = [...committedTransactions];
        try {
          return await fn(prisma);
        } catch (error) {
          row = rowSnapshot;
          committedTransactions.length = 0;
          committedTransactions.push(...txSnapshot);
          throw error;
        }
      });

      prisma.fixedTransactionOccurrence.findFirst.mockImplementation(async () => ({
        ...pendingOccurrence,
        ...row,
      }));
      prisma.fixedTransactionOccurrence.updateMany.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        if (row.status !== 'pending') return { count: 0 };
        row = { ...row, ...(data as Partial<typeof row>) };
        return { count: 1 };
      });
      prisma.fixedTransactionOccurrence.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        row = { ...row, ...(data as Partial<typeof row>) };
        return { ...pendingOccurrence, ...row };
      });

      let attempt = 0;
      prisma.transaction.create.mockImplementation(async () => {
        attempt += 1;
        if (attempt === 1) throw new Error('conexão perdida');
        committedTransactions.push(transactionId);
        return { id: transactionId };
      });

      // First attempt blows up after the row was claimed.
      await expect(service.confirm(userId, occurrenceId, {})).rejects.toThrow('conexão perdida');
      expect(committedTransactions).toHaveLength(0);
      expect(row.status).toBe('pending');
      expect(row.transactionId).toBeNull();

      // The retry succeeds, and there is still exactly one transaction.
      const retried = await service.confirm(userId, occurrenceId, {});

      expect(retried.status).toBe('confirmed');
      expect(committedTransactions).toEqual([transactionId]);
      expect(row.transactionId).toBe(transactionId);
    });
  });

  // -------------------------------------------------------------------------
  // pending -> skipped
  // -------------------------------------------------------------------------

  describe('skip', () => {
    it('moves pending -> skipped without creating a transaction', async () => {
      prisma.fixedTransactionOccurrence.findFirst
        .mockResolvedValueOnce(pendingOccurrence)
        .mockResolvedValueOnce({ ...pendingOccurrence, status: 'skipped' });
      prisma.fixedTransactionOccurrence.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.skip(userId, occurrenceId);

      expect(prisma.fixedTransactionOccurrence.updateMany).toHaveBeenCalledWith({
        where: { id: occurrenceId, userId, status: 'pending' },
        data: { status: 'skipped' },
      });
      expect(result.status).toBe('skipped');
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('409s when the occurrence was already confirmed (confirmed -> skipped is illegal)', async () => {
      prisma.fixedTransactionOccurrence.findFirst.mockResolvedValue({
        ...pendingOccurrence,
        status: 'confirmed',
        transactionId,
      });

      await expect(service.skip(userId, occurrenceId)).rejects.toThrow(ConflictException);
      expect(prisma.fixedTransactionOccurrence.updateMany).not.toHaveBeenCalled();
    });

    it('409s when the occurrence was already skipped', async () => {
      prisma.fixedTransactionOccurrence.findFirst.mockResolvedValue({ ...pendingOccurrence, status: 'skipped' });

      await expect(service.skip(userId, occurrenceId)).rejects.toThrow(ConflictException);
      expect(prisma.fixedTransactionOccurrence.updateMany).not.toHaveBeenCalled();
    });

    it('409s when a concurrent request wins the flip', async () => {
      prisma.fixedTransactionOccurrence.findFirst.mockResolvedValue(pendingOccurrence);
      prisma.fixedTransactionOccurrence.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.skip(userId, occurrenceId)).rejects.toThrow(ConflictException);
    });

    it('404s for an occurrence belonging to somebody else', async () => {
      prisma.fixedTransactionOccurrence.findFirst.mockResolvedValue(null);

      await expect(service.skip(userId, occurrenceId)).rejects.toThrow(NotFoundException);
    });
  });
});
