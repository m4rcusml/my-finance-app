import type {
  CivilDate,
  DashboardOverview,
  DashboardPeriod,
  MonthlyNet,
  PeriodTotals,
  TrendedValue,
} from '@finance/contracts';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountsService } from '../accounts/accounts.service';
import {
  addDays,
  addMonths,
  civilDateOf,
  compareCivilDates,
  endOfMonth,
  endOfWeek,
  endOfYear,
  fromCivilDate,
  monthKey,
  parseCivilDate,
  partsOf,
  startOfMonth,
  startOfWeek,
  startOfYear,
  todayIn,
} from '../common/civil-date';
import { percentChange, toMoney } from '../common/money';
import { MAX_PAGE_SIZE } from '../common/pagination.dto';
import type { EnvConfig } from '../config/env';
import { CreditCardsService } from '../credit-cards/credit-cards.service';
import { FixedTransactionsOccurrencesService } from '../fixed-transactions/fixed-transactions-occurrences.service';
import { InvestmentsService } from '../investments/investments.service';
import { TransactionsService } from '../transactions/transactions.service';
import type { DashboardQueryDto } from './dashboard.dto';

/** The overview carries its own small lists; none of them is a page of a paginated screen. */
const LATEST_TRANSACTIONS_LIMIT = 5;
const PENDING_OCCURRENCES_LIMIT = 10;
const ANNUAL_BALANCE_MONTHS = 12;
/** Accounts and cards are few per user; one bounded page is the whole set. */
const RESOURCE_LIST_LIMIT = MAX_PAGE_SIZE;

const MILLIS_PER_DAY = 86_400_000;

/** A fully resolved, inclusive dashboard window. */
export interface DashboardWindow {
  period: DashboardPeriod;
  from: CivilDate;
  to: CivilDate;
  referenceDate: CivilDate;
  timezone: string;
}

interface PeriodAggregate {
  income: number;
  expense: number;
  net: number;
  count: number;
}

