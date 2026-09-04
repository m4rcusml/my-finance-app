import type { Metadata } from 'next';
import { AssetsClient, type AssetsView } from './assets-client';

export const metadata: Metadata = {
  title: 'Contas e cartões',
  description: 'Acompanhe saldos, limites e ciclos de cartão em uma única área.',
};

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const view: AssetsView = (await searchParams).view === 'cards' ? 'cards' : 'accounts';
  return <AssetsClient view={view} />;
}
