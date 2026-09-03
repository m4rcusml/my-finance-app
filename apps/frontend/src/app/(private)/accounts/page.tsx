import type { Metadata } from 'next';
import { AccountsClient } from './accounts-client';

export const metadata: Metadata = {
  title: 'Contas',
  description: 'Cadastre contas bancárias, acompanhe saldos e arquive o que saiu de uso sem perder o histórico.',
};

export default function AccountsPage() {
  return <AccountsClient />;
}
