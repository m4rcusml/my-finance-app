'use client';
import type { Account, DashboardOverview } from '@finance/contracts';
import Link from 'next/link';
import { ACCOUNT_TYPE_LABELS, formatMoney } from '@/shared/lib/format';
import { DashboardSection } from './dashboard-section';

export function ResourceOverview({ accounts, totals }: { accounts: Account[]; totals: DashboardOverview['totals'] }) {
  return (
    <DashboardSection
      title="Contas e patrimônio"
      action={
        <Link className="text-xs font-semibold text-muted-primary hover:underline" href="/accounts">
          Gerenciar
        </Link>
      }
    >
      <ul className="max-h-52 space-y-3 overflow-y-auto pr-1">
        {accounts
          .filter((a) => a.type !== 'investment')
          .map((account) => (
            <li key={account.id} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-layer03 text-sm font-semibold"
              >
                {account.institution.slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{account.name}</span>
                <span className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABELS[account.type]}</span>
              </span>
              <span className="text-sm font-semibold tabular-nums">{formatMoney(account.balance)}</span>
            </li>
          ))}
        {accounts.filter((account) => account.type !== 'investment').length === 0 ? (
          <li className="text-sm text-muted-foreground">
            Nenhuma conta disponível para o caixa.{' '}
            <Link href="/accounts" className="text-muted-primary underline">
              Adicionar conta
            </Link>
          </li>
        ) : null}
      </ul>
      <dl className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Contas de investimento</dt>
          <dd className="font-semibold tabular-nums">{formatMoney(totals.investedAccountBalance)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>
            <Link className="text-muted-foreground hover:underline" href="/investments">
              Carteira manual · custo
            </Link>
          </dt>
          <dd className="font-semibold tabular-nums">{formatMoney(totals.portfolioInvested)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>
            <Link className="text-muted-foreground hover:underline" href="/accounts?view=cards">
              Cartões · ciclo vigente
            </Link>
          </dt>
          <dd className="font-semibold tabular-nums">{formatMoney(totals.totalCreditUsedThisCycle)}</dd>
        </div>
        <div className="flex justify-between gap-2 text-xs text-muted-foreground">
          <dt>Crédito disponível</dt>
          <dd>
            {formatMoney(totals.totalCreditAvailable)} de {formatMoney(totals.totalCreditLimit)}
          </dd>
        </div>
      </dl>
    </DashboardSection>
  );
}
