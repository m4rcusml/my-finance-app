'use client';

import type { Account, CreditCard } from '@finance/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { useAccountsQuery } from '@/features/accounts/queries';
import { useCreditCardsQuery } from '@/features/credit-cards/queries';
import { useDashboardQuery } from '@/features/dashboard/queries';
import { ACCOUNT_TYPE_LABELS, formatCivilDate, formatMoney } from '@/shared/lib/format';
import { ActionButton } from '@/shared/ui/form';
import { PaginatedBoundary, QueryBoundary } from '@/shared/ui/query-state';

const PANEL = 'min-w-0 rounded-2xl border border-border bg-layer01 p-4 sm:p-6';
const LINK = 'shrink-0 rounded-lg py-2 text-[13px] font-semibold text-muted-primary hover:text-foreground';

export function AssetsSummary() {
  const query = useDashboardQuery();
  return (
    <QueryBoundary query={query} loadingLabel="Carregando resumo de contas e cartões…">
      {({ totals }) => (
        <dl className="grid gap-4 sm:grid-cols-3">
          <AssetMetric label="Saldo em contas" value={totals.netBalance}>
            Saldo em caixa · investimentos à parte
          </AssetMetric>
          <AssetMetric label="Limite disponível" value={totals.totalCreditAvailable} tone="positive">
            Disponível nos cartões ativos
          </AssetMetric>
          <AssetMetric label="Fatura do ciclo" value={totals.totalCreditUsedThisCycle} tone="negative">
            Despesas dos ciclos abertos
          </AssetMetric>
        </dl>
      )}
    </QueryBoundary>
  );
}

function AssetMetric({
  label,
  value,
  tone,
  children,
}: {
  label: string;
  value: number;
  tone?: 'positive' | 'negative';
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-layer02 p-5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-2 break-words text-[24px] font-semibold tabular-nums">{formatMoney(value)}</dd>
      <dd
        className={`mt-2 text-xs ${tone === 'positive' ? 'text-success-text' : tone === 'negative' ? 'text-danger-text' : 'text-muted-foreground'}`}
      >
        {children}
      </dd>
    </div>
  );
}

