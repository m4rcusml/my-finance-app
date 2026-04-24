import { request } from './http';

export type Transaction = {
  id: string;
  userId: string;
  accountId?: string;
  creditCardId?: string;
  categoryId?: string;
  type: 'INCOME' | 'EXPENSE' | 'income' | 'expense';
  value: number;
  date: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateTransactionDto = {
  type: 'income' | 'expense';
  value: number;
  date: string;
  accountId?: string;
  creditCardId?: string;
  categoryId?: string;
  description?: string;
};

export type UpdateTransactionDto = Partial<CreateTransactionDto>;

export type ListTransactionsFilters = {
  type?: 'income' | 'expense';
  fromDate?: string;
  toDate?: string;
  accountId?: string;
  creditCardId?: string;
  categoryId?: string;
};

export const transactionsApi = {
  list(filters?: ListTransactionsFilters) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    return request<Transaction[]>(`/transactions?${params.toString()}`, { auth: true });
  },

  listUncategorized(filters?: ListTransactionsFilters) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    return request<Transaction[]>(`/transactions/uncategorized?${params.toString()}`, { auth: true });
  },

  getById(id: string) {
    return request<Transaction>(`/transactions/${id}`, { auth: true });
  },

  create(dto: CreateTransactionDto) {
    return request<Transaction>('/transactions', {
      method: 'POST',
      auth: true,
      body: dto,
    });
  },

  update(id: string, dto: UpdateTransactionDto) {
    return request<Transaction>(`/transactions/${id}`, {
      method: 'PATCH',
      auth: true,
      body: dto,
    });
  },

  remove(id: string) {
    return request<void>(`/transactions/${id}`, {
      method: 'DELETE',
      auth: true,
    });
  },
};
