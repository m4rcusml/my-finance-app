import { request } from "./http";

export type Transaction = {
  id: string;
  description: string; // Was title
  categoryId?: string;
  category?: { name: string; icon: string }; // Optional if populated later
  value: number | string; // JSON shows string "5000" for transactions
  type: 'income' | 'expense';
  date?: string;
  status?: string;
  referenceDay?: number; // For fixed transactions
  due?: string; // Legacy or alternative
};

export type DashboardResponse = {
  period: {
    referenceDate?: string;
    startOfMonth: string;
    endOfMonth: string;
  };
  totals: {
    totalBalance: number;
    trending: number;
    currentMonth: {
      income: {
        value: number;
        trending: number;
      };
      expense: {
        value: number;
        trending: number;
      };
      net: {
        value: number;
        trending: number;
      };
    };
  };
  accounts: Array<{
    id: string;
    name: string;
    institution: string;
    initialBalance: number;
    balance: number;
  }>;
  latestTransactions: Transaction[];
  fixedTransactions: Transaction[];
  annualBalance: any[]; // User requested to skip annual balance for now
};

export const dashboardApi = {
  getOverview(referenceDate?: string) {
    return request<DashboardResponse>("/dashboard", {
      method: "GET",
      auth: true,
      query: referenceDate ? { referenceDate } : undefined,
    });
  },
};
