import {
  type Account,
  type AuthSessionResponse,
  type BackupFile,
  type Category,
  type ChangePasswordRequest,
  type ConfirmImportRequest,
  type ConfirmImportResponse,
  type CreateAccountRequest,
  type CreateCategoryRequest,
  type CreateCreditCardRequest,
  type CreateFixedTransactionRequest,
  type CreateGoalRequest,
  type CreateInvestmentRequest,
  type CreateMarketAssetRequest,
  type CreateTransactionRequest,
  type CsrfTokenResponse,
  type CreditCard,
  type DashboardOverview,
  type DashboardQuery,
  type DeleteAccountRequest,
  type ExpenseProjection,
  type FixedTransaction,
  type Goal,
  type ImportedFile,
  type ImportPreviewResponse,
  type Investment,
  type InvestmentWithAsset,
  type ListOccurrencesQuery,
  type ListCategoriesQuery,
  type ListFixedTransactionsQuery,
  type ListTransactionsQuery,
  type LoginRequest,
  type MarketAsset,
  type OccurrenceWithTemplate,
  type PaginatedResponse,
  type PortfolioSummary,
  type RegisterRequest,
  type RestoreMode,
  type RestoreResponse,
  routes,
  type Transaction,
  type TransactionSummary,
  type TransactionWithRelations,
  type UpdateAccountRequest,
  type UpdateCategoryRequest,
  type UpdateCreditCardRequest,
  type UpdateFixedTransactionRequest,
  type UpdateGoalRequest,
  type UpdateInvestmentRequest,
  type UpdateMarketAssetRequest,
  type UpdateProfileRequest,
  type UpdateTransactionRequest,
  type UserProfile,
} from '@finance/contracts';
import { request, upload } from './http';

/**
 * Typed API surface.
 *
 * Every list function returns `PaginatedResponse<T>` because that is what the
 * server actually sends. The previous client typed these as bare arrays, which
 * is why every list screen rendered an empty state and every `.map()` threw.
 */

export type ListQuery = { page?: number; limit?: number };

export const authApi = {
  register: (body: RegisterRequest) =>
    request<AuthSessionResponse>(routes.auth.register, { method: 'POST', body, auth: false, skipAuthRedirect: true }),
  login: (body: LoginRequest) =>
    request<AuthSessionResponse>(routes.auth.login, { method: 'POST', body, auth: false, skipAuthRedirect: true }),
  csrf: () =>
    request<CsrfTokenResponse>(routes.auth.csrf, {
      auth: false,
      skipAuthRedirect: true,
    }),
  refresh: (csrfToken: string) =>
    request<AuthSessionResponse>(routes.auth.refresh, {
      method: 'POST',
      auth: false,
      skipAuthRedirect: true,
      headers: { 'X-CSRF-Token': csrfToken },
    }),
  logout: () => request<void>(routes.auth.logout, { method: 'POST', skipAuthRedirect: true }),
  me: () => request<UserProfile>(routes.auth.me),
};

export const usersApi = {
  me: () => request<UserProfile>(routes.users.me),
  update: (body: UpdateProfileRequest) => request<UserProfile>(routes.users.me, { method: 'PATCH', body }),
  changePassword: (body: ChangePasswordRequest) => request<void>(routes.users.password, { method: 'PATCH', body }),
  remove: (body: DeleteAccountRequest) => request<void>(routes.users.me, { method: 'DELETE', body }),
};

export const accountsApi = {
  list: (query: ListQuery & { includeArchived?: boolean } = {}) =>
    request<PaginatedResponse<Account>>(routes.accounts.root, { query }),
  get: (id: string) => request<Account>(routes.accounts.byId(id)),
  create: (body: CreateAccountRequest) => request<Account>(routes.accounts.root, { method: 'POST', body }),
  update: (id: string, body: UpdateAccountRequest) =>
    request<Account>(routes.accounts.byId(id), { method: 'PATCH', body }),
  archive: (id: string) => request<Account>(routes.accounts.archive(id), { method: 'POST' }),
  restore: (id: string) => request<Account>(routes.accounts.restore(id), { method: 'POST' }),
  remove: (id: string) => request<void>(routes.accounts.byId(id), { method: 'DELETE' }),
};

export const creditCardsApi = {
  list: (query: ListQuery & { includeArchived?: boolean } = {}) =>
    request<PaginatedResponse<CreditCard>>(routes.creditCards.root, { query }),
  get: (id: string) => request<CreditCard>(routes.creditCards.byId(id)),
  create: (body: CreateCreditCardRequest) => request<CreditCard>(routes.creditCards.root, { method: 'POST', body }),
  update: (id: string, body: UpdateCreditCardRequest) =>
    request<CreditCard>(routes.creditCards.byId(id), { method: 'PATCH', body }),
  archive: (id: string) => request<CreditCard>(routes.creditCards.archive(id), { method: 'POST' }),
  restore: (id: string) => request<CreditCard>(routes.creditCards.restore(id), { method: 'POST' }),
  remove: (id: string) => request<void>(routes.creditCards.byId(id), { method: 'DELETE' }),
};

export const categoriesApi = {
  list: (query: ListCategoriesQuery = {}) => request<PaginatedResponse<Category>>(routes.categories.root, { query }),
  get: (id: string) => request<Category>(routes.categories.byId(id)),
  create: (body: CreateCategoryRequest) => request<Category>(routes.categories.root, { method: 'POST', body }),
  update: (id: string, body: UpdateCategoryRequest) =>
    request<Category>(routes.categories.byId(id), { method: 'PATCH', body }),
  archive: (id: string) => request<Category>(routes.categories.archive(id), { method: 'POST' }),
  restore: (id: string) => request<Category>(routes.categories.restore(id), { method: 'POST' }),
  remove: (id: string) => request<void>(routes.categories.byId(id), { method: 'DELETE' }),
};

