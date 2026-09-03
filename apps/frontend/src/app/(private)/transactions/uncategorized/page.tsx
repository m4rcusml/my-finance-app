import type { Metadata } from 'next';
import { UncategorizedClient } from './uncategorized-client';

export const metadata: Metadata = {
  title: 'Transações sem categoria',
  description: 'Categorize lançamentos pendentes em sequência.',
};

export default function UncategorizedTransactionsPage() {
  return <UncategorizedClient />;
}
