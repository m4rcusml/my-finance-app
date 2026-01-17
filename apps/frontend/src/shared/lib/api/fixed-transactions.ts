import { request } from "./http";

export type FixedTransaction = {
  id: string;
  userId: string;
  accountId: string;
  categoryId?: string;
  type: 'income' | 'expense';
  value: number;
  day: number;
  description?: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FixedTransactionOccurrence = {
  id: string;
  fixedTransactionId: string;
  date: string; // The scheduled date
  realDate?: string; // The date it was confirmed
  value: number;
  status: 'PENDING' | 'CONFIRMED' | 'SKIPPED';
  fixedTransaction: FixedTransaction;
};

export type CreateFixedTransactionDto = {
  type: 'income' | 'expense';
  value: number;
  day: number;
  accountId: string;
  categoryId?: string;
  description?: string;
  startDate: string;
  endDate?: string;
};

export type UpdateFixedTransactionDto = Partial<CreateFixedTransactionDto>;

export type ListOccurrencesFilters = {
  year: string;
  month: string;
  status?: 'PENDING' | 'CONFIRMED' | 'SKIPPED';
};

export const fixedTransactionsApi = {
  list() {
    return request<FixedTransaction[]>("/fixed-transactions", { auth: true });
  },

  getById(id: string) {
    return request<FixedTransaction>(`/fixed-transactions/${id}`, { auth: true });
  },

  create(dto: CreateFixedTransactionDto) {
    return request<FixedTransaction>("/fixed-transactions", {
      method: "POST",
      auth: true,
      body: dto,
    });
  },

  update(id: string, dto: UpdateFixedTransactionDto) {
    return request<FixedTransaction>(`/fixed-transactions/${id}`, {
      method: "PATCH",
      auth: true,
      body: dto,
    });
  },

  deactivate(id: string) {
    return request<void>(`/fixed-transactions/${id}/deactivate`, {
      method: "PATCH",
      auth: true,
    });
  },

  listOccurrences(filters: ListOccurrencesFilters) {
    const params = new URLSearchParams();
    params.append('year', filters.year.toString());
    params.append('month', filters.month.toString());
    if (filters.status) params.append('status', filters.status);

    return request<FixedTransactionOccurrence[]>(`/fixed-transactions/occurrences?${params.toString()}`, { auth: true });
  },

  confirmOccurrence(id: string, realDate: string) {
    return request<void>(`/fixed-transactions/occurrences/${id}/confirm`, {
      method: "PATCH",
      auth: true,
      body: { realDate },
    });
  },

  skipOccurrence(id: string) {
    return request<void>(`/fixed-transactions/occurrences/${id}/skip`, {
      method: "PATCH",
      auth: true,
    });
  },
};
