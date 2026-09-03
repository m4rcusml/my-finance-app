import { roundMoney } from '@finance/contracts';

export { roundMoney };

/**
 * Prisma hands `numeric` columns back as `Decimal` objects, which serialise to
 * strings. The API contract says money is a JSON number, so every read path
 * converts here — one place, so the two can never drift apart.
 */
export interface DecimalLike {
  toNumber?: () => number;
  toString: () => string;
}

export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const decimal = value as DecimalLike;
  if (typeof decimal.toNumber === 'function') return decimal.toNumber();
  const parsed = Number(decimal.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Money out of the database: converted and rounded to 2 decimal places. */
export function toMoney(value: unknown): number {
  return roundMoney(toNumber(value));
}

/** Quantities keep 8 decimal places. */
export function toQuantity(value: unknown): number {
  const n = toNumber(value);
  return Math.round((n + Number.EPSILON) * 1e8) / 1e8;
}

/** Sums money safely in integer cents, avoiding float drift over long lists. */
export function sumMoney(values: number[]): number {
  const cents = values.reduce((acc, v) => acc + Math.round(v * 100), 0);
  return cents / 100;
}

/**
 * Percent change from `previous` to `current`.
 *
 * Returns `null` when the comparison is undefined (no previous activity)
 * instead of the misleading `0`/`100` the old implementation produced, and
 * divides by `|previous|` so a move from -100 to -50 reads as an improvement
 * rather than a 50% drop.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return roundMoney(((current - previous) / Math.abs(previous)) * 100);
}
