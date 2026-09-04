import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Transações sem categoria',
  description: 'Categorize lançamentos pendentes em sequência.',
};

export default function UncategorizedTransactionsPage() {
  redirect('/transactions?view=uncategorized');
}
