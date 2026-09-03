import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { fromCivilDate } from '../common/civil-date';
import { createMockPrismaService, type MockedPrismaService } from '../prisma/prisma.mock';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from './transactions.service';

const USER = 'user-1';
const OTHER_USER = 'user-2';
const TX = '550e8400-e29b-41d4-a716-446655440000';
const ACCOUNT = '550e8400-e29b-41d4-a716-446655440001';
const CARD = '550e8400-e29b-41d4-a716-446655440002';
const CATEGORY = '550e8400-e29b-41d4-a716-446655440003';

const CREATED_AT = new Date('2026-04-01T10:00:00.000Z');

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: TX,
    userId: USER,
    type: 'expense',
    value: 100,
    date: new Date('2026-04-01T00:00:00.000Z'),
    accountId: ACCOUNT,
    creditCardId: null,
    categoryId: null,
    description: 'Mercado',
    source: 'manual',
    externalId: null,
    importBatchId: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: MockedPrismaService;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn(() => 'America/Sao_Paulo') } },
      ],
    }).compile();

    service = module.get(TransactionsService);

    prisma.account.findUnique.mockResolvedValue({ id: ACCOUNT, userId: USER, isActive: true });
    prisma.creditCard.findUnique.mockResolvedValue({ id: CARD, userId: USER, isActive: true });
    prisma.category.findUnique.mockResolvedValue({ id: CATEGORY, userId: USER, isActive: true });
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe('create', () => {
    const base = { type: 'expense' as const, value: 100, date: '2026-04-01' };

    it('stores the civil date as a UTC-midnight DATE and defaults source to manual', async () => {
      prisma.transaction.create.mockResolvedValue(row());

      const created = await service.create(USER, { ...base, accountId: ACCOUNT });

      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: USER,
            date: fromCivilDate('2026-04-01'),
            accountId: ACCOUNT,
            creditCardId: null,
            source: 'manual',
            externalId: null,
          }),
        }),
      );
      expect(created.date).toBe('2026-04-01');
      expect(created.value).toBe(100);
      expect(created.createdAt).toBe(CREATED_AT.toISOString());
    });

    it('rejects both sources at once', async () => {
      await expect(service.create(USER, { ...base, accountId: ACCOUNT, creditCardId: CARD })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('rejects no source at all', async () => {
      await expect(service.create(USER, base)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('rejects a calendar-invalid date before it reaches Prisma', async () => {
      await expect(service.create(USER, { ...base, date: '2026-02-31', accountId: ACCOUNT })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('404s on an account owned by somebody else', async () => {
      prisma.account.findUnique.mockResolvedValue({ id: ACCOUNT, userId: OTHER_USER, isActive: true });

      await expect(service.create(USER, { ...base, accountId: ACCOUNT })).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('400s on an archived credit card', async () => {
      prisma.creditCard.findUnique.mockResolvedValue({ id: CARD, userId: USER, isActive: false });

      await expect(service.create(USER, { ...base, creditCardId: CARD })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('400s on an archived category', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: CATEGORY, userId: USER, isActive: false });

      await expect(service.create(USER, { ...base, accountId: ACCOUNT, categoryId: CATEGORY })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('lets the import flow stamp source and externalId', async () => {
      prisma.transaction.create.mockResolvedValue(row({ source: 'imported', externalId: 'ofx-9' }));

      const created = await service.create(
        USER,
        { ...base, accountId: ACCOUNT },
        { source: 'imported', externalId: 'ofx-9' },
      );

      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ source: 'imported', externalId: 'ofx-9' }) }),
      );
      expect(created.source).toBe('imported');
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------

  describe('update', () => {
    it('rejects a patch that would leave both sources set', async () => {
      prisma.transaction.findUnique.mockResolvedValue(row({ accountId: ACCOUNT, creditCardId: null }));

      await expect(service.update(USER, TX, { creditCardId: CARD })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.transaction.update).not.toHaveBeenCalled();
    });

    it('rejects a patch that would leave no source at all', async () => {
      prisma.transaction.findUnique.mockResolvedValue(row({ accountId: ACCOUNT, creditCardId: null }));

      await expect(service.update(USER, TX, { accountId: null })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.transaction.update).not.toHaveBeenCalled();
    });

    it('moves an account-backed row to a card when the account is cleared in the same patch', async () => {
      prisma.transaction.findUnique.mockResolvedValue(row({ accountId: ACCOUNT, creditCardId: null }));
      prisma.transaction.update.mockResolvedValue(row({ accountId: null, creditCardId: CARD }));

      const updated = await service.update(USER, TX, { accountId: null, creditCardId: CARD });

      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: TX },
        data: { accountId: null, creditCardId: CARD },
      });
      expect(updated.accountId).toBeNull();
      expect(updated.creditCardId).toBe(CARD);
    });

    it('leaves omitted keys untouched and never re-validates an unchanged relation', async () => {
      prisma.transaction.findUnique.mockResolvedValue(row());
      prisma.transaction.update.mockResolvedValue(row({ description: 'Feira' }));

      await service.update(USER, TX, { description: 'Feira' });

      expect(prisma.account.findUnique).not.toHaveBeenCalled();
      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: TX },
        data: { description: 'Feira' },
      });
    });

    it('clears the category with an explicit null', async () => {
      prisma.transaction.findUnique.mockResolvedValue(row({ categoryId: CATEGORY }));
      prisma.transaction.update.mockResolvedValue(row({ categoryId: null }));

      await service.update(USER, TX, { categoryId: null });

      expect(prisma.category.findUnique).not.toHaveBeenCalled();
      expect(prisma.transaction.update).toHaveBeenCalledWith({ where: { id: TX }, data: { categoryId: null } });
    });

    it('400s when the patch points at an archived account', async () => {
      const otherAccount = '550e8400-e29b-41d4-a716-446655440004';
      prisma.transaction.findUnique.mockResolvedValue(row({ accountId: ACCOUNT }));
      prisma.account.findUnique.mockResolvedValue({ id: otherAccount, userId: USER, isActive: false });

      await expect(service.update(USER, TX, { accountId: otherAccount })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.transaction.update).not.toHaveBeenCalled();
    });

    it('404s on another user’s transaction', async () => {
      prisma.transaction.findUnique.mockResolvedValue(row({ userId: OTHER_USER }));

      await expect(service.update(USER, TX, { description: 'x' })).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.transaction.update).not.toHaveBeenCalled();
    });

    it('converts a patched date to a UTC-midnight DATE', async () => {
      prisma.transaction.findUnique.mockResolvedValue(row());
      prisma.transaction.update.mockResolvedValue(row({ date: new Date('2026-05-09T00:00:00.000Z') }));

      const updated = await service.update(USER, TX, { date: '2026-05-09' });

      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: TX },
        data: { date: fromCivilDate('2026-05-09') },
      });
      expect(updated.date).toBe('2026-05-09');
    });
  });

  // -------------------------------------------------------------------------
  // remove
  // -------------------------------------------------------------------------

  describe('remove', () => {
    it('deletes a plain manual transaction', async () => {
      prisma.transaction.findUnique.mockResolvedValue(row());
      prisma.fixedTransactionOccurrence.findFirst.mockResolvedValue(null);

      await service.remove(USER, TX);

      expect(prisma.transaction.delete).toHaveBeenCalledWith({ where: { id: TX } });
    });

    it('409s instead of detaching a confirmed recurrence occurrence', async () => {
      prisma.transaction.findUnique.mockResolvedValue(row({ source: 'fixed' }));
      prisma.fixedTransactionOccurrence.findFirst.mockResolvedValue({ id: 'occ-1' });

      await expect(service.remove(USER, TX)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.transaction.delete).not.toHaveBeenCalled();
    });

    it('404s on another user’s transaction', async () => {
      prisma.transaction.findUnique.mockResolvedValue(row({ userId: OTHER_USER }));

      await expect(service.remove(USER, TX)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.transaction.delete).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // listings
  // -------------------------------------------------------------------------

  describe('findAllByUser', () => {
    beforeEach(() => {
      prisma.transaction.findMany.mockResolvedValue([
        row({
          category: { id: CATEGORY, name: 'Mercado', type: 'expense' },
          account: { id: ACCOUNT, name: 'Conta corrente' },
          creditCard: null,
        }),
      ]);
      prisma.transaction.count.mockResolvedValue(1);
    });

    it('returns the paginated envelope with the relation labels resolved', async () => {
      const result = await service.findAllByUser(USER, {});

      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        totalItems: 1,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      });
      expect(result.data[0].category).toEqual({ id: CATEGORY, name: 'Mercado', type: 'expense' });
      expect(result.data[0].account).toEqual({ id: ACCOUNT, name: 'Conta corrente' });
      expect(result.data[0].creditCard).toBeNull();
    });

    it('orders by date, then creation, then id so pages cannot repeat rows', async () => {
      await service.findAllByUser(USER, {});

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          take: 20,
          skip: 0,
        }),
      );
    });

    it('includes the whole final day of the range', async () => {
      await service.findAllByUser(USER, { fromDate: '2026-04-01', toDate: '2026-04-30' });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: { gte: fromCivilDate('2026-04-01'), lt: fromCivilDate('2026-05-01') },
          }),
        }),
      );
    });

    it('passes every filter through to the query', async () => {
      await service.findAllByUser(USER, {
        type: 'expense',
        source: 'imported',
        accountId: ACCOUNT,
        creditCardId: CARD,
        categoryId: CATEGORY,
        page: 2,
        limit: 5,
      });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: USER,
            type: 'expense',
            source: 'imported',
            accountId: ACCOUNT,
            creditCardId: CARD,
            categoryId: CATEGORY,
          },
          skip: 5,
          take: 5,
        }),
      );
    });

    it('rejects an inverted range', async () => {
      await expect(
        service.findAllByUser(USER, { fromDate: '2026-04-30', toDate: '2026-04-01' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findUncategorized', () => {
    it('forces categoryId to null even when the filter asks for one', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      await service.findUncategorized(USER, { categoryId: CATEGORY });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: USER, categoryId: null }) }),
      );
    });
  });

  describe('findById', () => {
    it('404s on another user’s transaction instead of 403', async () => {
      prisma.transaction.findUnique.mockResolvedValue(row({ userId: OTHER_USER }));

      await expect(service.findById(USER, TX)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('countUncategorized', () => {
    it('counts in the database rather than paging rows', async () => {
      prisma.transaction.count.mockResolvedValue(7);

      await expect(service.countUncategorized(USER)).resolves.toBe(7);
      expect(prisma.transaction.count).toHaveBeenCalledWith({ where: { userId: USER, categoryId: null } });
      expect(prisma.transaction.findMany).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // aggregates
  // -------------------------------------------------------------------------

  describe('aggregateByPeriod', () => {
    it('totals the whole window with one grouped query', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { type: 'income', _sum: { value: 5000 }, _count: { _all: 1 } },
        { type: 'expense', _sum: { value: 3500 }, _count: { _all: 41 } },
      ]);

      const totals = await service.aggregateByPeriod(USER, '2026-04-01', '2026-04-30');

      expect(totals).toEqual({ income: 5000, expense: 3500, net: 1500, count: 42 });
      expect(prisma.transaction.groupBy).toHaveBeenCalledTimes(1);
      expect(prisma.transaction.findMany).not.toHaveBeenCalled();
    });

    it('reports zeroes for an empty window', async () => {
      prisma.transaction.groupBy.mockResolvedValue([]);

      await expect(service.aggregateByPeriod(USER, '2026-04-01', '2026-04-30')).resolves.toEqual({
        income: 0,
        expense: 0,
        net: 0,
        count: 0,
      });
    });
  });

  describe('getSummary', () => {
    it('echoes the window it actually measured', async () => {
      prisma.transaction.groupBy.mockResolvedValue([{ type: 'income', _sum: { value: 10 }, _count: { _all: 1 } }]);

      await expect(service.getSummary(USER, '2026-04-01', '2026-04-30')).resolves.toEqual({
        income: 10,
        expense: 0,
        net: 10,
        count: 1,
        from: '2026-04-01',
        to: '2026-04-30',
      });
    });

    it('400s on an inverted window', async () => {
      await expect(service.getSummary(USER, '2026-04-30', '2026-04-01')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.transaction.groupBy).not.toHaveBeenCalled();
    });

    it('400s on a date that is not a calendar day', async () => {
      await expect(service.getSummary(USER, '2026-13-01', '2026-13-31')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('monthlyNetSeries', () => {
    it('zero-fills quiet months and keeps one grouped query', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { date: new Date('2026-01-10T00:00:00.000Z'), type: 'expense', _sum: { value: 300 } },
        { date: new Date('2026-01-20T00:00:00.000Z'), type: 'income', _sum: { value: 1000 } },
        { date: new Date('2026-03-05T00:00:00.000Z'), type: 'expense', _sum: { value: 100 } },
      ]);

      const series = await service.monthlyNetSeries(USER, '2026-01', '2026-03');

      expect(prisma.transaction.groupBy).toHaveBeenCalledTimes(1);
      expect(series).toEqual([
        { month: '2026-01', income: 1000, expense: 300, net: 700 },
        { month: '2026-02', income: 0, expense: 0, net: 0 },
        { month: '2026-03', income: 0, expense: 100, net: -100 },
      ]);
    });

    it('accepts civil dates inside the boundary months', async () => {
      prisma.transaction.groupBy.mockResolvedValue([]);

      const series = await service.monthlyNetSeries(USER, '2026-01-15', '2026-02-28');

      expect(series.map((month) => month.month)).toEqual(['2026-01', '2026-02']);
      expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: { gte: fromCivilDate('2026-01-01'), lt: fromCivilDate('2026-03-01') },
          }),
        }),
      );
    });

    it('returns nothing when the range is inverted', async () => {
      await expect(service.monthlyNetSeries(USER, '2026-03', '2026-01')).resolves.toEqual([]);
      expect(prisma.transaction.groupBy).not.toHaveBeenCalled();
    });
  });

  describe('getProjection', () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: new Date('2026-04-15T12:00:00.000Z') });
    });

    afterEach(() => jest.useRealTimers());

    it('averages the last complete months and excludes the current one', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { date: new Date('2026-01-10T00:00:00.000Z'), type: 'expense', _sum: { value: 3000 } },
        { date: new Date('2026-02-10T00:00:00.000Z'), type: 'expense', _sum: { value: 3000 } },
        { date: new Date('2026-03-10T00:00:00.000Z'), type: 'expense', _sum: { value: 3000 } },
        // April is the current, partial month: it must not reach the average.
        { date: new Date('2026-04-10T00:00:00.000Z'), type: 'expense', _sum: { value: 99999 } },
      ]);

      const projection = await service.getProjection(USER);

      expect(projection.window).toEqual({ from: '2026-01-01', to: '2026-03-31' });
      expect(projection.basedOnMonths).toBe(3);
      expect(projection.projectedMonthlyExpense).toBe(3000);
      expect(projection.months.map((month) => month.month)).toEqual(['2026-01', '2026-02', '2026-03']);
      expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: { gte: fromCivilDate('2026-01-01'), lt: fromCivilDate('2026-04-01') },
          }),
        }),
      );
    });

    it('counts a month with no activity as zero instead of dropping it', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { date: new Date('2026-03-10T00:00:00.000Z'), type: 'expense', _sum: { value: 3000 } },
      ]);

      const projection = await service.getProjection(USER);

      expect(projection.basedOnMonths).toBe(3);
      expect(projection.projectedMonthlyExpense).toBe(1000);
    });

    it('honours the months window', async () => {
      prisma.transaction.groupBy.mockResolvedValue([]);

      const projection = await service.getProjection(USER, 6);

      expect(projection.basedOnMonths).toBe(6);
      expect(projection.window).toEqual({ from: '2025-10-01', to: '2026-03-31' });
      expect(projection.projectedMonthlyExpense).toBe(0);
    });

    it('rejects a window outside 1..12', async () => {
      await expect(service.getProjection(USER, 0)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.getProjection(USER, 13)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
