/** Single source of truth for the API surface. Used by the frontend client and by the smoke tests. */

export const API_PREFIX = '/api/v1';

export const routes = {
  health: { live: '/health/live', ready: '/health/ready' },
  auth: {
    register: '/auth/register',
    login: '/auth/login',
    csrf: '/auth/csrf',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    me: '/auth/me',
  },
  users: {
    me: '/users/me',
    password: '/users/me/password',
  },
  accounts: {
    root: '/accounts',
    byId: (id: string) => `/accounts/${id}`,
    archive: (id: string) => `/accounts/${id}/archive`,
    restore: (id: string) => `/accounts/${id}/restore`,
  },
  creditCards: {
    root: '/credit-cards',
    byId: (id: string) => `/credit-cards/${id}`,
    archive: (id: string) => `/credit-cards/${id}/archive`,
    restore: (id: string) => `/credit-cards/${id}/restore`,
  },
  categories: {
    root: '/categories',
    byId: (id: string) => `/categories/${id}`,
    archive: (id: string) => `/categories/${id}/archive`,
    restore: (id: string) => `/categories/${id}/restore`,
  },
  transactions: {
    root: '/transactions',
    byId: (id: string) => `/transactions/${id}`,
    uncategorized: '/transactions/uncategorized',
    summary: '/transactions/summary',
    projection: '/transactions/projection',
  },
  fixedTransactions: {
    root: '/fixed-transactions',
    byId: (id: string) => `/fixed-transactions/${id}`,
    archive: (id: string) => `/fixed-transactions/${id}/archive`,
    restore: (id: string) => `/fixed-transactions/${id}/restore`,
    occurrences: '/fixed-transactions/occurrences',
    confirmOccurrence: (id: string) => `/fixed-transactions/occurrences/${id}/confirm`,
    skipOccurrence: (id: string) => `/fixed-transactions/occurrences/${id}/skip`,
  },
  investments: { root: '/investments', byId: (id: string) => `/investments/${id}`, summary: '/investments/summary' },
  marketAssets: { root: '/market-assets', byId: (id: string) => `/market-assets/${id}` },
  goals: { root: '/goals', byId: (id: string) => `/goals/${id}` },
  imports: {
    preview: '/imports/preview',
    confirm: (batchId: string) => `/imports/${batchId}/confirm`,
    batch: (batchId: string) => `/imports/${batchId}`,
    history: '/imports',
  },
  backup: { export: '/backup/export', restore: '/backup/restore' },
  dashboard: { root: '/dashboard' },
} as const;
