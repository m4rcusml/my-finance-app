import type { CivilDate, MonthlyNet, PaginatedResponse } from '@finance/contracts';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { AccountsService } from '../accounts/accounts.service';
import { CreditCardsService } from '../credit-cards/credit-cards.service';
import { FixedTransactionsOccurrencesService } from '../fixed-transactions/fixed-transactions-occurrences.service';
import { InvestmentsService } from '../investments/investments.service';
import { TransactionsService } from '../transactions/transactions.service';
import { DashboardService } from './dashboard.service';

const TIMEZONE = 'America/Sao_Paulo';
/** 2026-03-15 09:00 in São Paulo — the anchor every "today" assertion uses. */
const FROZEN_NOW = new Date('2026-03-15T12:00:00.000Z');

function paginated<T>(data: T[], limit = 20): PaginatedResponse<T> {
  return {
    data,
    meta: {
      page: 1,
      limit,
      totalItems: data.length,
      totalPages: data.length === 0 ? 0 : 1,
      hasPreviousPage: false,
      hasNextPage: false,
    },
  };
}

interface FakeTransaction {
  id: string;
  type: 'income' | 'expense';
  value: number;
  date: CivilDate;
}

/** Aggregates the whole fixture list, exactly like the real SQL aggregate does. */
function aggregateOf(rows: FakeTransaction[], from: CivilDate, to: CivilDate) {
  const inWindow = rows.filter((row) => row.date >= from && row.date <= to);
  const income = inWindow.filter((r) => r.type === 'income').reduce((acc, r) => acc + r.value, 0);
  const expense = inWindow.filter((r) => r.type === 'expense').reduce((acc, r) => acc + r.value, 0);
  return { income, expense, net: income - expense, count: inWindow.length };
}

const EMPTY_AGGREGATE = { income: 0, expense: 0, net: 0, count: 0 };

