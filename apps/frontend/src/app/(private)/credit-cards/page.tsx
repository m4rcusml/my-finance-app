import type { Metadata } from 'next';
import { CreditCardsClient } from './credit-cards-client';

export const metadata: Metadata = {
  title: 'Cartões de crédito',
  description: 'Acompanhe limites e gastos do ciclo aberto dos seus cartões.',
};

export default function CreditCardsPage() {
  return <CreditCardsClient />;
}
