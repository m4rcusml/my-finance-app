'use client';

import type { TransactionSource, TransactionType, TransactionWithRelations } from '@finance/contracts';
import { useState } from 'react';
import { TransactionList } from '@/app/(private)/transactions/transaction-list';
import { useTransactionMutations } from '@/features/transactions/mutations';
import {
  useExpenseProjectionQuery,
  useTransactionsQuery,
  useTransactionSummaryQuery,
  type TransactionFilters,
} from '@/features/transactions/queries';
import { useTransactionReferences } from '@/features/transactions/references';
import { TransactionFormDialog } from '@/features/transactions/transaction-form-dialog';
import { formatCivilDate, formatMoney, todayCivil, TRANSACTION_SOURCE_LABELS } from '@/shared/lib/format';
import { PageHeader } from '@/shared/ui/app-shell';
import { ConfirmDialog } from '@/shared/ui/dialog';
import { ActionButton, Field, Select, TextInput } from '@/shared/ui/form';
import { Pagination } from '@/shared/ui/pagination';
import { PaginatedBoundary, QueryBoundary } from '@/shared/ui/query-state';

function initialFilters(): TransactionFilters {
  const today = todayCivil();
  return { fromDate: `${today.slice(0, 7)}-01`, toDate: today };
}

export function TransactionsClient() {
  const [filters, setFilters] = useState<TransactionFilters>(initialFilters);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionWithRelations | null>(null);
  const [deleting, setDeleting] = useState<TransactionWithRelations | null>(null);

  const references = useTransactionReferences();
  const transactionsQuery = useTransactionsQuery({ ...filters, page, limit });
  const summaryQuery = useTransactionSummaryQuery(
    filters.fromDate && filters.toDate ? { from: filters.fromDate, to: filters.toDate } : null,
  );
  const projectionQuery = useExpenseProjectionQuery(3);
  const mutations = useTransactionMutations();

  const activeFilters = [
    filters.type,
    filters.source,
    filters.fromDate,
    filters.toDate,
    filters.categoryId,
    filters.accountId,
    filters.creditCardId,
  ].filter(Boolean).length;

  function updateFilters(changes: Partial<TransactionFilters>) {
    setFilters((current) => ({ ...current, ...changes }));
    setPage(1);
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(transaction: TransactionWithRelations) {
    setEditing(transaction);
    setFormOpen(true);
  }

  function confirmDelete() {
    if (!deleting) return;
    mutations.remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
  }

  const originValue = filters.accountId
    ? `account:${filters.accountId}`
    : filters.creditCardId
      ? `card:${filters.creditCardId}`
      : '';

  return (
    <section>
      <PageHeader
        title="Transações"
        description="Consulte, filtre e registre receitas e despesas. As datas são dias civis e não mudam com o fuso do navegador."
        actions={<ActionButton onClick={openCreate}>Nova transação</ActionButton>}
      />

      <TransactionInsights summaryQuery={summaryQuery} projectionQuery={projectionQuery} />

      <div className="mb-5 rounded-2xl border border-border bg-layer01 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Filtros</h2>
          {activeFilters > 0 ? (
            <ActionButton
              variant="secondary"
              className="px-3 py-1.5"
              onClick={() => {
                setFilters({});
                setPage(1);
              }}
            >
              Limpar filtros ({activeFilters})
            </ActionButton>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Tipo">
            {({ id, describedBy }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={filters.type ?? ''}
                onChange={(event) =>
                  updateFilters({ type: (event.target.value || undefined) as TransactionType | undefined })
                }
              >
                <option value="">Receitas e despesas</option>
                <option value="income">Receitas</option>
                <option value="expense">Despesas</option>
              </Select>
            )}
          </Field>

          <Field label="Origem do registro">
            {({ id, describedBy }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={filters.source ?? ''}
                onChange={(event) =>
                  updateFilters({ source: (event.target.value || undefined) as TransactionSource | undefined })
                }
              >
                <option value="">Todas</option>
                {(['manual', 'imported', 'fixed'] as const).map((source) => (
                  <option key={source} value={source}>
                    {TRANSACTION_SOURCE_LABELS[source]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Data inicial">
            {({ id, describedBy }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                type="date"
                value={filters.fromDate ?? ''}
                max={filters.toDate}
                onChange={(event) => updateFilters({ fromDate: event.target.value || undefined })}
              />
            )}
          </Field>

          <Field label="Data final">
            {({ id, describedBy }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                type="date"
                value={filters.toDate ?? ''}
                min={filters.fromDate}
                onChange={(event) => updateFilters({ toDate: event.target.value || undefined })}
              />
            )}
          </Field>

          <Field label="Categoria">
            {({ id, describedBy }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={filters.categoryId ?? ''}
                onChange={(event) => updateFilters({ categoryId: event.target.value || undefined })}
                disabled={references.isPending}
              >
                <option value="">Todas as categorias</option>
                {references.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Conta ou cartão">
            {({ id, describedBy }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={originValue}
                disabled={references.isPending}
                onChange={(event) => {
                  const [kind, identifier] = event.target.value.split(':');
                  updateFilters({
                    accountId: kind === 'account' ? identifier : undefined,
                    creditCardId: kind === 'card' ? identifier : undefined,
                  });
                }}
              >
                <option value="">Todas as contas e cartões</option>
                <optgroup label="Contas">
                  {references.accounts.map((account) => (
                    <option key={account.id} value={`account:${account.id}`}>
                      {account.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Cartões">
                  {references.creditCards.map((card) => (
                    <option key={card.id} value={`card:${card.id}`}>
                      {card.name}
                    </option>
                  ))}
                </optgroup>
              </Select>
            )}
          </Field>
        </div>

        {references.isError ? (
          <p role="alert" className="mt-4 rounded-lg border border-warning/60 bg-layer02 p-3 text-sm text-warning-text">
            Alguns filtros de conta, cartão ou categoria não puderam ser carregados. A lista principal continua
            disponível.
          </p>
        ) : null}
      </div>

      {transactionsQuery.isFetching && !transactionsQuery.isPending ? (
        <output className="mb-2 block text-xs text-muted-foreground">Atualizando resultados…</output>
      ) : null}

      <PaginatedBoundary
        query={transactionsQuery}
        loadingLabel="Carregando transações…"
        emptyTitle="Nenhuma transação encontrada"
        emptyMessage={
          activeFilters > 0
            ? 'Não há lançamentos que correspondam aos filtros atuais.'
            : 'Registre sua primeira receita ou despesa para começar.'
        }
        emptyAction={
          activeFilters > 0 ? (
            <ActionButton onClick={() => setFilters({})}>Limpar filtros</ActionButton>
          ) : (
            <ActionButton onClick={openCreate}>Nova transação</ActionButton>
          )
        }
      >
        {(transactions, meta) => (
          <div className="flex flex-col gap-4">
            <TransactionList items={transactions} meta={meta} onEdit={openEdit} onDelete={setDeleting} />
            <Pagination
              meta={meta}
              itemLabel="transações"
              onPageChange={setPage}
              onLimitChange={(next) => {
                setLimit(next);
                setPage(1);
              }}
            />
          </div>
        )}
      </PaginatedBoundary>

      {formOpen ? (
        <TransactionFormDialog
          transaction={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir transação"
        message={`Excluir “${deleting?.description?.trim() || 'Sem descrição'}” altera os saldos relacionados. Lançamentos confirmados por recorrência precisam ser tratados na ocorrência de origem.`}
        confirmLabel="Excluir"
        destructive
        busy={mutations.remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </section>
  );
}

function TransactionInsights({
  summaryQuery,
  projectionQuery,
}: {
  summaryQuery: ReturnType<typeof useTransactionSummaryQuery>;
  projectionQuery: ReturnType<typeof useExpenseProjectionQuery>;
}) {
  return (
    <div className="mb-5 grid gap-4 xl:grid-cols-2">
      <section aria-labelledby="transaction-summary-title" className="rounded-2xl border border-border bg-layer01 p-4">
        <h2 id="transaction-summary-title" className="text-sm font-semibold text-foreground">
          Resumo do intervalo
        </h2>
        <div className="mt-3">
          {summaryQuery.fetchStatus === 'idle' && summaryQuery.data === undefined ? (
            <p className="text-sm text-muted-foreground">Informe as duas datas para calcular o resumo.</p>
          ) : (
            <QueryBoundary query={summaryQuery} loadingLabel="Calculando resumo…">
              {(summary) => (
                <>
                  <p className="mb-3 text-xs text-muted-foreground">
                    {formatCivilDate(summary.from)} a {formatCivilDate(summary.to)} · {summary.count}{' '}
                    {summary.count === 1 ? 'lançamento' : 'lançamentos'}
                  </p>
                  <dl className="grid grid-cols-3 gap-2 text-sm">
                    <InsightValue label="Receitas" value={summary.income} tone="positive" />
                    <InsightValue label="Despesas" value={summary.expense} tone="negative" />
                    <InsightValue label="Saldo" value={summary.net} tone={summary.net < 0 ? 'negative' : 'positive'} />
                  </dl>
                </>
              )}
            </QueryBoundary>
          )}
        </div>
      </section>

      <section aria-labelledby="expense-projection-title" className="rounded-2xl border border-border bg-layer01 p-4">
        <h2 id="expense-projection-title" className="text-sm font-semibold text-foreground">
          Projeção de despesas
        </h2>
        <div className="mt-3">
          <QueryBoundary query={projectionQuery} loadingLabel="Calculando projeção…">
            {(projection) => (
              <div>
                <p className="text-lg font-semibold tabular-nums text-foreground">
                  {formatMoney(projection.projectedMonthlyExpense)} por mês
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Média dos últimos {projection.basedOnMonths} meses completos, de{' '}
                  {formatCivilDate(projection.window.from)} a {formatCivilDate(projection.window.to)}.
                </p>
              </div>
            )}
          </QueryBoundary>
        </div>
      </section>
    </div>
  );
}

function InsightValue({ label, value, tone }: { label: string; value: number; tone: 'positive' | 'negative' }) {
  return (
    <div className="min-w-0 rounded-lg bg-layer02 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`mt-1 truncate font-semibold tabular-nums ${tone === 'negative' ? 'text-danger-text' : 'text-success-text'}`}
        title={formatMoney(value)}
      >
        {formatMoney(value)}
      </dd>
    </div>
  );
}
