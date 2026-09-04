'use client';

import { CreditCardsClient } from '@/app/(private)/credit-cards/credit-cards-client';
import { PageHeader } from '@/shared/ui/app-shell';
import { SegmentedTabs } from '@/shared/ui/segmented-tabs';
import { AccountsClient } from './accounts-client';

export type AssetsView = 'accounts' | 'cards';

export function AssetsClient({ view = 'accounts' }: { view?: AssetsView }) {
  return (
    <section>
      <PageHeader
        eyebrow="Patrimônio"
        title="Contas e cartões"
        description="Acompanhe saldos disponíveis, limites e o ciclo atual em um único contexto."
      />
      <SegmentedTabs
        label="Seções de contas e cartões"
        active={view}
        tabs={[
          { value: 'accounts', label: 'Contas', href: '/accounts' },
          { value: 'cards', label: 'Cartões de crédito', href: '/accounts?view=cards' },
        ]}
      />
      <div data-tour="assets-workspace">
        {view === 'accounts' ? <AccountsClient embedded /> : <CreditCardsClient embedded />}
      </div>
    </section>
  );
}
