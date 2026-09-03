import type { Metadata } from 'next';
import { TransactionsClient } from './transactions-client';

export const metadata: Metadata = {
  title: 'Transações',
  description: 'Gerencie receitas e despesas com filtros, resumo do período e projeção mensal.',
};

export default function TransactionsPage() {
  return <TransactionsClient />;
}
