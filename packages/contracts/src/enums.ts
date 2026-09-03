/**
 * Every closed value set in the API.
 *
 * Casing rule for the whole system: **lowercase snake_case**, in the database,
 * in the DTOs, in the JSON payloads, in the frontend and in the seed. There is
 * exactly one spelling of every value; there is no normalisation layer.
 *
 * These are `as const` tuples rather than TypeScript `enum`s so that:
 *  - a plain string literal (`'savings'`) is assignable to the type;
 *  - the runtime array can be fed straight to `class-validator`'s `@IsIn(...)`
 *    and to `@ApiProperty({ enum })`;
 *  - the values survive `isolatedModules` and cross the package boundary
 *    without emitting runtime enum objects.
 */

export const ACCOUNT_TYPES = ['checking', 'savings', 'investment', 'cash', 'other'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Account types whose balance is *not* spendable cash and must be reported separately. */
export const INVESTMENT_ACCOUNT_TYPES: readonly AccountType[] = ['investment'];

export const CATEGORY_TYPES = ['income', 'expense', 'both'] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const TRANSACTION_TYPES = ['income', 'expense'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/** How a transaction row came into existence. */
export const TRANSACTION_SOURCES = ['manual', 'imported', 'fixed'] as const;
export type TransactionSource = (typeof TRANSACTION_SOURCES)[number];

export const FIXED_TRANSACTION_TYPES = ['income', 'expense'] as const;
export type FixedTransactionType = (typeof FIXED_TRANSACTION_TYPES)[number];

/**
 * Occurrence lifecycle. `pending` is the only non-final state:
 * `pending -> confirmed` and `pending -> skipped` are the only legal edges.
 */
export const OCCURRENCE_STATUSES = ['pending', 'confirmed', 'skipped'] as const;
export type OccurrenceStatus = (typeof OCCURRENCE_STATUSES)[number];

export const FINAL_OCCURRENCE_STATUSES: readonly OccurrenceStatus[] = ['confirmed', 'skipped'];

export const INVESTMENT_TYPES = ['stock', 'fii', 'etf', 'crypto', 'fixed_income', 'fund', 'other'] as const;
export type InvestmentType = (typeof INVESTMENT_TYPES)[number];

export const MARKET_ASSET_TYPES = ['stock', 'fii', 'etf', 'crypto', 'fixed_income', 'fund', 'other'] as const;
export type MarketAssetType = (typeof MARKET_ASSET_TYPES)[number];

export const GOAL_TYPES = ['saving', 'spending_limit', 'debt_payoff', 'other'] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const IMPORT_ORIGINS = ['inter', 'generic'] as const;
export type ImportOrigin = (typeof IMPORT_ORIGINS)[number];

export const IMPORT_FILE_TYPES = ['csv', 'ofx', 'xlsx'] as const;
export type ImportFileType = (typeof IMPORT_FILE_TYPES)[number];

export const IMPORT_STATUSES = ['pending', 'processing', 'completed', 'failed', 'expired'] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

/** How a restore reconciles the backup against what the account already holds. */
export const RESTORE_MODES = ['replace', 'merge'] as const;
export type RestoreMode = (typeof RESTORE_MODES)[number];

/** Named windows accepted by the dashboard `period` query parameter. */
export const DASHBOARD_PERIODS = ['week', 'month', 'year', 'custom'] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export function isOneOf<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}
