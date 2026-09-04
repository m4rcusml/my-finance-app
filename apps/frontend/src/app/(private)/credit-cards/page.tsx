import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Cartões de crédito',
  description: 'Acompanhe limites e gastos do ciclo aberto dos seus cartões.',
};

export default function CreditCardsPage() {
  redirect('/accounts?view=cards');
}
