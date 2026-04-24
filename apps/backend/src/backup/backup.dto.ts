import { IsNotEmpty, IsObject } from 'class-validator';

export class RestoreBackupDto {
  @IsObject()
  @IsNotEmpty()
  data!: Record<string, unknown>;
}

export interface BackupAccount {
  id: string;
  name: string;
  institution: string;
  type: string;
  initialBalance: number;
  isActive: boolean;
}

export interface BackupCategory {
  id: string;
  name: string;
  type: string;
}

export interface BackupCreditCard {
  id: string;
  name: string;
  institution: string;
  limitTotal: number;
  closingDay?: number;
  isActive: boolean;
}

export interface BackupMarketAsset {
  id: string;
  symbol: string;
  type: string;
  exchange: string;
  name?: string;
}

export interface BackupTransaction {
  id: string;
  type: string;
  value: number;
  date: string;
  accountId?: string;
  creditCardId?: string;
  categoryId?: string;
  description?: string;
  source: string;
  externalId?: string;
}

export interface BackupFixedTransaction {
  id: string;
  type: string;
  value: number;
  referenceDay: number;
  marginDays: number;
  accountId?: string;
  creditCardId?: string;
  categoryId: string;
  description?: string;
  isActive: boolean;
}

export interface BackupInvestment {
  id: string;
  marketAssetId?: string;
  broker: string;
  type: string;
  quantity: number;
  buyPrice: number;
  investedAmount: number;
  buyDate: string;
}

export interface BackupGoal {
  id: string;
  name: string;
  type: string;
  targetAmount: number;
  currentAmount?: number;
  deadline?: string;
  relatedCategoryId?: string;
  relatedAccountId?: string;
}

export interface BackupImportedFile {
  id: string;
  origin: string;
  fileName: string;
  fileType: string;
  status: string;
  importedAt: string;
  totalRecords: number;
}

export interface BackupData {
  version: string;
  exportedAt: string;
  user: { id: string; email: string; name?: string | null };
  accounts: BackupAccount[];
  categories: BackupCategory[];
  creditCards: BackupCreditCard[];
  marketAssets: BackupMarketAsset[];
  transactions: BackupTransaction[];
  fixedTransactions: BackupFixedTransaction[];
  investments: BackupInvestment[];
  goals: BackupGoal[];
  importedFiles: BackupImportedFile[];
}