export function AssetsOverview({
  onAddAccount,
  onAddCard,
  onEditAccount,
  onEditCard,
}: {
  onAddAccount: () => void;
  onAddCard: () => void;
  onEditAccount: (account: Account) => void;
  onEditCard: (card: CreditCard) => void;
}) {
  const accountsQuery = useAccountsQuery({ page: 1, limit: 3, includeArchived: true });
  const cardsQuery = useCreditCardsQuery({ page: 1, limit: 2, includeArchived: true });
  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <section className={PANEL} aria-labelledby="overview-accounts-title">
        <header className="mb-6 flex items-start justify-between gap-3 border-b border-border pb-5">
          <div className="min-w-0">
            <h2 id="overview-accounts-title" className="text-[22px] font-semibold">
              Contas
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {accountsQuery.data
                ? `${accountsQuery.data.meta.totalItems} cadastradas · saldos e histórico`
                : 'Saldos e histórico'}
            </p>
          </div>
          <Link className={LINK} href="/accounts?view=accounts">
            Ver todas
          </Link>
        </header>
        <PaginatedBoundary
          query={accountsQuery}
          loadingLabel="Carregando contas…"
          emptyTitle="Adicione sua primeira conta"
          emptyMessage="Reúna as contas bancárias e reservas que você quer acompanhar."
          emptyAction={<ActionButton onClick={onAddAccount}>Nova conta</ActionButton>}
        >
          {(accounts) => (
            <ul className="space-y-4">
              {accounts.map((account) => (
                <li key={account.id}>
                  <button
                    type="button"
                    aria-label={`Editar a conta ${account.name}`}
                    onClick={() => onEditAccount(account)}
                    className={`flex w-full gap-4 rounded-xl border border-border p-4 text-left transition hover:border-muted-primary sm:p-5 ${account.isActive ? 'bg-layer02/50' : 'bg-layer00/20'}`}
                  >
                    <AccountAvatar account={account} />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-[17px] font-semibold">{account.name}</p>
                      <p className="mt-1 break-words text-xs text-muted-foreground">
                        {account.isActive
                          ? `${ACCOUNT_TYPE_LABELS[account.type]} · ${account.institution}`
                          : 'Somente histórico · novos lançamentos bloqueados'}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p
                          className={`break-words text-[20px] font-semibold tabular-nums ${account.balance < 0 ? 'text-danger-text' : ''}`}
                        >
                          {formatMoney(account.balance)}
                        </p>
                        <span
                          className={`rounded-full border border-border px-3 py-1 text-xs ${account.isActive ? 'bg-primary/10 text-muted-primary' : 'bg-layer02 text-muted-foreground'}`}
                        >
                          {account.isActive
                            ? account.type === 'savings'
                              ? 'Reserva'
                              : account.type === 'investment'
                                ? 'Investimento'
                                : 'Disponível'
                            : 'Arquivada'}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PaginatedBoundary>
        <p className="mt-6 text-[13px] leading-relaxed text-muted-foreground">
          Itens arquivados permanecem no histórico financeiro.
        </p>
      </section>
      <section className={PANEL} aria-labelledby="overview-cards-title">
        <header className="mb-6 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="overview-cards-title" className="text-[22px] font-semibold">
              Cartões
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">Ciclos e limites</p>
          </div>
          <Link className={LINK} href="/accounts?view=cards">
            Gerenciar cartões
          </Link>
        </header>
        <PaginatedBoundary
          query={cardsQuery}
          loadingLabel="Carregando cartões…"
          emptyTitle="Adicione seu primeiro cartão"
          emptyMessage="Acompanhe as despesas do ciclo e quanto ainda está disponível."
          emptyAction={<ActionButton onClick={onAddCard}>Novo cartão</ActionButton>}
        >
          {(cards) => (
            <ul className="space-y-4">
              {cards.map((card) => (
                <li key={card.id}>
                  <button
                    type="button"
                    className="w-full rounded-2xl text-left"
                    onClick={() => onEditCard(card)}
                    aria-label={`Editar o cartão ${card.name}`}
                  >
                    <CreditCardPreview card={card} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PaginatedBoundary>
        <p className="mt-6 text-[13px] leading-relaxed text-muted-foreground">
          A fatura considera apenas despesas do ciclo aberto. As datas se ajustam aos meses mais curtos.
        </p>
        <Link
          href="/accounts?view=cards"
          className="mt-6 flex min-h-12 items-center justify-center rounded-xl border border-border bg-layer02/50 px-4 py-3 text-center text-[14px] font-semibold text-muted-primary transition hover:bg-layer02"
        >
          Abrir gestão de cartões
        </Link>
      </section>
    </div>
  );
}

export function AccountAvatar({ account }: { account: Account }) {
  const variant = !account.isActive ? 'archived' : account.type === 'savings' ? 'savings' : 'checking';
  return (
    <span
      className="relative flex size-11 shrink-0 items-center justify-center text-[16px] font-bold text-layer00"
      aria-hidden="true"
    >
      <Image
        src={`/assets/figma/patrimonio/account-${variant}.svg`}
        alt=""
        width={44}
        height={44}
        className="absolute inset-0 size-11"
      />
      <span className="relative">{account.name.trim().slice(0, 1).toLocaleUpperCase('pt-BR')}</span>
    </span>
  );
}

export function CreditCardPreview({ card }: { card: CreditCard }) {
  const used =
    card.limitTotal > 0
      ? Math.min(100, Math.max(0, (card.cycleUsedAmount / card.limitTotal) * 100))
      : card.cycleUsedAmount > 0
        ? 100
        : 0;
  return (
    <div className={`rounded-2xl border border-border p-4 sm:p-6 ${card.isActive ? 'bg-primary/15' : 'bg-layer00/20'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-[18px] font-semibold">{card.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{card.institution}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1.5 text-xs ${card.isActive ? 'bg-success/20 text-success-text' : 'bg-layer02 text-muted-foreground'}`}
        >
          {card.isActive ? 'Ciclo aberto' : 'Arquivado'}
        </span>
      </div>
      {card.isActive ? (
        <>
          <p className="mt-7 text-xs uppercase tracking-wide text-muted-foreground">Fatura atual</p>
          <p className="mt-2 break-words text-[28px] font-semibold tabular-nums">{formatMoney(card.cycleUsedAmount)}</p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {card.closingDay ? `Fecha dia ${card.closingDay}` : 'Fechamento no fim do mês'} · ciclo até{' '}
            {formatCivilDate(card.currentCycle.end)}
          </p>
          <p className={`mt-3 text-[13px] ${card.availableAmount < 0 ? 'text-danger-text' : 'text-foreground'}`}>
            Limite disponível <span className="font-semibold tabular-nums">{formatMoney(card.availableAmount)}</span>
          </p>
          <div aria-hidden="true" className="mt-4 h-2 overflow-hidden rounded-full bg-layer03">
            <div className="h-full rounded-full bg-muted-primary" style={{ width: `${used}%` }} />
          </div>
        </>
      ) : (
        <p className="mt-4 text-[13px] text-muted-foreground">Somente histórico · disponível para reativação</p>
      )}
    </div>
  );
}
