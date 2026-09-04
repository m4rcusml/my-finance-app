import type { Metadata } from 'next';
import { TransactionsClient, type TransactionsView } from './transactions-client';

export const metadata: Metadata = {
  title: 'Movimentações',
  description: 'Gerencie transações, pendências de categoria e categorias em uma única área.',
};

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const requested = (await searchParams).view;
  const view: TransactionsView = requested === 'uncategorized' || requested === 'categories' ? requested : 'all';
  return <TransactionsClient view={view} />;
}
