'use client';

import type { TransactionWithRelations } from '@finance/contracts';
import Link from 'next/link';
import { formatCivilDate, formatMoney, TRANSACTION_TYPE_LABELS } from '@/shared/lib/format';
import { EmptyState } from '@/shared/ui/query-state';
import { DashboardSection } from './dashboard-section';

/**
 * The last few transactions the API already returned with their relations
 * attached — no N+1 lookup, and no guessing.
 *
 * The type of each row comes from `transaction.type`; the old panel hardcoded
 * "despesa" on every line, so every salary showed up as an expense. The
 * category shows its NAME, not its id.
 */
export function LatestTransactions({ transactions }: { transactions: TransactionWithRelations[] }) {
  return (
    <DashboardSection
      title="Últimos lançamentos"
      description="Os lançamentos mais recentes do período selecionado."
      action={
        <Link
          href="/transactions"
          className="rounded-lg border border-border-strong bg-layer02 px-3 py-2 text-sm font-medium text-foreground transition hover:bg-layer03"
        >
          Ver todos
        </Link>
      }
    >
      {transactions.length === 0 ? (
        <EmptyState
          title="Nenhum lançamento no período"
          message="Assim que houver movimentação nesse intervalo, os últimos lançamentos aparecem aqui."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
            <caption className="sr-only">
              Últimos lançamentos do período, com data, descrição, categoria, origem, tipo e valor
            </caption>
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Data
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Descrição
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Categoria
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Origem
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Tipo
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => {
                const isIncome = transaction.type === 'income';
                const origin =
                  transaction.account?.name ?? transaction.creditCard?.name ?? 'Sem origem';

                return (
                  <tr key={transaction.id} className="border-b border-border/60 last:border-b-0">
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                      {formatCivilDate(transaction.date)}
                    </td>
                    <th scope="row" className="max-w-[16rem] truncate py-2 pr-3 font-medium text-foreground">
                      {transaction.description?.trim() || 'Sem descrição'}
                    </th>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {transaction.category?.name ?? 'Sem categoria'}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{origin}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${
                          isIncome
                            ? 'border-success text-success-text'
                            : 'border-danger text-danger-text'
                        }`}
                      >
                        {TRANSACTION_TYPE_LABELS[transaction.type]}
                      </span>
                    </td>
                    <td
                      className={`py-2 text-right font-semibold tabular-nums whitespace-nowrap ${
                        isIncome ? 'text-success-text' : 'text-danger-text'
                      }`}
                    >
                      {formatMoney(transaction.value)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardSection>
  );
}
