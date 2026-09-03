import {
  addMonths,
  type CivilDate,
  civilDateOf,
  clampDayToMonth,
  endOfMonth,
  partsOf,
  todayIn,
} from '../common/civil-date';

/** A competence period: the (year, month) pair one occurrence belongs to. */
export interface Period {
  year: number;
  /** 1-12. */
  month: number;
}

export function periodOf(date: CivilDate): Period {
  const { year, month } = partsOf(date);
  return { year, month };
}

export function currentPeriod(timeZone: string, now: Date = new Date()): Period {
  return periodOf(todayIn(timeZone, now));
}

export function periodStart(period: Period): CivilDate {
  return civilDateOf(period.year, period.month, 1);
}

export function periodEnd(period: Period): CivilDate {
  return endOfMonth(periodStart(period));
}

export function shiftPeriod(period: Period, months: number): Period {
  return periodOf(addMonths(periodStart(period), months));
}

/** `[period, period - 1, ..., period - monthsBack]`, newest first. */
export function periodWindow(period: Period, monthsBack: number): Period[] {
  const periods: Period[] = [];
  for (let offset = 0; offset <= Math.max(0, monthsBack); offset += 1) {
    periods.push(shiftPeriod(period, -offset));
  }
  return periods;
}

export function samePeriod(a: Period, b: Period): boolean {
  return a.year === b.year && a.month === b.month;
}

/** Sortable key used to deduplicate (template, period) pairs without a DB round trip. */
export function periodKey(fixedTransactionId: string, period: Period): string {
  return `${fixedTransactionId}:${period.year}-${period.month}`;
}

/**
 * The nominal due day for a period: `referenceDay` clamped down to a month that
 * is too short for it. A template with `referenceDay = 31` is due on Feb 28
 * (29 in a leap year) — the old job compared raw day numbers and silently never
 * generated anything for those templates.
 */
export function dueDateFor(period: Period, referenceDay: number): CivilDate {
  const day = clampDayToMonth(period.year, period.month, referenceDay);
  return civilDateOf(period.year, period.month, day);
}

/**
 * Prisma filter for "strictly after this period".
 *
 * Editing or archiving a template must never rewrite an occurrence that is
 * already in the past or in flight, so every propagation query is scoped with
 * this on top of `status: 'pending'`.
 */
export function afterPeriodWhere(period: Period): {
  OR: ({ periodYear: { gt: number } } | { periodYear: number; periodMonth: { gt: number } })[];
} {
  return {
    OR: [{ periodYear: { gt: period.year } }, { periodYear: period.year, periodMonth: { gt: period.month } }],
  };
}
