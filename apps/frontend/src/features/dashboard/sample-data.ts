import type { DashboardResponse } from '@/shared/lib/api/dashboard';

export const sampleMonthlyNet = [
  1200, 800, 1500, 950, 1750, -400, 1100, 1400, 900, -300, 1250, -500,
];

export const sampleFixedTransactions = [
  {
    id: 'ft-1',
    title: 'Internet Fibra - Banco Inter',
    category: 'Casa',
    amount: 119.9,
    due: 'Previsto para dia 09 (margem de 5 dias)',
    status: 'pending',
  },
  {
    id: 'ft-2',
    title: 'Academia - Banco Nubank',
    category: 'Saude',
    amount: 89.9,
    due: 'Previsto para dia 12 (margem de 5 dias)',
    status: 'pending',
  },
];

export const sampleRecentTransactions = [
  {
    id: 'rt-1',
    title: 'Banco Inter - Spotify Premium',
    category: 'Assinaturas',
    amount: 27.9,
    type: 'expense',
  },
  {
    id: 'rt-2',
    title: 'Banco Nubank - Salario',
    category: 'Receita',
    amount: 4200,
    type: 'income',
  },
  {
    id: 'rt-3',
    title: 'Banco Inter - Restaurante',
    category: 'Alimentacao',
    amount: 72.5,
    type: 'expense',
  },
];

export const emptyDashboardFallback: DashboardResponse = {
  period: {
    startOfMonth: new Date().toISOString(),
    endOfMonth: new Date().toISOString(),
  },
  totals: {
    totalBalance: 0,
    currentMonth: {
      income: 0,
      expense: 0,
      net: 0,
    },
  },
  accounts: [],
};