export const transactionsApi = {
  list: (query: ListTransactionsQuery = {}) =>
    request<PaginatedResponse<TransactionWithRelations>>(routes.transactions.root, {
      query,
    }),
  uncategorized: (query: ListTransactionsQuery = {}) =>
    request<PaginatedResponse<TransactionWithRelations>>(routes.transactions.uncategorized, {
      query,
    }),
  get: (id: string) => request<Transaction>(routes.transactions.byId(id)),
  create: (body: CreateTransactionRequest) => request<Transaction>(routes.transactions.root, { method: 'POST', body }),
  update: (id: string, body: UpdateTransactionRequest) =>
    request<Transaction>(routes.transactions.byId(id), { method: 'PATCH', body }),
  remove: (id: string) => request<void>(routes.transactions.byId(id), { method: 'DELETE' }),
  summary: (query: { from: string; to: string }) => request<TransactionSummary>(routes.transactions.summary, { query }),
  projection: (query: { months?: number } = {}) =>
    request<ExpenseProjection>(routes.transactions.projection, { query }),
};

export const fixedTransactionsApi = {
  list: (query: ListFixedTransactionsQuery = {}) =>
    request<PaginatedResponse<FixedTransaction>>(routes.fixedTransactions.root, { query }),
  get: (id: string) => request<FixedTransaction>(routes.fixedTransactions.byId(id)),
  create: (body: CreateFixedTransactionRequest) =>
    request<FixedTransaction>(routes.fixedTransactions.root, { method: 'POST', body }),
  update: (id: string, body: UpdateFixedTransactionRequest) =>
    request<FixedTransaction>(routes.fixedTransactions.byId(id), { method: 'PATCH', body }),
  archive: (id: string) => request<FixedTransaction>(routes.fixedTransactions.archive(id), { method: 'POST' }),
  restore: (id: string) => request<FixedTransaction>(routes.fixedTransactions.restore(id), { method: 'POST' }),
  remove: (id: string) => request<void>(routes.fixedTransactions.byId(id), { method: 'DELETE' }),

  occurrences: (query: ListOccurrencesQuery = {}) =>
    request<PaginatedResponse<OccurrenceWithTemplate>>(routes.fixedTransactions.occurrences, {
      query,
    }),
  confirmOccurrence: (id: string, body: { realDate?: string; value?: number } = {}) =>
    request<OccurrenceWithTemplate>(routes.fixedTransactions.confirmOccurrence(id), { method: 'POST', body }),
  skipOccurrence: (id: string) =>
    request<OccurrenceWithTemplate>(routes.fixedTransactions.skipOccurrence(id), { method: 'POST' }),
};

export const investmentsApi = {
  list: (query: ListQuery & { type?: string; marketAssetId?: string } = {}) =>
    request<PaginatedResponse<InvestmentWithAsset>>(routes.investments.root, { query }),
  get: (id: string) => request<InvestmentWithAsset>(routes.investments.byId(id)),
  create: (body: CreateInvestmentRequest) => request<Investment>(routes.investments.root, { method: 'POST', body }),
  update: (id: string, body: UpdateInvestmentRequest) =>
    request<Investment>(routes.investments.byId(id), { method: 'PATCH', body }),
  remove: (id: string) => request<void>(routes.investments.byId(id), { method: 'DELETE' }),
  summary: () => request<PortfolioSummary>(routes.investments.summary),
};

export const marketAssetsApi = {
  list: (query: ListQuery = {}) => request<PaginatedResponse<MarketAsset>>(routes.marketAssets.root, { query }),
  create: (body: CreateMarketAssetRequest) => request<MarketAsset>(routes.marketAssets.root, { method: 'POST', body }),
  update: (id: string, body: UpdateMarketAssetRequest) =>
    request<MarketAsset>(routes.marketAssets.byId(id), { method: 'PATCH', body }),
  remove: (id: string) => request<void>(routes.marketAssets.byId(id), { method: 'DELETE' }),
};

export const goalsApi = {
  list: (query: ListQuery = {}) => request<PaginatedResponse<Goal>>(routes.goals.root, { query }),
  get: (id: string) => request<Goal>(routes.goals.byId(id)),
  create: (body: CreateGoalRequest) => request<Goal>(routes.goals.root, { method: 'POST', body }),
  update: (id: string, body: UpdateGoalRequest) => request<Goal>(routes.goals.byId(id), { method: 'PATCH', body }),
  remove: (id: string) => request<void>(routes.goals.byId(id), { method: 'DELETE' }),
};

export const importsApi = {
  preview: (file: File, origin: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('origin', origin);
    return upload<ImportPreviewResponse>(routes.imports.preview, form);
  },
  batch: (batchId: string) => request<ImportPreviewResponse>(routes.imports.batch(batchId)),
  confirm: (batchId: string, body: ConfirmImportRequest) =>
    request<ConfirmImportResponse>(routes.imports.confirm(batchId), { method: 'POST', body }),
  history: (query: ListQuery = {}) => request<PaginatedResponse<ImportedFile>>(routes.imports.history, { query }),
};

export const backupApi = {
  export: () => request<BackupFile>(routes.backup.export),
  restore: (mode: RestoreMode, data: BackupFile) =>
    request<RestoreResponse>(routes.backup.restore, { method: 'POST', body: { mode, data } }),
};

export const dashboardApi = {
  overview: (query: DashboardQuery = {}) =>
    request<DashboardOverview>(routes.dashboard.root, {
      query,
    }),
};
