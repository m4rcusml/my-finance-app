/**
 * Resource representations exactly as the API serialises them.
 *
 * These types are the contract. The backend proves it conforms with contract
 * tests that run HTTP requests with mocked dependencies plus PostgreSQL-backed
 * integration suites in `apps/backend/test/integration`; the frontend consumes
 * them directly, so drift on either side is a compile error or a red test.
 */

import type {
  AccountType,
  CategoryType,
  FixedTransactionType,
  GoalType,
  ImportFileType,
  ImportOrigin,
  ImportStatus,
  InvestmentType,
  MarketAssetType,
  OccurrenceStatus,
  TransactionSource,
  TransactionType,
} from './enums';
import type { CivilDate, IsoTimestamp, Money, PaginationQuery, Quantity, YearMonth } from './primitives';

// ---------------------------------------------------------------------------
// Auth & user
// ---------------------------------------------------------------------------

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

/**
 * The access token is short-lived and is meant to be held in memory only.
 * The refresh token never appears in a body — it is set as an `HttpOnly`
 * cookie by the server. See `docs/architecture.md#sessao-e-autenticacao`.
 */
export interface AuthSessionResponse {
  accessToken: string;
  /** Seconds until `accessToken` expires. */
  expiresIn: number;
  user: UserProfile;
}

/**
 * Short-lived double-submit value used only to authorize a refresh request.
 * The matching cookie is set by the same response. Unlike the refresh token,
 * this value is deliberately returned to the SPA so it can echo it in the
 * `X-CSRF-Token` header without reading API-domain cookies.
 */
export interface CsrfTokenResponse {
  csrfToken: string;
}