describe('DashboardService', () => {
  let service: DashboardService;
  let accountsService: jest.Mocked<AccountsService>;
  let creditCardsService: jest.Mocked<CreditCardsService>;
  let transactionsService: jest.Mocked<TransactionsService>;
  let investmentsService: jest.Mocked<InvestmentsService>;
  let occurrencesService: jest.Mocked<FixedTransactionsOccurrencesService>;

  const userId = 'user-1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(TIMEZONE) } },
        {
          provide: AccountsService,
          useValue: { getBalancesByType: jest.fn(), findAll: jest.fn() },
        },
        {
          provide: CreditCardsService,
          useValue: { getCycleTotals: jest.fn(), findAll: jest.fn() },
        },
        {
          provide: TransactionsService,
          useValue: {
            aggregateByPeriod: jest.fn(),
            monthlyNetSeries: jest.fn(),
            countUncategorized: jest.fn(),
            findAllByUser: jest.fn(),
          },
        },
        { provide: InvestmentsService, useValue: { getPortfolioSummary: jest.fn() } },
        { provide: FixedTransactionsOccurrencesService, useValue: { findPendingForPeriod: jest.fn() } },
      ],
    }).compile();

    service = module.get(DashboardService);
    accountsService = module.get(AccountsService);
    creditCardsService = module.get(CreditCardsService);
    transactionsService = module.get(TransactionsService);
    investmentsService = module.get(InvestmentsService);
    occurrencesService = module.get(FixedTransactionsOccurrencesService);

    accountsService.getBalancesByType.mockResolvedValue({ cashBalance: 0, investmentBalance: 0 });
    accountsService.findAll.mockResolvedValue(paginated([]) as any);
    creditCardsService.getCycleTotals.mockResolvedValue({ totalLimit: 0, totalUsed: 0, totalAvailable: 0 });
    creditCardsService.findAll.mockResolvedValue(paginated([]) as any);
    transactionsService.aggregateByPeriod.mockResolvedValue({ ...EMPTY_AGGREGATE });
    transactionsService.monthlyNetSeries.mockResolvedValue([]);
    transactionsService.countUncategorized.mockResolvedValue(0);
    transactionsService.findAllByUser.mockResolvedValue(paginated([]) as any);
    investmentsService.getPortfolioSummary.mockResolvedValue({ totalInvested: 0, positions: 0, byType: [] });
    occurrencesService.findPendingForPeriod.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Regression: the totals used to be the sum of the first page of transactions
  // -------------------------------------------------------------------------

  describe('totals over a busy month', () => {
    // 57 rows — comfortably past the 20-row default page the old code summed.
    const rows: FakeTransaction[] = [
      ...Array.from({ length: 30 }, (_, i) => ({
        id: `in-${i}`,
        type: 'income' as const,
        value: 100,
        date: `2026-03-${String((i % 28) + 1).padStart(2, '0')}`,
      })),
      ...Array.from({ length: 27 }, (_, i) => ({
        id: `out-${i}`,
        type: 'expense' as const,
        value: 50,
        date: `2026-03-${String((i % 28) + 1).padStart(2, '0')}`,
      })),
    ];

    beforeEach(() => {
      transactionsService.aggregateByPeriod.mockImplementation(async (_userId, from, to) =>
        aggregateOf(rows, from, to),
      );
      // The page the dashboard is allowed to read is 5 rows long, on purpose.
      transactionsService.findAllByUser.mockResolvedValue(paginated(rows.slice(0, 5), 5) as any);
    });

    it('reports every transaction of the month, not just the first page', async () => {
      const result = await service.getOverview(userId, { period: 'month', referenceDate: '2026-03-15' });

      expect(result.totals.current).toEqual({
        income: 3000,
        expense: 1350,
        net: 1650,
        transactionCount: 57,
      });
    });

    it('never derives an aggregate from a paginated finder', async () => {
      await service.getOverview(userId, { period: 'month', referenceDate: '2026-03-15' });

      // The only paginated transaction read is the 5-row "latest" list.
      expect(transactionsService.findAllByUser).toHaveBeenCalledTimes(1);
      expect(transactionsService.findAllByUser).toHaveBeenCalledWith(userId, {
        page: 1,
        limit: 5,
        fromDate: '2026-03-01',
        toDate: '2026-03-31',
      });
      expect(transactionsService.aggregateByPeriod).toHaveBeenCalledTimes(2);
    });

    it('limits latestTransactions to 5 rows', async () => {
      const result = await service.getOverview(userId, { period: 'month', referenceDate: '2026-03-15' });

      expect(result.latestTransactions).toHaveLength(5);
    });
  });

  // -------------------------------------------------------------------------
  // Windows
  // -------------------------------------------------------------------------

  describe('windows', () => {
    it('defaults to the month containing today in APP_TIMEZONE', async () => {
      jest.useFakeTimers({ now: FROZEN_NOW });
      try {
        const result = await service.getOverview(userId);

        expect(result.period).toEqual({
          period: 'month',
          from: '2026-03-01',
          to: '2026-03-31',
          referenceDate: '2026-03-15',
          timezone: TIMEZONE,
        });
      } finally {
        jest.useRealTimers();
      }
    });

    it('compares a month against the previous calendar month', async () => {
      await service.getOverview(userId, { period: 'month', referenceDate: '2026-03-15' });

      expect(transactionsService.aggregateByPeriod).toHaveBeenNthCalledWith(1, userId, '2026-03-01', '2026-03-31');
      expect(transactionsService.aggregateByPeriod).toHaveBeenNthCalledWith(2, userId, '2026-02-01', '2026-02-28');
    });

    it('builds a Monday..Sunday week and the week before it', async () => {
      // 2026-03-11 is a Wednesday.
      const result = await service.getOverview(userId, { period: 'week', referenceDate: '2026-03-11' });

      expect(result.period.from).toBe('2026-03-09');
      expect(result.period.to).toBe('2026-03-15');
      expect(transactionsService.aggregateByPeriod).toHaveBeenNthCalledWith(2, userId, '2026-03-02', '2026-03-08');
    });

    it('builds a Jan 1..Dec 31 year and the previous calendar year', async () => {
      const result = await service.getOverview(userId, { period: 'year', referenceDate: '2026-07-04' });

      expect(result.period.from).toBe('2026-01-01');
      expect(result.period.to).toBe('2026-12-31');
      expect(transactionsService.aggregateByPeriod).toHaveBeenNthCalledWith(2, userId, '2025-01-01', '2025-12-31');
    });

    it('uses from..to for a custom window and shifts back by its own length', async () => {
      const result = await service.getOverview(userId, {
        period: 'custom',
        from: '2026-01-10',
        to: '2026-01-19',
        referenceDate: '2026-01-15',
      });

      expect(result.period.from).toBe('2026-01-10');
      expect(result.period.to).toBe('2026-01-19');
      // 10 days back-to-back, so the previous window ends the day before `from`.
      expect(transactionsService.aggregateByPeriod).toHaveBeenNthCalledWith(2, userId, '2025-12-31', '2026-01-09');
    });

    it('passes the window through to the pending occurrences lookup with its own limit', async () => {
      await service.getOverview(userId, { period: 'month', referenceDate: '2026-03-15' });

      expect(occurrencesService.findPendingForPeriod).toHaveBeenCalledWith(userId, '2026-03-01', '2026-03-31', 10);
    });
  });

  // -------------------------------------------------------------------------
  // Query validation
  // -------------------------------------------------------------------------

  describe('query validation', () => {
    it('rejects a referenceDate that is not a real calendar day', async () => {
      await expect(service.getOverview(userId, { referenceDate: '2026-02-31' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects a malformed referenceDate instead of blowing up as a 500', async () => {
      await expect(service.getOverview(userId, { referenceDate: 'ontem' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('requires from and to when period is custom', async () => {
      await expect(service.getOverview(userId, { period: 'custom', from: '2026-01-10' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects a custom window whose start is after its end', async () => {
      await expect(
        service.getOverview(userId, { period: 'custom', from: '2026-02-10', to: '2026-01-10' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a single-day custom window', async () => {
      const result = await service.getOverview(userId, {
        period: 'custom',
        from: '2026-01-10',
        to: '2026-01-10',
      });

      expect(result.period.from).toBe('2026-01-10');
      expect(result.period.to).toBe('2026-01-10');
      expect(transactionsService.aggregateByPeriod).toHaveBeenNthCalledWith(2, userId, '2026-01-09', '2026-01-09');
    });
  });

  // -------------------------------------------------------------------------
  // Balances
  // -------------------------------------------------------------------------

  describe('balances', () => {
    it('excludes investment accounts from netBalance and reports them separately', async () => {
      accountsService.getBalancesByType.mockResolvedValue({ cashBalance: 12450.9, investmentBalance: 30000 });
      accountsService.findAll.mockResolvedValue(
        paginated([
          { id: 'acc-1', name: 'Conta corrente', type: 'checking', balance: 12450.9 },
          { id: 'acc-2', name: 'Corretora', type: 'investment', balance: 30000 },
        ]) as any,
      );
      investmentsService.getPortfolioSummary.mockResolvedValue({
        totalInvested: 45000,
        positions: 4,
        byType: [],
      });

      const result = await service.getOverview(userId, { referenceDate: '2026-03-15' });

      expect(result.totals.netBalance).toBe(12450.9);
      expect(result.totals.investedAccountBalance).toBe(30000);
      expect(result.totals.portfolioInvested).toBe(45000);
      // The account list still carries both, so the UI can show them.
      expect(result.accounts).toHaveLength(2);
    });

    it('reports the credit cycle totals from the dedicated aggregate', async () => {
      creditCardsService.getCycleTotals.mockResolvedValue({
        totalLimit: 15000,
        totalUsed: 2310.44,
        totalAvailable: 12689.56,
      });

      const result = await service.getOverview(userId, { referenceDate: '2026-03-15' });

      expect(result.totals.totalCreditLimit).toBe(15000);
      expect(result.totals.totalCreditUsedThisCycle).toBe(2310.44);
      expect(result.totals.totalCreditAvailable).toBe(12689.56);
    });

    it('asks for accounts and cards with an explicit bounded page', async () => {
      await service.getOverview(userId, { referenceDate: '2026-03-15' });

      expect(accountsService.findAll).toHaveBeenCalledWith(userId, { page: 1, limit: 100 });
      expect(creditCardsService.findAll).toHaveBeenCalledWith(userId, { page: 1, limit: 100 });
    });
  });

  // -------------------------------------------------------------------------
  // Trends
  // -------------------------------------------------------------------------

  describe('trends', () => {
    it('computes the percent change against the previous window', async () => {
      transactionsService.aggregateByPeriod
        .mockResolvedValueOnce({ income: 6000, expense: 2000, net: 4000, count: 12 })
        .mockResolvedValueOnce({ income: 5000, expense: 2500, net: 2500, count: 9 });

      const result = await service.getOverview(userId, { referenceDate: '2026-03-15' });

      expect(result.totals.previous).toEqual({ income: 5000, expense: 2500, net: 2500, transactionCount: 9 });
      expect(result.totals.trends.income).toEqual({ value: 6000, trending: 20 });
      expect(result.totals.trends.expense).toEqual({ value: 2000, trending: -20 });
      expect(result.totals.trends.net).toEqual({ value: 4000, trending: 60 });
    });

    it('returns null — not 0 or 100 — when the previous window has no activity', async () => {
      transactionsService.aggregateByPeriod
        .mockResolvedValueOnce({ income: 6000, expense: 0, net: 6000, count: 3 })
        .mockResolvedValueOnce({ ...EMPTY_AGGREGATE });

      const result = await service.getOverview(userId, { referenceDate: '2026-03-15' });

      expect(result.totals.trends.income.trending).toBeNull();
      expect(result.totals.trends.net.trending).toBeNull();
      // Both sides are zero here, which is a real 0% change.
      expect(result.totals.trends.expense.trending).toBe(0);
    });

    it('reads an improvement from -100 to -50 as positive', async () => {
      transactionsService.aggregateByPeriod
        .mockResolvedValueOnce({ income: 0, expense: 50, net: -50, count: 1 })
        .mockResolvedValueOnce({ income: 0, expense: 100, net: -100, count: 1 });

      const result = await service.getOverview(userId, { referenceDate: '2026-03-15' });

      expect(result.totals.trends.net.trending).toBe(50);
    });
  });

  // -------------------------------------------------------------------------
  // Annual balance
  // -------------------------------------------------------------------------

  describe('annualBalance', () => {
    it('returns exactly 12 months ending at the reference month, from a single call', async () => {
      const result = await service.getOverview(userId, { referenceDate: '2026-03-15' });

      expect(transactionsService.monthlyNetSeries).toHaveBeenCalledTimes(1);
      expect(transactionsService.monthlyNetSeries).toHaveBeenCalledWith(userId, '2025-04-01', '2026-03-01');
      expect(result.annualBalance).toHaveLength(12);
      expect(result.annualBalance[0].month).toBe('2025-04');
      expect(result.annualBalance[11].month).toBe('2026-03');
    });

    it('zero-fills months the series does not cover', async () => {
      const series: MonthlyNet[] = [{ month: '2026-01', income: 900, expense: 400, net: 500 }];
      transactionsService.monthlyNetSeries.mockResolvedValue(series);

      const result = await service.getOverview(userId, { referenceDate: '2026-03-15' });

      expect(result.annualBalance).toHaveLength(12);
      expect(result.annualBalance.find((m) => m.month === '2026-01')).toEqual({
        month: '2026-01',
        income: 900,
        expense: 400,
        net: 500,
      });
      expect(result.annualBalance.find((m) => m.month === '2026-02')).toEqual({
        month: '2026-02',
        income: 0,
        expense: 0,
        net: 0,
      });
    });

    it('labels months from civil dates, so a December reference does not roll into January', async () => {
      const result = await service.getOverview(userId, { referenceDate: '2026-12-31' });

      expect(transactionsService.monthlyNetSeries).toHaveBeenCalledWith(userId, '2026-01-01', '2026-12-01');
      expect(result.annualBalance[0].month).toBe('2026-01');
      expect(result.annualBalance[11].month).toBe('2026-12');
    });

    it('keeps the 12-month series anchored to the reference month for a custom window', async () => {
      const result = await service.getOverview(userId, {
        period: 'custom',
        from: '2026-01-10',
        to: '2026-01-19',
        referenceDate: '2026-03-15',
      });

      expect(result.annualBalance).toHaveLength(12);
      expect(result.annualBalance[11].month).toBe('2026-03');
    });
  });

  // -------------------------------------------------------------------------
  // Remaining payload
  // -------------------------------------------------------------------------

  describe('payload', () => {
    it('takes uncategorizedCount from the dedicated counter', async () => {
      transactionsService.countUncategorized.mockResolvedValue(7);

      const result = await service.getOverview(userId, { referenceDate: '2026-03-15' });

      expect(transactionsService.countUncategorized).toHaveBeenCalledWith(userId);
      expect(result.uncategorizedCount).toBe(7);
    });

    it('returns a fully zeroed but complete payload for a brand-new user', async () => {
      const result = await service.getOverview(userId, { referenceDate: '2026-03-15' });

      expect(result.totals.netBalance).toBe(0);
      expect(result.totals.investedAccountBalance).toBe(0);
      expect(result.totals.portfolioInvested).toBe(0);
      expect(result.totals.current).toEqual({ income: 0, expense: 0, net: 0, transactionCount: 0 });
      expect(result.accounts).toEqual([]);
      expect(result.creditCards).toEqual([]);
      expect(result.latestTransactions).toEqual([]);
      expect(result.pendingOccurrences).toEqual([]);
      expect(result.annualBalance).toHaveLength(12);
      expect(result.uncategorizedCount).toBe(0);
    });
  });
});
