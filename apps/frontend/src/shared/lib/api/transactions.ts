import { request } from "./http";

export type Transaction = {
  id: string;
  userId: string;
  accountId: string;
  categoryId?: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number; // backend says 'value', need to double check DTO
  date: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

// Based on backend DTO from step 24:
// export class CreateTransactionDto {
//   type: 'income' | 'expense';
//   value: number;
//   date: string;
//   accountId: string;
//   categoryId?: string;
//   description?: string;
// }
// Note: Backend might use lowercase 'income'/'expense' in DTO but uppercase 'INCOME'/'EXPENSE' in DB/Typos? 
// Step 24 says: type: 'income' | 'expense';

export type CreateTransactionDto = {
  type: 'income' | 'expense';
  value: number;
  date: string;
  accountId: string;
  categoryId?: string;
  description?: string;
};

export type UpdateTransactionDto = Partial<CreateTransactionDto>;

export type ListTransactionsFilters = {
  type?: 'income' | 'expense';
  fromDate?: string;
  toDate?: string;
  accountId?: string;
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
    return request<Transaction>("/transactions", {
      method: "POST",
      auth: true,
      body: dto,
    });
  },

  update(id: string, dto: UpdateTransactionDto) {
    return request<Transaction>(`/transactions/${id}`, {
      method: "PATCH",
      auth: true,
      body: dto,
    });
  },

  remove(id: string) {
    return request<void>(`/transactions/${id}`, {
      method: "DELETE",
      auth: true,
    });
  },
};
