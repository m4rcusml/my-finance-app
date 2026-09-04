'use client';
import type { TransactionWithRelations } from '@finance/contracts';
import Link from 'next/link';
import { formatCivilDate, formatMoney, TRANSACTION_TYPE_LABELS } from '@/shared/lib/format';
import { EmptyState } from '@/shared/ui/query-state';
import { DashboardSection } from './dashboard-section';

export function LatestTransactions({ transactions }: { transactions: TransactionWithRelations[] }) {
  return (
    <DashboardSection
      title="Últimos lançamentos"
      action={
        <Link href="/transactions" className="text-xs font-semibold text-muted-primary hover:underline">
          Ver todos
        </Link>
      }
    >
      {transactions.length === 0 ? (
        <EmptyState title="Nenhum lançamento no período" message="Suas movimentações recentes aparecem aqui." />
      ) : (
        <ul className="space-y-2">
          {transactions.map((transaction) => (
            <li
              key={transaction.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-layer02/50 p-3"
            >
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-layer03 text-sm font-semibold"
              >
                {(transaction.description?.trim() || 'L').slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{transaction.description?.trim() || 'Sem descrição'}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatCivilDate(transaction.date)} ·{' '}
                  {transaction.account?.name ?? transaction.creditCard?.name ?? 'Origem arquivada'}
                </p>
              </div>
              <span className="hidden rounded-full border border-border bg-layer02 px-3 py-1 text-xs text-muted-foreground sm:inline">
                {transaction.category?.name ?? 'Sem categoria'}
              </span>
              <div className="ml-auto text-right">
                <p
                  className={`whitespace-nowrap text-sm font-semibold tabular-nums ${transaction.type === 'income' ? 'text-success-text' : 'text-danger-text'}`}
                >
                  {transaction.type === 'income' ? '+' : '−'} {formatMoney(transaction.value)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{TRANSACTION_TYPE_LABELS[transaction.type]}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}
