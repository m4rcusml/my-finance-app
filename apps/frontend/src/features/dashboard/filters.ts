import {
  type CivilDate,
  civilDateOf,
  type DashboardPeriod,
  type DashboardQuery,
  isCivilDate,
} from '@finance/contracts';
import { todayCivil } from '@/shared/lib/format';

/**
 * The dashboard's filter state, kept separate from the components so the date
 * arithmetic can be reasoned about (and reused) without a render tree.
 *
 * Everything here is civil-date maths on `YYYY-MM-DD` strings. Nothing ever
 * goes through `new Date(string)`, which would reinterpret the value as UTC
 * midnight and shift the day for anybody west of Greenwich — São Paulo
 * included.
 */

export interface DashboardFilters {
  period: DashboardPeriod;
  /** Anchor day. `''` means "let the server use today". */
  referenceDate: CivilDate | '';
  /** Only meaningful when `period === 'custom'`. */
  from: CivilDate | '';
  to: CivilDate | '';
}

export const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  week: 'Semana',
  month: 'Mês',
  year: 'Ano',
  custom: 'Personalizado',
};

/** First day of the month a civil date falls in. */
export function startOfMonthCivil(date: CivilDate): CivilDate {
  const [year, month] = date.split('-').map(Number);
  return civilDateOf(year, month, 1);
}

/**
 * Shifts a civil date by whole months, clamping the day down in shorter months
 * (31 January + 1 month is 28/29 February, not 3 March).
 */
export function shiftMonths(date: CivilDate | '', delta: number): CivilDate {
  const anchor = isCivilDate(date) ? date : todayCivil();
  const [year, month, day] = anchor.split('-').map(Number);
  const index = year * 12 + (month - 1) + delta;
  return civilDateOf(Math.floor(index / 12), (index % 12) + 1, day);
}

export function defaultDashboardFilters(): DashboardFilters {
  const today = todayCivil();
  return {
    period: 'month',
    referenceDate: today,
    from: startOfMonthCivil(today),
    to: today,
  };
}

export interface BuiltDashboardQuery {
  /** `null` when the filters are not yet a valid request — do NOT fetch. */
  query: DashboardQuery | null;
  /** Rendered next to the custom-range inputs when they are incomplete/inverted. */
  rangeError?: string;
}

/**
 * Turns filter state into the query the API accepts, or refuses it with a
 * message. A half-typed custom range must never be sent: the server would
 * answer 422 and the user would see a server error for their own typing.
 */
export function buildDashboardQuery(filters: DashboardFilters): BuiltDashboardQuery {
  const referenceDate = isCivilDate(filters.referenceDate) ? filters.referenceDate : undefined;

  if (filters.period !== 'custom') {
    return { query: { period: filters.period, referenceDate } };
  }

  if (!isCivilDate(filters.from) || !isCivilDate(filters.to)) {
    return { query: null, rangeError: 'Informe a data inicial e a data final do período.' };
  }

  // Civil dates are zero-padded, so a plain string comparison is a date comparison.
  if (filters.from > filters.to) {
    return { query: null, rangeError: 'A data inicial precisa ser anterior ou igual à data final.' };
  }

  return {
    query: { period: 'custom', referenceDate, from: filters.from, to: filters.to },
  };
}
