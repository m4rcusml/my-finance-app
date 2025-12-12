import { request } from "./http";

export type DashboardResponse = {
  period: {
    referenceDate?: string;
    startOfMonth: string;
    endOfMonth: string;
  };
  totals: {
    totalBalance: number;
    currentMonth: {
      income: number;
      expense: number;
      net: number;
    };
  };
  accounts: Array<{
    id: string;
    name: string;
    institution: string;
    initialBalance: number;
    balance: number;
  }>;
  // add fixed-transactions block etc.
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