/**
 * Assembles `DashboardOverview`.
 *
 * Every number here comes from a dedicated aggregate on the owning service. The
 * dashboard never sums a page of rows: the old implementation totalled the first
 * 20 transactions of the month and silently under-reported every busier month,
 * and it issued 12 sequential paginated queries to draw the annual chart.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly accountsService: AccountsService,
    private readonly creditCardsService: CreditCardsService,
    private readonly transactionsService: TransactionsService,
    private readonly investmentsService: InvestmentsService,
    private readonly occurrencesService: FixedTransactionsOccurrencesService,
  ) {}

  async getOverview(userId: string, query: DashboardQueryDto = {}): Promise<DashboardOverview> {
    const window = this.resolveWindow(query);
    const previousWindow = this.previousWindow(window);

    const referenceMonth = startOfMonth(window.referenceDate);
    const firstSeriesMonth = addMonths(referenceMonth, -(ANNUAL_BALANCE_MONTHS - 1));

    const [
      balances,
      creditTotals,
      portfolio,
      currentAggregate,
      previousAggregate,
      accountsPage,
      creditCardsPage,
      latestTransactionsPage,
      pendingOccurrences,
      monthlySeries,
      uncategorizedCount,
    ] = await Promise.all([
      this.accountsService.getBalancesByType(userId),
      this.creditCardsService.getCycleTotals(userId),
      this.investmentsService.getPortfolioSummary(userId),
      this.transactionsService.aggregateByPeriod(userId, window.from, window.to),
      this.transactionsService.aggregateByPeriod(userId, previousWindow.from, previousWindow.to),
      this.accountsService.findAll(userId, { page: 1, limit: RESOURCE_LIST_LIMIT }),
      this.creditCardsService.findAll(userId, { page: 1, limit: RESOURCE_LIST_LIMIT }),
      this.transactionsService.findAllByUser(userId, { page: 1, limit: LATEST_TRANSACTIONS_LIMIT }),
      this.occurrencesService.findPendingForPeriod(userId, window.from, window.to, PENDING_OCCURRENCES_LIMIT),
      this.transactionsService.monthlyNetSeries(userId, firstSeriesMonth, referenceMonth),
      this.transactionsService.countUncategorized(userId),
    ]);

    const current = toPeriodTotals(currentAggregate);
    const previous = toPeriodTotals(previousAggregate);

    return {
      period: {
        period: window.period,
        from: window.from,
        to: window.to,
        referenceDate: window.referenceDate,
        timezone: window.timezone,
      },
      totals: {
        netBalance: toMoney(balances.cashBalance),
        investedAccountBalance: toMoney(balances.investmentBalance),
        portfolioInvested: toMoney(portfolio.totalInvested),
        totalCreditLimit: toMoney(creditTotals.totalLimit),
        totalCreditUsedThisCycle: toMoney(creditTotals.totalUsed),
        totalCreditAvailable: toMoney(creditTotals.totalAvailable),
        current,
        previous,
        trends: {
          income: trended(current.income, previous.income),
          expense: trended(current.expense, previous.expense),
          net: trended(current.net, previous.net),
        },
      },
      accounts: accountsPage.data,
      creditCards: creditCardsPage.data,
      latestTransactions: latestTransactionsPage.data,
      pendingOccurrences,
      annualBalance: normalizeAnnualBalance(monthlySeries, firstSeriesMonth),
      uncategorizedCount,
    };
  }

  /**
   * Turns the query string into an inclusive civil-date window.
   *
   * `week` is Monday..Sunday (Brazilian convention), `month` is the 1st..last
   * day, `year` is Jan 1..Dec 31 and `custom` is exactly `from..to`. Anything
   * that is not a real calendar day fails as a 400 here rather than blowing up
   * as a `RangeError` (a 500) further down.
   */
  resolveWindow(query: DashboardQueryDto = {}): DashboardWindow {
    const timezone = this.config.get('APP_TIMEZONE', { infer: true });
    const referenceDate = query.referenceDate
      ? parseCivilDate(query.referenceDate, 'referenceDate')
      : todayIn(timezone);
    const period: DashboardPeriod = query.period ?? 'month';

    if (period === 'custom') {
      if (!query.from || !query.to) {
        throw new BadRequestException('Informe from e to para usar o período personalizado.');
      }
      const from = parseCivilDate(query.from, 'from');
      const to = parseCivilDate(query.to, 'to');
      if (compareCivilDates(from, to) > 0) {
        throw new BadRequestException('A data inicial não pode ser posterior à data final.');
      }
      return { period, from, to, referenceDate, timezone };
    }

    if (period === 'week') {
      return { period, from: startOfWeek(referenceDate), to: endOfWeek(referenceDate), referenceDate, timezone };
    }
    if (period === 'year') {
      return { period, from: startOfYear(referenceDate), to: endOfYear(referenceDate), referenceDate, timezone };
    }
    return { period, from: startOfMonth(referenceDate), to: endOfMonth(referenceDate), referenceDate, timezone };
  }

  /**
   * The immediately preceding comparable window.
   *
   * `month` and `year` shift by the calendar, not by a day count, so February
   * compares against January (and not against "the 28 days before March 1st").
   * `week` and `custom` shift back by their own exact length in days.
   */
  private previousWindow(window: DashboardWindow): { from: CivilDate; to: CivilDate } {
    if (window.period === 'month') {
      const anchor = addMonths(startOfMonth(window.from), -1);
      return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
    }
    if (window.period === 'year') {
      const anchor = civilDateOf(partsOf(window.from).year - 1, 1, 1);
      return { from: startOfYear(anchor), to: endOfYear(anchor) };
    }
    const to = addDays(window.from, -1);
    const lengthInDays = daysBetweenInclusive(window.from, window.to);
    return { from: addDays(to, -(lengthInDays - 1)), to };
  }
}

function toPeriodTotals(aggregate: PeriodAggregate): PeriodTotals {
  return {
    income: toMoney(aggregate.income),
    expense: toMoney(aggregate.expense),
    net: toMoney(aggregate.net),
    transactionCount: aggregate.count,
  };
}

function trended(value: number, previousValue: number): TrendedValue {
  return { value, trending: percentChange(value, previousValue) };
}

/** Inclusive day count between two civil dates, computed on UTC midnights. */
function daysBetweenInclusive(from: CivilDate, to: CivilDate): number {
  const span = fromCivilDate(to).getTime() - fromCivilDate(from).getTime();
  return Math.round(span / MILLIS_PER_DAY) + 1;
}

/**
 * Forces the series into exactly 12 `YYYY-MM` buckets ending at the reference
 * month, zero-filling gaps and dropping anything outside the window. The labels
 * are derived from civil-date arithmetic, never from `toISOString()` on a
 * local-time `Date` (which shifts December into January west of UTC).
 */
function normalizeAnnualBalance(series: MonthlyNet[], firstMonth: CivilDate): MonthlyNet[] {
  const byMonth = new Map<string, MonthlyNet>();
  for (const entry of series) {
    byMonth.set(monthKey(entry.month), entry);
  }

  const months: MonthlyNet[] = [];
  for (let offset = 0; offset < ANNUAL_BALANCE_MONTHS; offset += 1) {
    const month = monthKey(addMonths(firstMonth, offset));
    const found = byMonth.get(month);
    months.push({
      month,
      income: toMoney(found?.income ?? 0),
      expense: toMoney(found?.expense ?? 0),
      net: toMoney(found?.net ?? 0),
    });
  }
  return months;
}
