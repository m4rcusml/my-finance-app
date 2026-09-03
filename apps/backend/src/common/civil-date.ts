import { BadRequestException } from '@nestjs/common';
import {
  type CivilDate,
  civilDateOf,
  clampDayToMonth,
  daysInMonth,
  fromCivilDate,
  isCivilDate,
  toCivilDate,
} from '@finance/contracts';

export { civilDateOf, clampDayToMonth, daysInMonth, fromCivilDate, isCivilDate, toCivilDate };
export type { CivilDate };

/**
 * Civil-date arithmetic for the whole backend.
 *
 * Everything here works on `YYYY-MM-DD` strings and UTC-midnight `Date`s, which
 * is what a PostgreSQL `date` column round-trips through Prisma. Nothing in
 * this file reads the process timezone — the *only* place the configured
 * timezone matters is `todayIn`, where "what day is it right now" genuinely
 * depends on where the user is.
 */

/** Today's calendar day in the given IANA timezone. */
export function todayIn(timeZone: string, now: Date = new Date()): CivilDate {
  // 'en-CA' formats as YYYY-MM-DD, which is exactly the civil-date shape.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function parseCivilDate(value: string, field = 'date'): CivilDate {
  if (!isCivilDate(value)) {
    throw new BadRequestException(`${field} deve ser uma data civil válida no formato YYYY-MM-DD`);
  }
  return value;
}

export function partsOf(date: CivilDate): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

export function addDays(date: CivilDate, days: number): CivilDate {
  const d = fromCivilDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toCivilDate(d);
}

/** Adds whole months, clamping the day down when the target month is shorter. */
export function addMonths(date: CivilDate, months: number): CivilDate {
  const { year, month, day } = partsOf(date);
  const zeroBased = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(zeroBased / 12);
  const targetMonth = (zeroBased % 12) + 1;
  return civilDateOf(targetYear, targetMonth, day);
}

export function startOfMonth(date: CivilDate): CivilDate {
  const { year, month } = partsOf(date);
  return civilDateOf(year, month, 1);
}

export function endOfMonth(date: CivilDate): CivilDate {
  const { year, month } = partsOf(date);
  return civilDateOf(year, month, daysInMonth(year, month));
}

export function startOfYear(date: CivilDate): CivilDate {
  return civilDateOf(partsOf(date).year, 1, 1);
}

export function endOfYear(date: CivilDate): CivilDate {
  return civilDateOf(partsOf(date).year, 12, 31);
}

/** Monday-based week, matching Brazilian convention for "esta semana". */
export function startOfWeek(date: CivilDate): CivilDate {
  const d = fromCivilDate(date);
  const dow = d.getUTCDay(); // 0 = Sunday
  const backToMonday = (dow + 6) % 7;
  return addDays(date, -backToMonday);
}

export function endOfWeek(date: CivilDate): CivilDate {
  return addDays(startOfWeek(date), 6);
}

export function compareCivilDates(a: CivilDate, b: CivilDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minCivilDate(a: CivilDate, b: CivilDate): CivilDate {
  return a <= b ? a : b;
}

export function maxCivilDate(a: CivilDate, b: CivilDate): CivilDate {
  return a >= b ? a : b;
}

/** `YYYY-MM` label for a civil date, used by the annual balance series. */
export function monthKey(date: CivilDate): string {
  return date.slice(0, 7);
}

/**
 * An inclusive civil-date range translated into the half-open `[gte, lt)`
 * bounds a `date` column wants. Using `lt = end + 1 day` is what makes the
 * final day of the range actually included — the old `lte: endOfMonth` on a
 * timestamp column silently dropped almost all of it.
 */
export interface DateRangeFilter {
  gte: Date;
  lt: Date;
}

export function inclusiveRange(from: CivilDate, to: CivilDate): DateRangeFilter {
  return { gte: fromCivilDate(from), lt: fromCivilDate(addDays(to, 1)) };
}

/**
 * The credit-card billing cycle that contains `reference`.
 *
 * `closingDay` is the last day *included* in the cycle: with `closingDay = 10`,
 * the cycle running on the 15th of March is `2026-03-11 .. 2026-04-10`. A null
 * `closingDay` means the cycle is simply the calendar month. Short months clamp
 * the closing day down (a card closing on the 31st closes on Feb 28/29).
 */
export function billingCycleFor(reference: CivilDate, closingDay: number | null): { start: CivilDate; end: CivilDate } {
  if (closingDay === null || closingDay === undefined) {
    return { start: startOfMonth(reference), end: endOfMonth(reference) };
  }

  const { year, month, day } = partsOf(reference);
  const closeThisMonth = clampDayToMonth(year, month, closingDay);

  if (day <= closeThisMonth) {
    // Cycle ends this month; it opened the day after the previous close.
    const prev = addMonths(civilDateOf(year, month, 1), -1);
    const prevParts = partsOf(prev);
    const prevClose = civilDateOf(prevParts.year, prevParts.month, clampDayToMonth(prevParts.year, prevParts.month, closingDay));
    return { start: addDays(prevClose, 1), end: civilDateOf(year, month, closeThisMonth) };
  }

  // Past this month's close: the open cycle ends next month.
  const next = addMonths(civilDateOf(year, month, 1), 1);
  const nextParts = partsOf(next);
  const nextClose = civilDateOf(nextParts.year, nextParts.month, clampDayToMonth(nextParts.year, nextParts.month, closingDay));
  return { start: addDays(civilDateOf(year, month, closeThisMonth), 1), end: nextClose };
}
