'use client';

import type { Account, CreditCard } from '@finance/contracts';
import Link from 'next/link';
import { ACCOUNT_TYPE_LABELS, formatCivilDate, formatMoney } from '@/shared/lib/format';
import { EmptyState } from '@/shared/ui/query-state';
import { DashboardSection } from './dashboard-section';

export function ResourceOverview({ accounts, creditCards }: { accounts: Account[]; creditCards: CreditCard[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <DashboardSection
        title="Contas ativas"
        description="Saldos calculados pelo saldo inicial e pelos lançamentos vinculados."
        action={<DashboardLink href="/accounts">Gerenciar</DashboardLink>}
      >
        {accounts.length === 0 ? (
          <EmptyState title="Nenhuma conta ativa" message="Cadastre uma conta para registrar lançamentos." />
        ) : (
          <ul className="divide-y divide-border">
            {accounts.map((account) => (
              <li key={account.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{account.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {account.institution} · {ACCOUNT_TYPE_LABELS[account.type] ?? account.type}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold tabular-nums ${account.balance < 0 ? 'text-danger-text' : 'text-foreground'}`}
                >
                  {formatMoney(account.balance)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DashboardSection>

      <DashboardSection
        title="Cartões ativos"
        description="Uso calculado individualmente para o ciclo aberto de cada cartão."
        action={<DashboardLink href="/credit-cards">Gerenciar</DashboardLink>}
      >
        {creditCards.length === 0 ? (
          <EmptyState title="Nenhum cartão ativo" message="Cadastre um cartão para acompanhar o ciclo atual." />
        ) : (
          <ul className="divide-y divide-border">
            {creditCards.map((card) => (
              <li key={card.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{card.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{card.institution}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {formatMoney(card.cycleUsedAmount)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-layer02" aria-hidden="true">
                  <div
                    className={`h-full rounded-full ${card.cycleUsedAmount > card.limitTotal ? 'bg-danger' : 'bg-primary'}`}
                    style={{ width: `${cardUsagePercent(card)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatMoney(card.availableAmount)} disponível · ciclo até {formatCivilDate(card.currentCycle.end)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </DashboardSection>
    </div>
  );
}

function DashboardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-border-strong bg-layer02 px-3 py-2 text-sm font-medium text-foreground transition hover:bg-layer03"
    >
      {children}
    </Link>
  );
}

function cardUsagePercent(card: CreditCard): number {
  if (card.limitTotal <= 0) return card.cycleUsedAmount > 0 ? 100 : 0;
  return Math.max(0, Math.min((card.cycleUsedAmount / card.limitTotal) * 100, 100));
}
