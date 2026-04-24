export interface ParsedTransaction {
  externalId?: string;
  date: string;
  description: string;
  value: number;
  type: 'income' | 'expense';
}

export interface BankStrategy {
  normalize(raw: Record<string, unknown>): ParsedTransaction | null;
  supports(origin: string): boolean;
}
