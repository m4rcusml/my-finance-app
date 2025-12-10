export class CreateFixedTransactionDto {
  type: 'income' | 'expense';
  value: number;
  referenceDay: number;
  marginDays: number;
  accountId: string;
  categoryId: string;
  description?: string;
}

export class UpdateFixedTransactionDto {
  type?: 'income' | 'expense';
  value?: number;
  referenceDay?: number;
  marginDays?: number;
  accountId?: string;
  categoryId?: string;
  description?: string;
  isActive?: boolean;
}

export class ConfirmOccurrenceDto {
  realDate?: string; // ISO date string
}
