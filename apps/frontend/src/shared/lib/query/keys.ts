export const queryKeys = {
  auth: {
    me: () => ['auth', 'me'] as const,
  },
  accounts: {
    all: () => ['accounts'] as const,
    detail: (id: string) => ['accounts', id] as const,
  },
  categories: {
    all: () => ['categories'] as const,
    detail: (id: string) => ['categories', id] as const,
  },
  transactions: {
    all: () => ['transactions'] as const,
    list: (
      filters: {
        type?: 'income' | 'expense';
        fromDate?: string;
        toDate?: string;
        accountId?: string;
        categoryId?: string;
      } = {},
    ) => ['transactions', 'list', filters] as const,
    uncategorized: (
      filters: {
        type?: 'income' | 'expense';
        fromDate?: string;
        toDate?: string;
        accountId?: string;
        categoryId?: string;
      } = {},
    ) => ['transactions', 'uncategorized', filters] as const,
    detail: (id: string) => ['transactions', id] as const,
  },
  fixedTransactions: {
    all: () => ['fixed-transactions'] as const,
    detail: (id: string) => ['fixed-transactions', id] as const,
    occurrences: (filters: { year: string; month: string; status?: 'PENDING' | 'CONFIRMED' | 'SKIPPED' }) =>
      ['fixed-transactions', 'occurrences', filters] as const,
  },
  creditCards: {
    all: () => ['credit-cards'] as const,
    detail: (id: string) => ['credit-cards', id] as const,
  },
  dashboard: {
    all: () => ['dashboard'] as const,
    overview: (filters: { referenceDate?: string } = {}) => ['dashboard', filters] as const,
  },
};
