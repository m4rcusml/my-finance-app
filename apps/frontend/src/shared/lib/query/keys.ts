import type {
  DashboardQuery,
  ListOccurrencesQuery,
  ListTransactionsQuery,
  OccurrenceStatus,
} from '@finance/contracts';

/**
 * Query keys.
 *
 * Every key starts with the **session key** (the user's id, or `anonymous`).
 * That is what makes logging out and back in as somebody else safe: two users
 * can never collide on a cache entry, and `queryClient.removeQueries({ queryKey: scope(id) })`
 * wipes exactly one user's data. Every filter that changes the server response —
 * including `page`, `limit` and `creditCardId`, which the old keys dropped — is
 * part of the key, so a filtered list can never serve another filter's rows.
 */

export type SessionKey = string;

const stable = <T extends Record<string, unknown>>(filters: T): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(filters)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .sort(([a], [b]) => a.localeCompare(b)),
  );

export const scope = (session: SessionKey) => ['session', session] as const;

export const queryKeys = {
  scope,

  session: {
    current: () => ['session', 'current'] as const,
  },

  profile: (s: SessionKey) => [...scope(s), 'profile'] as const,

  accounts: {
    all: (s: SessionKey) => [...scope(s), 'accounts'] as const,
    list: (s: SessionKey, filters: { page?: number; limit?: number; includeArchived?: boolean } = {}) =>
      [...scope(s), 'accounts', 'list', stable(filters)] as const,
    detail: (s: SessionKey, id: string) => [...scope(s), 'accounts', 'detail', id] as const,
  },

  creditCards: {
    all: (s: SessionKey) => [...scope(s), 'credit-cards'] as const,
    list: (s: SessionKey, filters: { page?: number; limit?: number; includeArchived?: boolean } = {}) =>
      [...scope(s), 'credit-cards', 'list', stable(filters)] as const,
    detail: (s: SessionKey, id: string) => [...scope(s), 'credit-cards', 'detail', id] as const,
  },

  categories: {
    all: (s: SessionKey) => [...scope(s), 'categories'] as const,
    list: (
      s: SessionKey,
      filters: { page?: number; limit?: number; includeArchived?: boolean; type?: string } = {},
    ) => [...scope(s), 'categories', 'list', stable(filters)] as const,
    detail: (s: SessionKey, id: string) => [...scope(s), 'categories', 'detail', id] as const,
  },

  transactions: {
    all: (s: SessionKey) => [...scope(s), 'transactions'] as const,
    list: (s: SessionKey, filters: ListTransactionsQuery = {}) =>
      [...scope(s), 'transactions', 'list', stable(filters)] as const,
    uncategorized: (s: SessionKey, filters: ListTransactionsQuery = {}) =>
      [...scope(s), 'transactions', 'uncategorized', stable(filters)] as const,
    detail: (s: SessionKey, id: string) => [...scope(s), 'transactions', 'detail', id] as const,
    summary: (s: SessionKey, filters: { from: string; to: string }) =>
      [...scope(s), 'transactions', 'summary', stable(filters)] as const,
    projection: (s: SessionKey, filters: { months?: number } = {}) =>
      [...scope(s), 'transactions', 'projection', stable(filters)] as const,
  },

  fixedTransactions: {
    all: (s: SessionKey) => [...scope(s), 'fixed-transactions'] as const,
    list: (s: SessionKey, filters: { page?: number; limit?: number; includeArchived?: boolean } = {}) =>
      [...scope(s), 'fixed-transactions', 'list', stable(filters)] as const,
    detail: (s: SessionKey, id: string) => [...scope(s), 'fixed-transactions', 'detail', id] as const,
    occurrences: (s: SessionKey, filters: ListOccurrencesQuery & { status?: OccurrenceStatus } = {}) =>
      [...scope(s), 'fixed-transactions', 'occurrences', stable(filters)] as const,
  },

  investments: {
    all: (s: SessionKey) => [...scope(s), 'investments'] as const,
    list: (s: SessionKey, filters: { page?: number; limit?: number; type?: string } = {}) =>
      [...scope(s), 'investments', 'list', stable(filters)] as const,
    detail: (s: SessionKey, id: string) => [...scope(s), 'investments', 'detail', id] as const,
    summary: (s: SessionKey) => [...scope(s), 'investments', 'summary'] as const,
  },

  marketAssets: {
    all: (s: SessionKey) => [...scope(s), 'market-assets'] as const,
    list: (s: SessionKey, filters: { page?: number; limit?: number } = {}) =>
      [...scope(s), 'market-assets', 'list', stable(filters)] as const,
  },

  goals: {
    all: (s: SessionKey) => [...scope(s), 'goals'] as const,
    list: (s: SessionKey, filters: { page?: number; limit?: number } = {}) =>
      [...scope(s), 'goals', 'list', stable(filters)] as const,
    detail: (s: SessionKey, id: string) => [...scope(s), 'goals', 'detail', id] as const,
  },

  imports: {
    all: (s: SessionKey) => [...scope(s), 'imports'] as const,
    history: (s: SessionKey, filters: { page?: number; limit?: number } = {}) =>
      [...scope(s), 'imports', 'history', stable(filters)] as const,
    batch: (s: SessionKey, batchId: string) => [...scope(s), 'imports', 'batch', batchId] as const,
  },

  dashboard: {
    all: (s: SessionKey) => [...scope(s), 'dashboard'] as const,
    overview: (s: SessionKey, filters: DashboardQuery = {}) =>
      [...scope(s), 'dashboard', 'overview', stable(filters)] as const,
  },
};
