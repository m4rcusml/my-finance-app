import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { fromCivilDate } from '../common/civil-date';
import { createMockPrismaService, type MockedPrismaService } from '../prisma/prisma.mock';
import { PrismaService } from '../prisma/prisma.service';
import { BACKFILL_MONTHS, FixedTransactionsJob, TEMPLATE_BATCH_SIZE } from './fixed-transactions.job';

const TIME_ZONE = 'America/Sao_Paulo';
const userId = 'user-1';

function template(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fixed-1',
    userId,
    type: 'expense' as const,
    value: 1250.9,
    referenceDay: 10,
    marginDays: 3,
    accountId: 'account-1',
    creditCardId: null,
    categoryId: 'category-1',
    description: 'Aluguel',
    createdAt: new Date('2020-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

/** The `create` payload of the nth upsert call. */
function createPayload(mock: jest.Mock, index = 0): Record<string, unknown> {
  return mock.mock.calls[index][0].create as Record<string, unknown>;
}

describe('FixedTransactionsJob', () => {
  let job: FixedTransactionsJob;
  let prisma: MockedPrismaService;
  let enableCron: boolean;

  beforeEach(async () => {
    prisma = createMockPrismaService();
    enableCron = true;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FixedTransactionsJob,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => (key === 'APP_TIMEZONE' ? TIME_ZONE : enableCron)),
          },
        },
      ],
    }).compile();

    job = module.get(FixedTransactionsJob);

    prisma.fixedTransaction.findMany.mockResolvedValue([]);
    prisma.fixedTransactionOccurrence.findMany.mockResolvedValue([]);
    prisma.fixedTransactionOccurrence.upsert.mockResolvedValue({ id: 'occ-1' });
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------

  describe('generation', () => {
    it('upserts on the (template, year, month) unique key so a rerun cannot duplicate', async () => {
      prisma.fixedTransaction.findMany.mockResolvedValue([template()]);

      await job.run('2026-04-15');

      const call = prisma.fixedTransactionOccurrence.upsert.mock.calls[0][0];
      expect(call.where).toEqual({
        fixedTransactionId_periodYear_periodMonth: {
          fixedTransactionId: 'fixed-1',
          periodYear: 2026,
          periodMonth: 4,
        },
      });
      // An existing period is left exactly as the user left it.
      expect(call.update).toEqual({});
      expect(call.create).toMatchObject({
        userId,
        status: 'pending',
        periodYear: 2026,
        periodMonth: 4,
        dueDate: fromCivilDate('2026-04-10'),
        type: 'expense',
        value: 1250.9,
        categoryId: 'category-1',
        accountId: 'account-1',
        creditCardId: null,
      });
    });

    it('clamps referenceDay 31 to the last day of February', async () => {
      prisma.fixedTransaction.findMany.mockResolvedValue([template({ referenceDay: 31 })]);

      const summary = await job.run('2026-02-15');

      // 2026 is not a leap year.
      expect(createPayload(prisma.fixedTransactionOccurrence.upsert).dueDate).toEqual(fromCivilDate('2026-02-28'));
      expect(summary.createdOccurrences).toBeGreaterThan(0);
    });

    it('clamps referenceDay 31 to the 29th in a leap February', async () => {
      prisma.fixedTransaction.findMany.mockResolvedValue([template({ referenceDay: 31 })]);

      await job.run('2028-02-20');

      expect(createPayload(prisma.fixedTransactionOccurrence.upsert).dueDate).toEqual(fromCivilDate('2028-02-29'));
    });

    it('carries a card recurrence through to the occurrence snapshot', async () => {
      prisma.fixedTransaction.findMany.mockResolvedValue([
        template({ accountId: null, creditCardId: 'card-1', type: 'income' }),
      ]);

      await job.run('2026-04-15');

      expect(createPayload(prisma.fixedTransactionOccurrence.upsert)).toMatchObject({
        accountId: null,
        creditCardId: 'card-1',
        type: 'income',
      });
    });

    it('skips periods that ended before the template existed', async () => {
      prisma.fixedTransaction.findMany.mockResolvedValue([
        template({ createdAt: new Date('2026-04-02T00:00:00.000Z') }),
      ]);

      const summary = await job.run('2026-04-15');

      expect(prisma.fixedTransactionOccurrence.upsert).toHaveBeenCalledTimes(1);
      expect(summary.createdOccurrences).toBe(1);
    });
  });

  // -------------------------------------------------------------------------

  describe('backfill', () => {
    it('fills in the periods a missed run skipped, without touching the one that exists', async () => {
      prisma.fixedTransaction.findMany.mockResolvedValue([template()]);
      // The cron last ran in January; February and March were lost.
      prisma.fixedTransactionOccurrence.findMany.mockResolvedValue([
        { fixedTransactionId: 'fixed-1', periodYear: 2026, periodMonth: 1 },
      ]);

      const summary = await job.run('2026-03-20');

      expect(summary.periods).toEqual([
        { year: 2026, month: 3 },
        { year: 2026, month: 2 },
        { year: 2026, month: 1 },
      ]);
      expect(summary.createdOccurrences).toBe(2);
      expect(summary.existingOccurrences).toBe(1);

      const written = prisma.fixedTransactionOccurrence.upsert.mock.calls.map((call) => {
        const create = call[0].create as { periodYear: number; periodMonth: number; dueDate: Date };
        return { periodYear: create.periodYear, periodMonth: create.periodMonth, dueDate: create.dueDate };
      });
      expect(written).toEqual([
        { periodYear: 2026, periodMonth: 3, dueDate: fromCivilDate('2026-03-10') },
        { periodYear: 2026, periodMonth: 2, dueDate: fromCivilDate('2026-02-10') },
      ]);
    });

    it('crosses the year boundary when backfilling January', async () => {
      prisma.fixedTransaction.findMany.mockResolvedValue([template()]);

      const summary = await job.run('2026-01-05');

      expect(summary.periods).toEqual([
        { year: 2026, month: 1 },
        { year: 2025, month: 12 },
        { year: 2025, month: 11 },
      ]);
      expect(summary.createdOccurrences).toBe(BACKFILL_MONTHS + 1);
    });

    it('is a no-op the second time it runs on the same day', async () => {
      prisma.fixedTransaction.findMany.mockResolvedValue([template()]);
      prisma.fixedTransactionOccurrence.findMany.mockResolvedValue([
        { fixedTransactionId: 'fixed-1', periodYear: 2026, periodMonth: 4 },
        { fixedTransactionId: 'fixed-1', periodYear: 2026, periodMonth: 3 },
        { fixedTransactionId: 'fixed-1', periodYear: 2026, periodMonth: 2 },
      ]);

      const summary = await job.run('2026-04-15');

      expect(prisma.fixedTransactionOccurrence.upsert).not.toHaveBeenCalled();
      expect(summary.createdOccurrences).toBe(0);
      expect(summary.existingOccurrences).toBe(3);
    });
  });

  // -------------------------------------------------------------------------

  describe('resilience', () => {
    it('one failing template does not abort the run', async () => {
      prisma.fixedTransaction.findMany.mockResolvedValue([
        template({ id: 'broken', createdAt: new Date('2026-04-02T00:00:00.000Z') }),
        template({ id: 'healthy', createdAt: new Date('2026-04-02T00:00:00.000Z') }),
      ]);
      prisma.fixedTransactionOccurrence.upsert
        .mockRejectedValueOnce(new Error('categoria removida'))
        .mockResolvedValue({ id: 'occ-ok' });

      const summary = await job.run('2026-04-15');

      expect(summary.failedTemplates).toBe(1);
      expect(summary.createdOccurrences).toBe(1);
      expect(summary.scannedTemplates).toBe(2);
    });

    it('treats a losing race (unique violation) as "already generated", not a failure', async () => {
      prisma.fixedTransaction.findMany.mockResolvedValue([
        template({ createdAt: new Date('2026-04-02T00:00:00.000Z') }),
      ]);
      prisma.fixedTransactionOccurrence.upsert.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 'P2002' }));

      const summary = await job.run('2026-04-15');

      expect(summary.failedTemplates).toBe(0);
      expect(summary.createdOccurrences).toBe(0);
      expect(summary.existingOccurrences).toBe(1);
    });

    it('fetches templates for every user in one query per batch, not one per user', async () => {
      prisma.fixedTransaction.findMany.mockResolvedValue([
        template({ id: 'fixed-a', userId: 'user-a' }),
        template({ id: 'fixed-b', userId: 'user-b' }),
        template({ id: 'fixed-c', userId: 'user-c' }),
      ]);

      await job.run('2026-04-15');

      expect(prisma.fixedTransaction.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.fixedTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true }, take: TEMPLATE_BATCH_SIZE, orderBy: { id: 'asc' } }),
      );
      // Existence is resolved in a single query for the whole batch.
      expect(prisma.fixedTransactionOccurrence.findMany).toHaveBeenCalledTimes(1);
    });

    it('pages by id cursor rather than an arbitrary take', async () => {
      const fullPage = Array.from({ length: TEMPLATE_BATCH_SIZE }, (_, index) =>
        template({ id: `fixed-${String(index).padStart(4, '0')}` }),
      );
      prisma.fixedTransaction.findMany
        .mockResolvedValueOnce(fullPage)
        .mockResolvedValueOnce([template({ id: 'fixed-last' })]);

      const summary = await job.run('2026-04-15');

      expect(prisma.fixedTransaction.findMany).toHaveBeenCalledTimes(2);
      expect(prisma.fixedTransaction.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          cursor: { id: `fixed-${String(TEMPLATE_BATCH_SIZE - 1).padStart(4, '0')}` },
          skip: 1,
        }),
      );
      expect(summary.scannedTemplates).toBe(TEMPLATE_BATCH_SIZE + 1);
    });
  });

  // -------------------------------------------------------------------------

  describe('handleCron', () => {
    it('does nothing when ENABLE_CRON is false', async () => {
      enableCron = false;

      await job.handleCron();

      expect(prisma.fixedTransaction.findMany).not.toHaveBeenCalled();
    });

    it('runs when ENABLE_CRON is true', async () => {
      prisma.fixedTransaction.findMany.mockResolvedValue([]);

      await job.handleCron();

      expect(prisma.fixedTransaction.findMany).toHaveBeenCalledTimes(1);
    });

    it('never rejects into the scheduler, even when the database is down', async () => {
      prisma.fixedTransaction.findMany.mockRejectedValue(new Error('banco indisponível'));

      await expect(job.handleCron()).resolves.toBeUndefined();
    });
  });
});
