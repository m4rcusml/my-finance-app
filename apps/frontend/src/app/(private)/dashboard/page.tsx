import type { Metadata } from 'next';
import { DashboardClient } from './dashboard-client';

export const metadata: Metadata = {
  title: 'Painel',
  description: 'Visão consolidada de caixa, investimentos, cartões e lançamentos recorrentes.',
};

export default function DashboardPage() {
  return <DashboardClient />;
}
