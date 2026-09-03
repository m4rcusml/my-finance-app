'use client';

import type { Category, TransactionWithRelations } from '@finance/contracts';
import Link from 'next/link';
import { useState } from 'react';
import { useActiveCategoriesQuery } from '@/features/categories/queries';
import { useTransactionMutations } from '@/features/transactions/mutations';
import { useUncategorizedQuery } from '@/features/transactions/queries';
import { errorMessage } from '@/shared/lib/api';
import { formatCivilDate, formatMoney, TRANSACTION_SOURCE_LABELS, TRANSACTION_TYPE_LABELS } from '@/shared/lib/format';
import { PageHeader } from '@/shared/ui/app-shell';
import { ActionButton, Field, Select } from '@/shared/ui/form';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/query-state';
import { useToast } from '@/shared/ui/toast';

export function UncategorizedClient() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const transactionsQuery = useUncategorizedQuery({ page, limit: 1 });
  const categoriesQuery = useActiveCategoriesQuery();
  const mutations = useTransactionMutations();

  const transaction = transactionsQuery.data?.data[0] ?? null;
  const meta = transactionsQuery.data?.meta;

  async function categorize(transactionId: string, categoryId: string) {
    try {
      await mutations.update.mutateAsync({ id: transactionId, body: { categoryId } });
      toast.success('Transação categorizada.');
      if (meta && page >= meta.totalItems) setPage((current) => Math.max(1, current - 1));
    } catch {
      // The shared mutation displays the server error and keeps this card open.
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sem categoria"
        description="Revise um lançamento por vez. Salvar remove o item desta fila sem alterar valor, data ou origem."
        actions={
          <Link
            href="/transactions"
            className="inline-flex items-center justify-center rounded-lg border border-border-strong bg-layer02 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-layer03"
          >
            Ver todas as transações
          </Link>
        }
      />

      {transactionsQuery.isPending ? <LoadingState label="Carregando fila de categorização…" /> : null}
      {transactionsQuery.isError ? (
        <ErrorState error={transactionsQuery.error} onRetry={() => transactionsQuery.refetch()} />
      ) : null}

      {transactionsQuery.isSuccess && meta?.totalItems === 0 ? (
        <EmptyState
          title="Fila concluída"
          message="Todas as suas transações já têm categoria. Novas importações sem categoria aparecerão aqui."
          action={
            <Link href="/transactions" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-foreground">
              Voltar às transações
            </Link>
          }
        />
      ) : null}

      {transactionsQuery.isSuccess && transaction && meta ? (
        <UncategorizedCard
          key={transaction.id}
          transaction={transaction}
          categories={categoriesQuery.categories}
          categoriesPending={categoriesQuery.isPending}
          categoriesError={categoriesQuery.error}
          position={meta.page}
          total={meta.totalItems}
          busy={mutations.update.isPending}
          onSave={(categoryId) => categorize(transaction.id, categoryId)}
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => current + 1)}
          hasPrevious={meta.hasPreviousPage}
          hasNext={meta.hasNextPage}
          retryCategories={() => categoriesQuery.query.refetch()}
        />
      ) : null}
    </div>
  );
}

function UncategorizedCard({
  transaction,
  categories,
  categoriesPending,
  categoriesError,
  position,
  total,
  busy,
  onSave,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  retryCategories,
}: {
  transaction: TransactionWithRelations;
  categories: Category[];
  categoriesPending: boolean;
  categoriesError: unknown;
  position: number;
  total: number;
  busy: boolean;
  onSave: (categoryId: string) => Promise<void>;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  retryCategories: () => void;
}) {
  const [categoryId, setCategoryId] = useState('');
  const compatibleCategories = categories.filter(
    (category) => category.type === 'both' || category.type === transaction.type,
  );
  const origin = transaction.account?.name ?? transaction.creditCard?.name ?? 'Origem indisponível';

  return (
    <section
      aria-labelledby="transacao-pendente"
      className="mx-auto w-full max-w-2xl rounded-2xl border border-border bg-layer01 p-4 sm:p-6"
    >
      <div className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Item {position} de {total}
          </p>
          <h2 id="transacao-pendente" className="mt-1 text-lg font-semibold text-foreground">
            {transaction.description || 'Transação sem descrição'}
          </h2>
        </div>
        <p
          className={`text-xl font-semibold tabular-nums ${transaction.type === 'expense' ? 'text-danger-text' : 'text-success-text'}`}
        >
          {transaction.type === 'expense' ? '−' : '+'}
          {formatMoney(transaction.value)}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 py-5 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Data</dt>
          <dd className="text-foreground">{formatCivilDate(transaction.date)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Tipo</dt>
          <dd className="text-foreground">{TRANSACTION_TYPE_LABELS[transaction.type]}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Origem financeira</dt>
          <dd className="truncate text-foreground" title={origin}>
            {origin}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Origem do registro</dt>
          <dd className="text-foreground">{TRANSACTION_SOURCE_LABELS[transaction.source]}</dd>
        </div>
      </dl>

      {categoriesError ? (
        <div role="alert" className="rounded-lg border border-danger/60 bg-layer02 p-3">
          <p className="text-sm text-danger-text">{errorMessage(categoriesError)}</p>
          <button
            type="button"
            onClick={retryCategories}
            className="mt-2 text-sm font-medium text-foreground underline underline-offset-2"
          >
            Tentar carregar categorias novamente
          </button>
        </div>
      ) : (
        <Field
          label="Categoria"
          required
          hint="São exibidas apenas categorias ativas compatíveis com o tipo deste lançamento."
        >
          {({ id, describedBy }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={categoriesPending || busy}
            >
              <option value="">{categoriesPending ? 'Carregando categorias…' : 'Selecione uma categoria'}</option>
              {compatibleCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}

      {!categoriesPending && !categoriesError && compatibleCategories.length === 0 ? (
        <p className="mt-3 rounded-lg border border-warning/60 bg-layer02 p-3 text-sm text-muted-foreground">
          Não há categoria ativa compatível.{' '}
          <Link href="/categories" className="font-medium text-foreground underline underline-offset-2">
            Criar ou reativar uma categoria
          </Link>
        </p>
      ) : null}

      <div className="mt-5 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <ActionButton variant="secondary" onClick={onPrevious} disabled={!hasPrevious || busy}>
            Anterior
          </ActionButton>
          <ActionButton variant="secondary" onClick={onNext} disabled={!hasNext || busy}>
            Próxima
          </ActionButton>
        </div>
        <ActionButton
          onClick={() => void onSave(categoryId)}
          loading={busy}
          disabled={!categoryId || categoriesPending || Boolean(categoriesError) || busy}
        >
          Salvar categoria
        </ActionButton>
      </div>
    </section>
  );
}
