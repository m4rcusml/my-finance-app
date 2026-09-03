/**
 * Cross-cutting primitives: pagination, errors, dates and money.
 *
 * The rules encoded here are the ones both apps must agree on. They are
 * deliberately boring and explicitly documented, because every past bug in this
 * codebase came from the two sides disagreeing about one of them.
 */

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/**
 * EVERY collection endpoint returns this envelope. There is no endpoint in the
 * V1 API that returns a bare array; frontend code must never call an array
 * method on a list response without going through `.data` first.
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationMeta {
  /** 1-based. */
  page: number;
  /** Rows per page actually applied (already clamped to [1, 100]). */
  limit: number;
  /** Total rows matching the filter, ignoring pagination. */
  totalItems: number;
  /** `ceil(totalItems / limit)`; `0` when there are no rows at all. */
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export function buildPaginationMeta(totalItems: number, page: number, limit: number): PaginationMeta {
  const totalPages = limit > 0 ? Math.ceil(totalItems / limit) : 0;
  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
}

export function buildPaginatedResponse<T>(
  data: T[],
  totalItems: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  return { data, meta: buildPaginationMeta(totalItems, page, limit) };
}

/** Narrowing helper used by the contract tests and by defensive frontend code. */
export function isPaginatedResponse<T>(value: unknown): value is PaginatedResponse<T> {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { data?: unknown; meta?: unknown };
  if (!Array.isArray(candidate.data)) return false;
  const meta = candidate.meta as PaginationMeta | undefined;
  return (
    typeof meta === 'object' &&
    meta !== null &&
    typeof meta.page === 'number' &&
    typeof meta.limit === 'number' &&
    typeof meta.totalItems === 'number' &&
    typeof meta.totalPages === 'number' &&
    typeof meta.hasPreviousPage === 'boolean' &&
    typeof meta.hasNextPage === 'boolean'
  );
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * The single error body shape. `message` is always safe to show to a user;
 * internal exception text never reaches it.
 */
export interface ApiErrorResponse {
  statusCode: number;
  /** Stable machine-readable code, e.g. `bad_request`, `unauthorized`. */
  error: ApiErrorCode;
  /** Human-readable, pt-BR, safe to render. */
  message: string;
  /** Field-level validation problems, when `error === 'validation_failed'`. */
  details?: string[];
  timestamp: string;
  path: string;
  /** Correlates a client-visible failure with the structured server log. */
  requestId: string;
}

export const API_ERROR_CODES = [
  'bad_request',
  'validation_failed',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'payload_too_large',
  'unsupported_media_type',
  'unprocessable_entity',
  'too_many_requests',
  'internal_error',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/**
 * A **civil date** — a calendar day with no time and no timezone, `YYYY-MM-DD`.
 *
 * Used for everything a person would call "the date of the thing": transaction
 * date, occurrence real date, investment buy date, goal deadline. Stored in
 * PostgreSQL as `DATE`, never as `timestamptz`, so it cannot drift across
 * timezones. `2026-01-15` means the 15th in São Paulo, in UTC and in Tokyo.
 */
export type CivilDate = string;

/** A calendar month with no day or timezone, serialised as `YYYY-MM`. */
export type YearMonth =
  `${number}-${'01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12'}`;

/** An instant, ISO-8601 with offset. Used only for audit fields (`createdAt`). */
export type IsoTimestamp = string;

export const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const YEAR_MONTH_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/;

export function isYearMonth(value: unknown): value is YearMonth {
  return typeof value === 'string' && YEAR_MONTH_PATTERN.test(value);
}

export function toYearMonth(value: string): YearMonth {
  if (!isYearMonth(value)) throw new RangeError(`Invalid calendar month: ${String(value)}`);
  return value;
}

/** True only for a syntactically well-formed AND calendar-valid civil date. */
export function isCivilDate(value: unknown): value is CivilDate {
  if (typeof value !== 'string' || !CIVIL_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Formats a `DATE` column (which Prisma hands back as UTC midnight) as `YYYY-MM-DD`. */
export function toCivilDate(value: Date | string): CivilDate {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

/**
 * Parses a civil date into the UTC-midnight `Date` that Prisma expects for a
 * `DATE` column. Throws on anything that is not a valid calendar day, so a bad
 * value fails at the DTO boundary instead of as a 500 deep inside Prisma.
 */
export function fromCivilDate(value: CivilDate): Date {
  if (!isCivilDate(value)) throw new RangeError(`Invalid civil date: ${String(value)}`);
  return new Date(`${value}T00:00:00.000Z`);
}

/** Clamps a day-of-month to a month that may be shorter (31 -> 28/29/30). */
export function clampDayToMonth(year: number, month: number, day: number): number {
  return Math.min(day, daysInMonth(year, month));
}

export function civilDateOf(year: number, month: number, day: number): CivilDate {
  const clamped = clampDayToMonth(year, month, day);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/**
 * Money is transported as a JSON **number** with at most 2 decimal places
 * (quantities: 8 places). PostgreSQL stores `numeric(15,2)`; the API converts
 * on the way out so the frontend never has to guess whether it received
 * `"10.00"` or `10`. `numeric(15,2)` maxes out at ~1e13 — well inside the
 * 2^53 integer-cent range where float64 is exact.
 */
export type Money = number;
export type Quantity = number;

export function roundMoney(value: number): Money {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
