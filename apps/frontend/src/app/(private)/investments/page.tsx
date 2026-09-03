import type { Metadata } from 'next';
import { InvestmentsClient } from './investments-client';

export const metadata: Metadata = {
  title: 'Investimentos',
  description:
    'Carteira manual de investimentos: custo de aquisição informado por você. Esta versão não busca cotações de mercado.',
};

export default function InvestmentsPage() {
  return <InvestmentsClient />;
}
