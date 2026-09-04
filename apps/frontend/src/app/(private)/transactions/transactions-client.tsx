'use client';

import type { TransactionSource, TransactionType, TransactionWithRelations } from '@finance/contracts';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { CategoriesClient } from '@/app/(private)/categories/categories-client';
import { TransactionList } from '@/app/(private)/transactions/transaction-list';
import { UncategorizedClient } from '@/app/(private)/transactions/uncategorized/uncategorized-client';
import { useTransactionMutations } from '@/features/transactions/mutations';
import {
  useExpenseProjectionQuery,
  useTransactionsQuery,
  useTransactionSummaryQuery,
  useUncategorizedQuery,
  type TransactionFilters,
} from '@/features/transactions/queries';
import { useTransactionReferences } from '@/features/transactions/references';
import { TransactionFormDialog } from '@/features/transactions/transaction-form-dialog';
import { formatCivilDate, formatMoney, todayCivil, TRANSACTION_SOURCE_LABELS } from '@/shared/lib/format';
import { ConfirmDialog } from '@/shared/ui/dialog';
import { ActionButton, Field, Select, TextInput } from '@/shared/ui/form';
import { Pagination } from '@/shared/ui/pagination';
import { PaginatedBoundary, QueryBoundary } from '@/shared/ui/query-state';
import { SegmentedTabs } from '@/shared/ui/segmented-tabs';

export type TransactionsView = 'all' | 'uncategorized' | 'categories';
const DESCRIPTIONS = {
  all: 'Transações, pendências e categorias em um único contexto.',
  uncategorized: 'Categorize pendências sem sair do contexto da sua movimentação.',
  categories: 'Gerencie categorias junto do seu histórico financeiro.',
};

function MovementHeader({
  view,
  onCreate,
  children,
}: {
  view: TransactionsView;
  onCreate: () => void;
  children?: React.ReactNode;
}) {
  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4" data-tour="page-header">
        <div className="min-w-0 sm:flex-1">
          <h1 className="text-[28px] font-semibold tracking-tight">Movimentações</h1>
          <p className="mt-1 hidden text-[13px] text-muted-foreground sm:block">{DESCRIPTIONS[view]}</p>
        </div>
        {children}
        {view !== 'categories' ? (
          <div className="flex items-center gap-3" data-tour="primary-action">
            {view === 'all' ? (
              <Link
                href="/imports"
                className="hidden min-h-11 items-center rounded-xl bg-layer02 px-4 text-[14px] font-semibold hover:bg-layer03 sm:inline-flex"
              >
                Importar
              </Link>
            ) : null}
            <ActionButton onClick={onCreate} className="min-h-11" aria-label="Nova transação">
              <span className="text-[24px] sm:hidden" aria-hidden="true">
                +
              </span>
              <span className="hidden sm:inline">Nova transação</span>
            </ActionButton>
          </div>
        ) : null}
      </header>
      <SegmentedTabs
        label="Seções de movimentações"
        active={view}
        tabs={[
          { value: 'all', label: 'Todas', href: '/transactions' },
          { value: 'uncategorized', label: 'Sem categoria', href: '/transactions?view=uncategorized' },
          { value: 'categories', label: 'Categorias', href: '/transactions?view=categories' },
        ]}
      />
    </>
  );
}

export function TransactionsClient({ view = 'all' }: { view?: TransactionsView }) {
  const [formOpen, setFormOpen] = useState(false);
  if (view === 'all') return <AllTransactionsClient />;
  return (
    <section>
      <MovementHeader view={view} onCreate={() => setFormOpen(true)} />
      <div data-tour="movements-workspace">
        {view === 'uncategorized' ? <UncategorizedClient embedded /> : <CategoriesClient embedded />}
      </div>
      {formOpen ? <TransactionFormDialog transaction={null} onClose={() => setFormOpen(false)} /> : null}
    </section>
  );
}

function monthFilters(month: string): TransactionFilters {
  if (!month) return { fromDate: undefined, toDate: undefined };
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    fromDate: `${month}-01`,
    toDate: `${month}-${String(new Date(year, monthNumber, 0).getDate()).padStart(2, '0')}`,
  };
}

