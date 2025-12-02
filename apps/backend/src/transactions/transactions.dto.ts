export class CreateTransactionDto {
  type: 'income' | 'expense';
  value: number;
  date: string;
  accountId: string;
  categoryId?: string;
  description?: string;
}

export class UpdateTransactionDto {
  type?: 'income' | 'expense';
  value?: number;
  date?: string;
  accountId?: string;
  categoryId?: string;
  description?: string;
}

export class ListTransactionsQueryDto {
  type?: 'income' | 'expense';
  fromDate?: string;
  toDate?: string;
  accountId?: string;
  categoryId?: string;
}