export interface UpdateProfileRequest {
  name?: string | null;
  email?: string;
  /** Required when `email` changes; omitted for name-only updates. */
  currentPassword?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface DeleteAccountRequest {
  password: string;
  /** Must equal the literal `EXCLUIR MINHA CONTA`. */
  confirmation: string;
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export interface Account {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  initialBalance: Money;
  /** `initialBalance` plus every income minus every expense booked to it. */
  balance: Money;
  /** Archived accounts stay readable for history but leave selectors and totals. */
  isActive: boolean;
  archivedAt: IsoTimestamp | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface CreateAccountRequest {
  name: string;
  institution: string;
  type: AccountType;
  initialBalance: Money;
}

export type UpdateAccountRequest = Partial<CreateAccountRequest>;

// ---------------------------------------------------------------------------
// Credit cards
// ---------------------------------------------------------------------------

export interface CreditCard {
  id: string;
  name: string;
  institution: string;
  limitTotal: Money;
  /** Day of month the invoice closes, 1-31. `null` means "calendar month". */
  closingDay: number | null;
  /** Expenses booked inside the **current open cycle** only. */
  cycleUsedAmount: Money;
  /** `limitTotal - cycleUsedAmount`, floored at 0 is NOT applied: it can go negative. */
  availableAmount: Money;
  /** The window `cycleUsedAmount` was computed over, inclusive on both ends. */
  currentCycle: BillingCycle;
  isActive: boolean;
  archivedAt: IsoTimestamp | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface BillingCycle {
  /** First civil day of the cycle, inclusive. */
  start: CivilDate;
  /** Last civil day of the cycle, inclusive. */
  end: CivilDate;
}

export interface CreateCreditCardRequest {
  name: string;
  institution: string;
  limitTotal: Money;
  closingDay?: number | null;
}

export type UpdateCreditCardRequest = Partial<CreateCreditCardRequest>;

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  /** Optional display color; older backups omit it. */
  color?: string | null;
  isActive: boolean;
  archivedAt: IsoTimestamp | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface CreateCategoryRequest {
  name: string;
  type: CategoryType;
  color?: string | null;
}

export interface ListCategoriesQuery {
  page?: number;
  limit?: number;
  includeArchived?: boolean;
  status?: 'active' | 'archived' | 'all';
  type?: CategoryType;
  search?: string;
}

export type UpdateCategoryRequest = Partial<CreateCategoryRequest>;

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

/**
 * Exactly one of `accountId` / `creditCardId` is non-null. This is enforced by
 * the DTO, by the service and by a CHECK constraint in PostgreSQL.
 */
export interface Transaction {
  id: string;
  type: TransactionType;
  value: Money;
  date: CivilDate;
  accountId: string | null;
  creditCardId: string | null;
  categoryId: string | null;
  description: string | null;
  source: TransactionSource;
  /** Stable id from the source file; only set when `source === 'imported'`. */
  externalId: string | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

/** `Transaction` plus the denormalised labels list screens need to avoid N+1 lookups. */
export interface TransactionWithRelations extends Transaction {
  category: Pick<Category, 'id' | 'name' | 'type'> | null;
  account: Pick<Account, 'id' | 'name'> | null;
  creditCard: Pick<CreditCard, 'id' | 'name'> | null;
}

export interface CreateTransactionRequest {
  type: TransactionType;
  value: Money;
  date: CivilDate;
  accountId?: string | null;
  creditCardId?: string | null;
  categoryId?: string | null;
  description?: string | null;
}

/**
 * PATCH semantics: an omitted key is left untouched; an explicit `null` clears
 * the relation. The server computes the final state and re-validates the
 * exactly-one-source invariant against it, not against the patch alone.
 */
export type UpdateTransactionRequest = Partial<CreateTransactionRequest>;

export interface ListTransactionsQuery {
  /** Case-insensitive description search, applied before pagination. */
  search?: string;
  type?: TransactionType;
  source?: TransactionSource;
  /** Inclusive lower bound, civil date. */
  fromDate?: CivilDate;
  /** Inclusive upper bound, civil date. The whole day is included. */
  toDate?: CivilDate;
  accountId?: string;
  creditCardId?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
}

export interface TransactionSummary {
  income: Money;
  expense: Money;
  net: Money;
  count: number;
  from: CivilDate;
  to: CivilDate;
}

// ---------------------------------------------------------------------------
// Fixed (recurring) transactions
// ---------------------------------------------------------------------------

export interface FixedTransaction {
  id: string;
  type: FixedTransactionType;
  value: Money;
  /** Nominal day of the month, 1-31, clamped down in shorter months. */
  referenceDay: number;
  /** How many days before/after `referenceDay` the occurrence may be booked. */
  marginDays: number;
  accountId: string | null;
  creditCardId: string | null;
  categoryId: string;
  description: string | null;
  isActive: boolean;
  archivedAt: IsoTimestamp | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface CreateFixedTransactionRequest {
  type: FixedTransactionType;
  value: Money;
  referenceDay: number;
  marginDays?: number;
  accountId?: string | null;
  creditCardId?: string | null;
  categoryId: string;
  description?: string | null;
}

export type UpdateFixedTransactionRequest = Partial<CreateFixedTransactionRequest> & {
  isActive?: boolean;
};

export interface ListFixedTransactionsQuery extends PaginationQuery {
  /** Omit to list active and archived templates; set to select one state. */
  isActive?: boolean;
  type?: FixedTransactionType;
}

export interface FixedTransactionOccurrence {
  id: string;
  fixedTransactionId: string;
  periodYear: number;
  /** 1-12. */
  periodMonth: number;
  status: OccurrenceStatus;
  /** The day the user says it actually happened. Only set when `confirmed`. */
  realDate: CivilDate | null;
  /** The transaction created by confirming. Only set when `confirmed`. */
  transactionId: string | null;
  /** The nominal due day for this period, `referenceDay` clamped to the month. */
  dueDate: CivilDate;
  /** Snapshot of the template at generation time, so history never mutates. */
  type: FixedTransactionType;
  value: Money;
  description: string | null;
  categoryId: string;
  accountId: string | null;
  creditCardId: string | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface OccurrenceWithTemplate extends FixedTransactionOccurrence {
  fixedTransaction: Pick<FixedTransaction, 'id' | 'description' | 'referenceDay'>;
  category: Pick<Category, 'id' | 'name' | 'type'> | null;
}

export interface ListOccurrencesQuery {
  year?: number;
  month?: number;
  status?: OccurrenceStatus;
  fixedTransactionId?: string;
  page?: number;
  limit?: number;
}

export interface ConfirmOccurrenceRequest {
  /** The real date the money moved. Defaults to the occurrence's `dueDate`. */
  realDate?: CivilDate;
  /** Override the template amount for this period only. */
  value?: Money;
}

// ---------------------------------------------------------------------------
// Investments (manual portfolio — no live quotes in V1)
// ---------------------------------------------------------------------------

export interface MarketAsset {
  id: string;
  symbol: string;
  type: MarketAssetType;
  exchange: string;
  name: string | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface CreateMarketAssetRequest {
  symbol: string;
  type: MarketAssetType;
  exchange: string;
  name?: string | null;
}

export type UpdateMarketAssetRequest = Partial<CreateMarketAssetRequest>;

export interface Investment {
  id: string;
  marketAssetId: string | null;
  broker: string;
  type: InvestmentType;
  quantity: Quantity;
  buyPrice: Money;
  investedAmount: Money;
  buyDate: CivilDate;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface InvestmentWithAsset extends Investment {
  marketAsset: MarketAsset | null;
}

export interface CreateInvestmentRequest {
  marketAssetId?: string | null;
  broker: string;
  type: InvestmentType;
  quantity: Quantity;
  buyPrice: Money;
  buyDate: CivilDate;
  /** Optional; defaults to `quantity * buyPrice` rounded to 2 places. */
  investedAmount?: Money;
}

export type UpdateInvestmentRequest = Partial<CreateInvestmentRequest>;

/**
 * Cost-basis only. V1 has **no** market prices, so there is no current value,
 * no profit and no return percentage — see `docs/backlog.md`.
 */
export interface PortfolioSummary {
  totalInvested: Money;
  positions: number;
  byType: { type: InvestmentType; totalInvested: Money; positions: number }[];
}

// ---------------------------------------------------------------------------
// Goals (manual progress)
// ---------------------------------------------------------------------------

export interface Goal {
  id: string;
  name: string;
  type: GoalType;
  targetAmount: Money;
  /** Entered by the user. V1 never derives this from transactions. */
  currentAmount: Money;
  deadline: CivilDate | null;
  relatedCategoryId: string | null;
  relatedAccountId: string | null;
  /** `currentAmount / targetAmount`, clamped to [0, 1] and rounded to 4 places. */
  progress: number;
  /** Always `'manual'` in V1; the field exists so the UI can label it honestly. */
  progressSource: 'manual';
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface CreateGoalRequest {
  name: string;
  type: GoalType;
  targetAmount: Money;
  currentAmount?: Money;
  deadline?: CivilDate | null;
  relatedCategoryId?: string | null;
  relatedAccountId?: string | null;
}

export type UpdateGoalRequest = Partial<CreateGoalRequest>;

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

export interface ImportPreviewRow {
  /** Stable 1-based index within the uploaded file. */
  rowNumber: number;
  type: TransactionType | null;
  value: Money | null;
  date: CivilDate | null;
  description: string | null;
  /** Deterministic id derived from the file content; used for deduplication. */
  externalId: string | null;
  /** `true` when an existing transaction already carries this `externalId`. */
  duplicate: boolean;
  /** Non-empty means the row cannot be imported; the other rows still can. */
  errors: string[];
}

/**
 * The preview is persisted server-side. `confirm` references the batch and a
 * set of row numbers; it never accepts transaction payloads from the client.
 */
export interface ImportPreviewResponse {
  batchId: string;
  fileName: string;
  fileType: ImportFileType;
  origin: ImportOrigin;
  status: ImportStatus;
  /** After this instant the batch is no longer confirmable. */
  expiresAt: IsoTimestamp;
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  invalidRows: number;
  rows: ImportPreviewRow[];
}

export interface ConfirmImportRequest {
  /** Destination; exactly one of the two, re-validated for ownership. */
  accountId?: string | null;
  creditCardId?: string | null;
  /** Row numbers to import. Omit to import every valid, non-duplicate row. */
  rowNumbers?: number[];
}

export interface ConfirmImportResponse {
  batchId: string;
  importedFileId: string;
  status: ImportStatus;
  imported: number;
  skippedDuplicates: number;
  skippedInvalid: number;
}

export interface ImportedFile {
  id: string;
  origin: ImportOrigin;
  fileName: string;
  fileType: ImportFileType;
  status: ImportStatus;
  importedAt: IsoTimestamp;
  totalRecords: number;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

/** Bumped whenever the payload shape changes incompatibly. */
export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupFile {
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: IsoTimestamp;
  /** Identifies the origin account. Never contains credentials or a password hash. */
  user: Pick<UserProfile, 'email' | 'name'>;
  accounts: Account[];
  creditCards: Omit<CreditCard, 'cycleUsedAmount' | 'availableAmount' | 'currentCycle'>[];
  categories: Category[];
  transactions: Transaction[];
  fixedTransactions: FixedTransaction[];
  fixedTransactionOccurrences: FixedTransactionOccurrence[];
  marketAssets: MarketAsset[];
  investments: Investment[];
  goals: Goal[];
  importedFiles: ImportedFile[];
}

export interface RestoreResultCounts {
  accounts: number;
  creditCards: number;
  categories: number;
  transactions: number;
  fixedTransactions: number;
  fixedTransactionOccurrences: number;
  marketAssets: number;
  investments: number;
  goals: number;
  importedFiles: number;
}

export interface RestoreResponse {
  mode: 'replace' | 'merge';
  schemaVersion: number;
  created: RestoreResultCounts;
  /** Only meaningful for `replace`. */
  deleted: RestoreResultCounts;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardQuery {
  /** Anchor day for the window. Defaults to today in `APP_TIMEZONE`. */
  referenceDate?: CivilDate;
  /** Defaults to `month`. */
  period?: 'week' | 'month' | 'year' | 'custom';
  /** Required when `period === 'custom'`. */
  from?: CivilDate;
  to?: CivilDate;
}

export interface PeriodTotals {
  income: Money;
  expense: Money;
  net: Money;
  transactionCount: number;
}

export interface TrendedValue {
  value: Money;
  /** Percent change vs the previous comparable window; `null` when undefined. */
  trending: number | null;
}

export interface MonthlyNet {
  /** `YYYY-MM`. */
  month: YearMonth;
  income: Money;
  expense: Money;
  net: Money;
}

export interface DashboardOverview {
  period: {
    period: 'week' | 'month' | 'year' | 'custom';
    /** Inclusive. */
    from: CivilDate;
    /** Inclusive. */
    to: CivilDate;
    referenceDate: CivilDate;
    timezone: string;
  };
  totals: {
    /** Cash across non-investment accounts only. */
    netBalance: Money;
    /** Balance held in accounts of type `investment`, reported separately. */
    investedAccountBalance: Money;
    /** Cost basis of the manual investment portfolio. */
    portfolioInvested: Money;
    totalCreditLimit: Money;
    /** Sum of every card's current-cycle usage. */
    totalCreditUsedThisCycle: Money;
    totalCreditAvailable: Money;
    current: PeriodTotals;
    previous: PeriodTotals;
    trends: { income: TrendedValue; expense: TrendedValue; net: TrendedValue };
  };
  accounts: Account[];
  creditCards: CreditCard[];
  /** Newest first, limited by its own `latestTransactionsLimit` (default 5). */
  latestTransactions: TransactionWithRelations[];
  /** Pending occurrences for the current period, newest due first. */
  pendingOccurrences: OccurrenceWithTemplate[];
  /** Exactly 12 entries ending at the reference month, zero-filled. */
  annualBalance: MonthlyNet[];
  uncategorizedCount: number;
}

/**
 * Average monthly expense over the last N **complete** months. The current,
 * partial month is excluded, and months with no activity count as zero.
 */
export interface ExpenseProjection {
  projectedMonthlyExpense: Money;
  basedOnMonths: number;
  window: { from: CivilDate; to: CivilDate };
  months: MonthlyNet[];
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export interface HealthResponse {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
}

export interface ReadinessResponse {
  status: 'ok' | 'error';
  checks: { database: 'ok' | 'error' };
}