function AllTransactionsClient() {
  const [filters, setFilters] = useState<TransactionFilters>(() => monthFilters(todayCivil().slice(0, 7)));
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [showFilters, setShowFilters] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionWithRelations | null>(null);
  const [deleting, setDeleting] = useState<TransactionWithRelations | null>(null);
  const references = useTransactionReferences();
  const transactionsQuery = useTransactionsQuery({ ...filters, search: deferredSearch || undefined, page, limit });
  const summaryQuery = useTransactionSummaryQuery(
    filters.fromDate && filters.toDate ? { from: filters.fromDate, to: filters.toDate } : null,
  );
  const projectionQuery = useExpenseProjectionQuery(3);
  const uncategorized = useUncategorizedQuery({ page: 1, limit: 1 });
  const mutations = useTransactionMutations();
  function updateFilters(changes: Partial<TransactionFilters>) {
    setFilters((current) => ({ ...current, ...changes }));
    setPage(1);
  }
  function clearFilters() {
    setFilters({});
    setPage(1);
    setSearch('');
  }
  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  const originValue = filters.accountId
    ? `account:${filters.accountId}`
    : filters.creditCardId
      ? `card:${filters.creditCardId}`
      : '';
  const filtered = Object.values(filters).some(Boolean) || Boolean(search);
  return (
    <section>
      <MovementHeader view="all" onCreate={openCreate}>
        <TextInput
          aria-label="Buscar por descrição"
          placeholder="Buscar por descrição…"
          value={search}
          maxLength={500}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="order-last bg-layer01 xl:order-none xl:w-60 xl:self-center"
        />
      </MovementHeader>
      <div data-tour="movements-workspace" className="space-y-5">
        <div className="flex items-center justify-between gap-3 sm:hidden">
          <ActionButton
            variant="secondary"
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            aria-controls="movement-filters"
          >
            Filtros
          </ActionButton>
          <Link href="/imports" className="text-sm text-muted-primary">
            Importar arquivo
          </Link>
        </div>
        <div id="movement-filters" className={`${showFilters ? 'block' : 'hidden'} space-y-3 sm:block`}>
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold">Filtros rápidos</h2>
            <button type="button" onClick={clearFilters} className="text-xs font-semibold text-muted-primary">
              Limpar filtros
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label="Mês"
              type="month"
              value={filters.fromDate?.slice(0, 7) ?? ''}
              onChange={(event) => updateFilters(monthFilters(event.target.value))}
              className="min-h-10 max-w-full rounded-full border border-border bg-primary px-3 text-xs text-white"
            />
            <Select
              aria-label="Conta ou cartão"
              variant="filter"
              className="sm:max-w-64"
              value={originValue}
              disabled={references.isPending}
              onChange={(event) => {
                const [kind, id] = event.target.value.split(':');
                updateFilters({
                  accountId: kind === 'account' ? id : undefined,
                  creditCardId: kind === 'card' ? id : undefined,
                });
              }}
            >
              <option value="">Todas as contas</option>
              <optgroup label="Contas">
                {references.accounts.map((item) => (
                  <option key={item.id} value={`account:${item.id}`}>
                    {item.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Cartões">
                {references.creditCards.map((item) => (
                  <option key={item.id} value={`card:${item.id}`}>
                    {item.name}
                  </option>
                ))}
              </optgroup>
            </Select>
            <Select
              aria-label="Categoria"
              variant="filter"
              className="sm:max-w-64"
              value={filters.categoryId ?? ''}
              onChange={(event) => updateFilters({ categoryId: event.target.value || undefined })}
              disabled={references.isPending}
            >
              <option value="">Todas as categorias</option>
              {references.categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Tipo"
              variant="filter"
              value={filters.type ?? ''}
              onChange={(event) =>
                updateFilters({ type: (event.target.value || undefined) as TransactionType | undefined })
              }
            >
              <option value="">Tipo</option>
              <option value="income">Receitas</option>
              <option value="expense">Despesas</option>
            </Select>
            <details className="w-full sm:w-auto">
              <summary className="w-fit cursor-pointer list-none rounded-full bg-layer02 px-3 py-3 text-xs text-muted-foreground">
                Mais filtros
              </summary>
              <div className="mt-3 grid gap-3 rounded-xl border border-border bg-layer01 p-4 sm:grid-cols-3">
                <Field label="Data inicial">
                  {({ id }) => (
                    <TextInput
                      id={id}
                      type="date"
                      value={filters.fromDate ?? ''}
                      max={filters.toDate}
                      onChange={(event) => updateFilters({ fromDate: event.target.value || undefined })}
                    />
                  )}
                </Field>
                <Field label="Data final">
                  {({ id }) => (
                    <TextInput
                      id={id}
                      type="date"
                      value={filters.toDate ?? ''}
                      min={filters.fromDate}
                      onChange={(event) => updateFilters({ toDate: event.target.value || undefined })}
                    />
                  )}
                </Field>
                <Field label="Origem do registro">
                  {({ id }) => (
                    <Select
                      id={id}
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
              </div>
            </details>
          </div>
          {references.isError ? (
            <p role="alert" className="text-xs text-warning-text">
              Não foi possível carregar alguns filtros.{' '}
              <button type="button" className="underline" onClick={references.refetch}>
                Tentar novamente
              </button>
            </p>
          ) : null}
        </div>
        {filters.fromDate && filters.toDate ? (
          <QueryBoundary query={summaryQuery} loadingLabel="Calculando resumo…">
            {(summary) => (
              <div>
                <dl className="grid gap-4 sm:grid-cols-3">
                  {[
                    {
                      label: 'Receitas',
                      value: summary.income,
                      hint: 'Entradas confirmadas no período',
                      tone: 'text-success-text',
                    },
                    {
                      label: 'Despesas',
                      value: summary.expense,
                      hint: 'Saídas confirmadas no período',
                      tone: 'text-danger-text',
                    },
                    {
                      label: 'Saldo do período',
                      value: summary.net,
                      hint: 'Receitas menos despesas',
                      tone: 'text-muted-foreground',
                    },
                  ].map((metric) => (
                    <div
                      key={metric.label}
                      className={`rounded-2xl border border-border bg-layer02 p-5 ${metric.label !== 'Saldo do período' ? 'hidden sm:block' : ''}`}
                    >
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{metric.label}</dt>
                      <dd className="my-2 text-[24px] font-semibold tabular-nums">{formatMoney(metric.value)}</dd>
                      <p className={`text-xs ${metric.tone}`}>{metric.hint}</p>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Resumo de todas as movimentações de {formatCivilDate(summary.from)} a {formatCivilDate(summary.to)}.
                </p>
              </div>
            )}
          </QueryBoundary>
        ) : (
          <p className="rounded-xl border border-border bg-layer01 p-4 text-sm text-muted-foreground">
            Selecione um período para ver o resumo financeiro.
          </p>
        )}
        <div className="rounded-2xl border border-border bg-layer01 p-3 sm:p-6">
          {transactionsQuery.isFetching && !transactionsQuery.isPending ? (
            <output className="mb-2 block text-xs text-muted-foreground">Atualizando resultados…</output>
          ) : null}
          <PaginatedBoundary
            query={transactionsQuery}
            loadingLabel="Carregando transações…"
            emptyTitle="Nenhuma transação encontrada"
            emptyMessage={
              filtered
                ? 'Não há lançamentos que correspondam à busca e aos filtros.'
                : 'Registre sua primeira receita ou despesa para começar.'
            }
            emptyAction={
              <ActionButton onClick={filtered ? clearFilters : openCreate}>
                {filtered ? 'Limpar filtros' : 'Nova transação'}
              </ActionButton>
            }
          >
            {(transactions, meta) => (
              <div className="space-y-6">
                <TransactionList
                  items={transactions}
                  meta={meta}
                  onEdit={(transaction) => {
                    setEditing(transaction);
                    setFormOpen(true);
                  }}
                  onDelete={setDeleting}
                />
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
        </div>
        <QueryBoundary query={uncategorized} loadingLabel="Consultando pendências…">
          {({ meta }) =>
            meta.totalItems > 0 ? (
              <Link
                href="/transactions?view=uncategorized"
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted-primary/10 p-4 text-xs text-muted-foreground"
              >
                <span>
                  {meta.totalItems} {meta.totalItems === 1 ? 'item aguardando categoria' : 'itens aguardando categoria'}
                </span>
                <span className="font-semibold text-muted-primary">Revisar</span>
              </Link>
            ) : null
          }
        </QueryBoundary>
        <details className="rounded-xl border border-border bg-layer01 p-4">
          <summary className="cursor-pointer text-sm font-medium">Projeção de despesas</summary>
          <div className="mt-4">
            <QueryBoundary query={projectionQuery} loadingLabel="Calculando projeção…">
              {(projection) => (
                <div>
                  <p className="text-lg font-semibold">{formatMoney(projection.projectedMonthlyExpense)} por mês</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Média dos últimos {projection.basedOnMonths} meses completos, de{' '}
                    {formatCivilDate(projection.window.from)} a {formatCivilDate(projection.window.to)}.
                  </p>
                </div>
              )}
            </QueryBoundary>
          </div>
        </details>
      </div>
      {formOpen ? <TransactionFormDialog transaction={editing} onClose={() => setFormOpen(false)} /> : null}
      <ConfirmDialog
        open={deleting !== null}
        title="Excluir transação"
        message={`Excluir “${deleting?.description?.trim() || 'Sem descrição'}” altera os saldos relacionados.`}
        confirmLabel="Excluir"
        destructive
        busy={mutations.remove.isPending}
        onConfirm={() => {
          if (deleting) mutations.remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
        onCancel={() => setDeleting(null)}
      />
    </section>
  );
}
