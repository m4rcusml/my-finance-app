import { request } from './http';
import type { Transaction } from './transactions';
import type { CreditCard } from './credit-cards';

export type DashboardOverview = {
  period: {
    referenceDate: string;
    startOfMonth: string;
    endOfMonth: string;
  };
  totals: {
    totalBalance: number;
    totalCreditLimit: number;
    totalCreditUsed: number;
    totalCreditAvailable: number;
    trending: number;
    currentMonth: {
      income: { value: number; trending: number };
      expense: { value: number; trending: number };
      net: { value: number; trending: number };
    };
  };
  accounts: Array<{
    id: string;
    name: string;
    institution: string;
    type: string;
    balance: number;
    initialBalance: number;
    createdAt: string;
    updatedAt: string;
  }>;
  creditCards: CreditCard[];
  latestTransactions: Transaction[];
  fixedTransactions: Array<{
    id: string;
    description: string;
    value: number;
    type: string;
    category?: { id: string; name: string } | null;
    referenceDay?: number;
    due?: string;
  }>;
  annualBalance: Array<{ month: string; net: number }>;
};

export type DashboardResponse = DashboardOverview;

export const dashboardApi = {
  overview(referenceDate?: string) {
    const query = referenceDate ? `?referenceDate=${referenceDate}` : '';
    return request<DashboardOverview>(`/dashboard${query}`, {
      auth: true,
    });
  },
};
