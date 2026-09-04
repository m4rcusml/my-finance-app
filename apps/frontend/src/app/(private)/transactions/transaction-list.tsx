'use client';

import type { PaginationMeta, TransactionWithRelations } from '@finance/contracts';
import { categoryLabel, transactionOrigin } from '@/features/transactions/helpers';
import { formatCivilDate, formatMoney, TRANSACTION_SOURCE_LABELS, TRANSACTION_TYPE_LABELS } from '@/shared/lib/format';
import { ActionButton } from '@/shared/ui/form';

export interface TransactionListProps {
  items: TransactionWithRelations[];
  meta: PaginationMeta;
  onEdit: (transaction: TransactionWithRelations) => void;
  onDelete: (transaction: TransactionWithRelations) => void;
}

export function TransactionList({ items, meta, onEdit, onDelete }: TransactionListProps) {
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[18px] font-semibold">Todas as transações</h2>
        <p className="text-xs text-muted-foreground">
          Exibindo {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.totalItems)} de{' '}
          {meta.totalItems}
        </p>
      </div>
      <div
        aria-hidden="true"
        className="mb-1 hidden grid-cols-[minmax(0,1fr)_180px_180px_28px] gap-4 border-b border-border pb-3 text-xs text-muted-foreground lg:grid"
      >
        <span>Movimentação</span>
        <span className="text-center">Categoria</span>
        <span className="text-right">Valor</span>
        <span />
      </div>
      <ul aria-label="Transações" className="space-y-2">
        {items.map((transaction) => {
          const name = transaction.description?.trim() || 'Sem descrição';
          const income = transaction.type === 'income';
          return (
            <li
              key={transaction.id}
              className="relative flex min-w-0 items-center gap-2 rounded-xl border border-border bg-layer00 p-3 sm:p-4"
            >
              <button
                type="button"
                onClick={() => onEdit(transaction)}
                aria-label={`Editar transação ${name}`}
                className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-left lg:grid-cols-[minmax(0,1fr)_180px_180px] lg:gap-4"
              >
                <span className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-layer03 text-sm font-medium text-muted-primary"
                  >
                    {name.charAt(0).toLocaleUpperCase('pt-BR')}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium">{name}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {formatCivilDate(transaction.date)} · {transactionOrigin(transaction).name}
                    </span>
                  </span>
                </span>
                <span className="hidden justify-self-center rounded-full bg-layer02 px-3 py-2 text-xs text-muted-foreground lg:block">
                  {categoryLabel(transaction)}
                </span>
                <span className="min-w-0 text-right">
                  <span
                    className={`block whitespace-nowrap text-[13px] font-semibold tabular-nums sm:text-[14px] ${income ? 'text-success-text' : 'text-danger-text'}`}
                  >
                    <span className="sr-only">{TRANSACTION_TYPE_LABELS[transaction.type]}: </span>
                    {income ? '+' : '−'} {formatMoney(transaction.value)}
                  </span>
                  <span className="mt-1 hidden text-xs text-muted-foreground sm:block">
                    {TRANSACTION_TYPE_LABELS[transaction.type]}
                  </span>
                </span>
              </button>
              <details className="group shrink-0">
                <summary
                  aria-label={`Ações de ${name}`}
                  className="flex size-7 cursor-pointer list-none items-center justify-center rounded-lg text-lg text-muted-foreground hover:bg-layer02"
                >
                  ⋮
                </summary>
                <div className="absolute right-3 top-14 z-10 flex min-w-48 flex-col gap-2 rounded-xl border border-border bg-layer02 p-3 shadow-xl">
                  <span className="text-xs text-muted-foreground">
                    {TRANSACTION_SOURCE_LABELS[transaction.source]} · {categoryLabel(transaction)}
                  </span>
                  <ActionButton variant="secondary" onClick={() => onEdit(transaction)}>
                    Editar
                  </ActionButton>
                  <ActionButton variant="danger" onClick={() => onDelete(transaction)}>
                    Excluir <span className="sr-only">transação {name}</span>
                  </ActionButton>
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
