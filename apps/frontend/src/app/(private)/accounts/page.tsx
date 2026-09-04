import type { Metadata } from 'next';
import { AssetsClient, type AssetsView } from './assets-client';

export const metadata: Metadata = {
  title: 'Contas e cartões',
  description: 'Acompanhe saldos, limites e ciclos de cartão em uma única área.',
};

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const requestedView = (await searchParams).view;
  const view: AssetsView = requestedView === 'cards' || requestedView === 'accounts' ? requestedView : 'overview';
  return <AssetsClient view={view} />;
}
