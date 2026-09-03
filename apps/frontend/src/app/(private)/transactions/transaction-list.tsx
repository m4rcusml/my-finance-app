'use client';

import type { PaginationMeta, TransactionWithRelations } from '@finance/contracts';
import { categoryLabel, transactionOrigin } from '@/features/transactions/helpers';
import {
  formatCivilDate,
  formatMoney,
  TRANSACTION_SOURCE_LABELS,
  TRANSACTION_TYPE_LABELS,
} from '@/shared/lib/format';
import { IconButton } from '@/shared/ui/form';

/**
 * The list itself, in two shapes: a real table from `sm` up, stacked cards
 * below it. The same rows either way — at 320px a 7-column table is unreadable,
 * and a horizontally scrolling one hides the amount, which is the whole point
 * of the screen.
 */

export interface TransactionListProps {
  items: TransactionWithRelations[];
  meta: PaginationMeta;
  onEdit: (transaction: TransactionWithRelations) => void;
  onDelete: (transaction: TransactionWithRelations) => void;
}

function describe(transaction: TransactionWithRelations): string {
  return transaction.description?.trim() || 'Sem descrição';
}

/**
 * Colour alone never carries the sign: a visually-hidden "Receita"/"Despesa"
 * prefix says it in words, and the Tipo column repeats it as text.
 */
function Amount({ transaction }: { transaction: TransactionWithRelations }) {
  const isIncome = transaction.type === 'income';
  return (
    <span className={`font-semibold tabular-nums ${isIncome ? 'text-success-text' : 'text-danger-text'}`}>
      <span className="sr-only">{isIncome ? 'Receita' : 'Despesa'}: </span>
      <span aria-hidden="true">{isIncome ? '+' : '−'}&nbsp;</span>
      {formatMoney(transaction.value)}
    </span>
  );
}

function RowActions({
  transaction,
  onEdit,
  onDelete,
}: {
  transaction: TransactionWithRelations;
  onEdit: (transaction: TransactionWithRelations) => void;
  onDelete: (transaction: TransactionWithRelations) => void;
}) {
  const name = describe(transaction);
  return (
    <div className="flex justify-end gap-1">
      <IconButton
        label={`Editar transação ${name}`}
        variant="secondary"
        onClick={() => onEdit(transaction)}
      >
        ✎
      </IconButton>
      <IconButton
        label={`Excluir transação ${name}`}
        variant="secondary"
        onClick={() => onDelete(transaction)}
      >
        🗑
      </IconButton>
    </div>
  );
}

const TH = 'px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground';
const TD = 'px-3 py-3 align-middle text-sm';

export function TransactionList({ items, meta, onEdit, onDelete }: TransactionListProps) {
  return (
    <>
      {/* Table — sm and up */}
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-layer01 sm:block">
        <table className="w-full min-w-[52rem] border-collapse text-left">
          <caption className="sr-only">
            Transações filtradas. Página {meta.page} de {Math.max(1, meta.totalPages)}, {meta.totalItems} no
            total.
          </caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className={TH}>
                Data
              </th>
              <th scope="col" className={TH}>
                Descrição
              </th>
              <th scope="col" className={TH}>
                Categoria
              </th>
              <th scope="col" className={TH}>
                Conta ou cartão
              </th>
              <th scope="col" className={TH}>
                Tipo
              </th>
              <th scope="col" className={`${TH} text-right`}>
                Valor
              </th>
              <th scope="col" className={`${TH} text-right`}>
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((transaction) => {
              const origin = transactionOrigin(transaction);
              return (
                <tr key={transaction.id} className="border-b border-border last:border-0 hover:bg-layer02/60">
                  <td className={`${TD} whitespace-nowrap text-muted-foreground`}>
                    {formatCivilDate(transaction.date)}
                  </td>
                  <th scope="row" className={`${TD} max-w-[18rem] truncate font-medium text-foreground`}>
                    {describe(transaction)}
                  </th>
                  <td className={`${TD} text-muted-foreground`}>{categoryLabel(transaction)}</td>
                  <td className={`${TD} text-muted-foreground`}>
                    {origin.name}
                    {origin.kind ? (
                      <span className="ml-1 text-xs text-placeholder">({origin.kind})</span>
                    ) : null}
                  </td>
                  <td className={`${TD} whitespace-nowrap text-muted-foreground`}>
                    {TRANSACTION_TYPE_LABELS[transaction.type]}
                    <span className="ml-1 text-xs text-placeholder">
                      ({TRANSACTION_SOURCE_LABELS[transaction.source]})
                    </span>
                  </td>
                  <td className={`${TD} whitespace-nowrap text-right`}>
                    <Amount transaction={transaction} />
                  </td>
                  <td className={`${TD} text-right`}>
                    <RowActions transaction={transaction} onEdit={onEdit} onDelete={onDelete} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Stacked cards — below sm */}
      <ul className="flex flex-col gap-3 sm:hidden">
        {items.map((transaction) => {
          const origin = transactionOrigin(transaction);
          return (
            <li key={transaction.id} className="rounded-lg border border-border bg-layer01 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{describe(transaction)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatCivilDate(transaction.date)} · {TRANSACTION_TYPE_LABELS[transaction.type]} ·{' '}
                    {TRANSACTION_SOURCE_LABELS[transaction.source]}
                  </p>
                </div>
                <Amount transaction={transaction} />
              </div>

              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Categoria</dt>
                  <dd className="truncate text-foreground">{categoryLabel(transaction)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">{origin.kind ?? 'Origem'}</dt>
                  <dd className="truncate text-foreground">{origin.name}</dd>
                </div>
              </dl>

              <div className="mt-2">
                <RowActions transaction={transaction} onEdit={onEdit} onDelete={onDelete} />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
