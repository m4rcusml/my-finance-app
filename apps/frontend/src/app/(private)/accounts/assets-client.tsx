'use client';

import type { Account, CreditCard } from '@finance/contracts';
import { useRef, useState } from 'react';
import { CreditCardsClient } from '@/app/(private)/credit-cards/credit-cards-client';
import { AccountFormDialog } from '@/features/accounts/account-form-dialog';
import { CreditCardFormDialog } from '@/features/credit-cards/credit-card-form-dialog';
import { PageHeader } from '@/shared/ui/app-shell';
import { Dialog } from '@/shared/ui/dialog';
import { ActionButton } from '@/shared/ui/form';
import { SegmentedTabs } from '@/shared/ui/segmented-tabs';
import { AccountsClient } from './accounts-client';
import { AssetsOverview, AssetsSummary } from './assets-overview';

export type AssetsView = 'overview' | 'accounts' | 'cards';

export function AssetsClient({ view = 'overview' }: { view?: AssetsView }) {
  const [adding, setAdding] = useState<'choose' | 'account' | 'card' | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [card, setCard] = useState<CreditCard | null>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  function rememberTrigger() {
    returnFocusTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  function closeDialog() {
    setAdding(null);
    // The choice dialog has already unmounted when a creation form closes.
    requestAnimationFrame(() => returnFocusTo.current?.isConnected && returnFocusTo.current.focus());
  }

  function add(kind: 'account' | 'card') {
    if (adding !== 'choose') rememberTrigger();
    setAccount(null);
    setCard(null);
    setAdding(kind);
  }

  return (
    <section>
      <PageHeader
        title="Contas e cartões"
        description="Saldos, limites e ciclos reunidos no mesmo patrimônio."
        actions={
          <ActionButton
            onClick={() => {
              rememberTrigger();
              setAdding('choose');
            }}
            className="min-h-11"
          >
            Adicionar conta ou cartão
          </ActionButton>
        }
      />
      <SegmentedTabs
        label="Seções de contas e cartões"
        active={view}
        tabs={[
          { value: 'overview', label: 'Visão geral', href: '/accounts' },
          { value: 'accounts', label: 'Contas', href: '/accounts?view=accounts' },
          { value: 'cards', label: 'Cartões', href: '/accounts?view=cards' },
        ]}
      />
      <div className="space-y-6" data-tour="assets-workspace">
        <AssetsSummary />
        {view === 'overview' ? (
          <AssetsOverview
            onAddAccount={() => add('account')}
            onAddCard={() => add('card')}
            onEditAccount={(item) => {
              rememberTrigger();
              setAccount(item);
              setAdding('account');
            }}
            onEditCard={(item) => {
              rememberTrigger();
              setCard(item);
              setAdding('card');
            }}
          />
        ) : view === 'accounts' ? (
          <AccountsClient embedded />
        ) : (
          <CreditCardsClient embedded />
        )}
      </div>
      <Dialog
        open={adding === 'choose'}
        onClose={closeDialog}
        title="Adicionar conta ou cartão"
        description="Escolha onde você quer acompanhar seu dinheiro."
        size="sm"
      >
        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => add('account')}
            className="rounded-xl border border-border bg-layer02 p-5 text-left transition hover:border-muted-primary"
          >
            <span className="block font-semibold">Nova conta</span>
            <span className="mt-1 block text-[13px] text-muted-foreground">
              Conta bancária, reserva ou dinheiro em mãos.
            </span>
          </button>
          <button
            type="button"
            onClick={() => add('card')}
            className="rounded-xl border border-border bg-layer02 p-5 text-left transition hover:border-muted-primary"
          >
            <span className="block font-semibold">Novo cartão</span>
            <span className="mt-1 block text-[13px] text-muted-foreground">
              Limite disponível e despesas do ciclo atual.
            </span>
          </button>
        </div>
      </Dialog>
      <AccountFormDialog open={adding === 'account'} account={account} onClose={closeDialog} />
      <CreditCardFormDialog open={adding === 'card'} creditCard={card} onClose={closeDialog} />
    </section>
  );
}
