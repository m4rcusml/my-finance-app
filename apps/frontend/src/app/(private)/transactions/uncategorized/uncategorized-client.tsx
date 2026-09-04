'use client';

import type { Category, TransactionWithRelations } from '@finance/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useActiveCategoriesQuery } from '@/features/categories/queries';
import { useTransactionMutations } from '@/features/transactions/mutations';
import { useUncategorizedQuery } from '@/features/transactions/queries';
import { formatCivilDate, formatMoney, TRANSACTION_TYPE_LABELS } from '@/shared/lib/format';
import { PageHeader } from '@/shared/ui/app-shell';
import { ActionButton } from '@/shared/ui/form';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/query-state';
import { useToast } from '@/shared/ui/toast';

const QUEUE_PAGE_SIZE = 20;

export function UncategorizedClient({ embedded = false }: { embedded?: boolean }) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [index, setIndex] = useState(0);
  const query = useUncategorizedQuery({ page, limit: QUEUE_PAGE_SIZE });
  const categories = useActiveCategoriesQuery();
  const mutations = useTransactionMutations();
  const items = query.data?.data ?? [];
  const currentIndex = Math.min(index, Math.max(0, items.length - 1));
  const transaction = items[currentIndex];
  const meta = query.data?.meta;
  const position = (page - 1) * QUEUE_PAGE_SIZE + currentIndex + 1;
  const total = meta?.totalItems ?? 0;
  const busy = mutations.update.isPending || query.isFetching;

  // Another tab may categorize the final item on this page while it is open.
  useEffect(() => {
    if (query.isSuccess && !query.isFetching && meta && page > Math.max(1, meta.totalPages)) {
      setPage(Math.max(1, meta.totalPages));
      setIndex(0);
    }
  }, [query.isSuccess, query.isFetching, meta, page]);

  function previous() {
    if (busy || position <= 1) return;
    if (currentIndex > 0) setIndex(currentIndex - 1);
    else {
      setPage(page - 1);
      setIndex(QUEUE_PAGE_SIZE - 1);
    }
  }
  function next() {
    if (busy || position >= total) return;
    if (currentIndex < items.length - 1) setIndex(currentIndex + 1);
    else {
      setPage(page + 1);
      setIndex(0);
    }
  }
  async function categorize(categoryId: string) {
    if (!transaction || busy) return;
    try {
      await mutations.update.mutateAsync({ id: transaction.id, body: { categoryId } });
      toast.success('Transação categorizada.');
      if (items.length === 1 && page > 1) {
        setPage(page - 1);
        setIndex(0);
      }
    } catch {
      /* Shared mutation retains the item and displays the API error. */
    }
  }

  return (
    <div className="space-y-6">
      {!embedded ? (
        <PageHeader title="Sem categoria" description="Revise um lançamento por vez e avance pela fila." />
      ) : null}
      {query.isPending ? <LoadingState label="Carregando fila de categorização…" /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.isSuccess && total === 0 ? (
        <EmptyState
          title="Fila concluída"
          message="Todas as suas transações já têm categoria. Novas importações sem categoria aparecerão aqui."
          action={
            <Link href="/transactions" className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold">
              Voltar às transações
            </Link>
          }
        />
      ) : null}
      {query.isSuccess && transaction && meta ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-layer01 p-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-primary">
                Fila de categorização
              </p>
              <p className="mt-1 text-[14px] font-semibold" aria-live="polite">
                Item {position} de {total} pendentes
              </p>
            </div>
            <progress
              value={position}
              max={total}
              aria-label="Posição na fila"
              className="h-2.5 w-full max-w-xs overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-layer02 [&::-webkit-progress-value]:bg-muted-primary [&::-moz-progress-bar]:bg-muted-primary"
            />
          </div>
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <UncategorizedCard
              key={transaction.id}
              transaction={transaction}
              categories={categories.categories}
              categoriesPending={categories.isPending}
              categoriesError={categories.error}
              retryCategories={() => void categories.query.refetch()}
              position={position}
              total={total}
              busy={busy}
              onSave={categorize}
              onPrevious={previous}
              onNext={next}
            />
            <aside className="min-w-0 rounded-2xl border border-border bg-layer01 p-5 sm:p-6">
              <h2 className="text-[20px] font-semibold">Próximos da fila</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {total} {total === 1 ? 'pendência no total' : 'pendências no total'}
              </p>
              <ul className="my-6 space-y-3">
                {items.slice(currentIndex + 1, currentIndex + 5).map((item, offset) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setIndex(currentIndex + offset + 1)}
                      className="flex min-h-24 w-full items-center justify-between gap-3 rounded-xl border border-border bg-layer02/35 p-4 text-left hover:bg-layer02 disabled:opacity-60"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold">
                          {item.description || 'Sem descrição'}
                        </span>
                        <span className="mt-3 block text-xs text-muted-foreground">{formatCivilDate(item.date)}</span>
                      </span>
                      <span
                        className={`shrink-0 text-[14px] font-semibold tabular-nums ${item.type === 'income' ? 'text-success-text' : 'text-danger-text'}`}
                      >
                        {item.type === 'income' ? '+' : '−'} {formatMoney(item.value)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {currentIndex === items.length - 1 && position < total ? (
                <ActionButton variant="secondary" onClick={next} disabled={busy} className="mb-6 w-full">
                  Carregar próximos itens
                </ActionButton>
              ) : null}
              <div className="rounded-xl border border-border bg-muted-primary/10 p-4">
                <h3 className="text-[15px] font-semibold">Cada categoria conta</h3>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  Classificar suas movimentações ajuda a entender onde o dinheiro está sendo usado. Você pode deixar um
                  item para depois sem alterar seus dados.
                </p>
                <Link
                  href="/transactions?view=categories"
                  className="mt-4 inline-block text-xs font-semibold text-muted-primary"
                >
                  Gerenciar categorias
                </Link>
              </div>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}

function UncategorizedCard({
  transaction,
  categories,
  categoriesPending,
  categoriesError,
  retryCategories,
  position,
  total,
  busy,
  onSave,
  onPrevious,
  onNext,
}: {
  transaction: TransactionWithRelations;
  categories: Category[];
  categoriesPending: boolean;
  categoriesError: unknown;
  retryCategories: () => void;
  position: number;
  total: number;
  busy: boolean;
  onSave: (id: string) => Promise<void>;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const [categoryId, setCategoryId] = useState('');
  const router = useRouter();
  const compatible = categories.filter(
    (item) => item.isActive && (item.type === 'both' || item.type === transaction.type),
  );
  const origin = transaction.account?.name ?? transaction.creditCard?.name ?? 'Origem indisponível';
  const canSave = Boolean(categoryId) && !busy && !categoriesPending && !categoriesError;
  useEffect(() => {
    const navigate = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        document.querySelector('[role="dialog"]')
      )
        return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, select, textarea, [contenteditable="true"]')) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onPrevious();
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onNext();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        router.push('/transactions');
      }
    };
    document.addEventListener('keydown', navigate);
    return () => document.removeEventListener('keydown', navigate);
  }, [onPrevious, onNext, router]);
  return (
    <section
      aria-labelledby="transacao-pendente"
      className="min-w-0 rounded-2xl border border-border bg-layer01 p-5 sm:p-7"
    >
      <p className="text-[11px] font-semibold uppercase text-warning-text">Movimentação sem categoria</p>
      <div className="my-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="transacao-pendente" className="break-words text-[28px] font-bold">
            {transaction.description || 'Transação sem descrição'}
          </h2>
          <p className="mt-2 text-[14px] text-muted-foreground">
            {formatCivilDate(transaction.date)} · {origin}
          </p>
        </div>
        <p
          className={`text-[24px] font-bold tabular-nums ${transaction.type === 'expense' ? 'text-danger-text' : 'text-success-text'}`}
        >
          {transaction.type === 'expense' ? '−' : '+'} {formatMoney(transaction.value)}
        </p>
      </div>
      <dl className="grid gap-4 rounded-xl border border-border bg-layer02/35 p-4 text-[14px] sm:grid-cols-3">
        {[
          { label: 'Origem', value: origin },
          { label: 'Data', value: formatCivilDate(transaction.date) },
          { label: 'Tipo', value: TRANSACTION_TYPE_LABELS[transaction.type] },
        ].map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-[10px] uppercase text-muted-foreground">{item.label}</dt>
            <dd className="mt-3 truncate" title={item.value}>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      <fieldset className="my-8" disabled={busy || categoriesPending}>
        <legend className="mb-5 text-[17px] font-semibold">Qual categoria descreve melhor esta movimentação?</legend>
        {categoriesPending ? <LoadingState label="Carregando categorias…" /> : null}
        {categoriesError ? (
          <ErrorState error={categoriesError} onRetry={retryCategories} />
        ) : (
          <div className="flex flex-wrap gap-3">
            {compatible.map((category) => (
              <label key={category.id} className="relative cursor-pointer">
                <input
                  type="radio"
                  name={`category-${transaction.id}`}
                  value={category.id}
                  checked={categoryId === category.id}
                  onChange={() => setCategoryId(category.id)}
                  className="peer sr-only"
                />
                <span className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-layer02 px-4 text-[13px] text-muted-foreground peer-checked:border-muted-primary peer-checked:bg-primary/20 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-muted-primary">
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: category.color ?? '#94a3b8' }}
                  />
                  {category.name}
                </span>
              </label>
            ))}
          </div>
        )}
        {!categoriesPending && !categoriesError && compatible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Não há categoria ativa compatível.{' '}
            <Link href="/transactions?view=categories" className="text-muted-primary underline">
              Criar ou restaurar categoria
            </Link>
          </p>
        ) : null}
      </fieldset>
      <p className="rounded-xl border border-border bg-muted-primary/10 p-4 text-xs text-muted-foreground">
        Fora dos campos, use ← e → para navegar e Esc para voltar à lista. Enter aciona o botão em foco.
      </p>
      <div className="mt-8 space-y-3">
        <ActionButton
          className="min-h-13 w-full"
          disabled={!canSave}
          loading={busy}
          onClick={() => void onSave(categoryId)}
        >
          Categorizar e ir para a próxima
        </ActionButton>
        {position < total ? (
          <ActionButton variant="secondary" className="min-h-12 w-full text-[13px]" disabled={busy} onClick={onNext}>
            Ignorar por agora
          </ActionButton>
        ) : (
          <Link
            href="/transactions"
            className="flex min-h-12 items-center justify-center rounded-xl border border-border bg-layer02 text-[13px]"
          >
            Deixar para depois e voltar à lista
          </Link>
        )}
      </div>
      <nav
        aria-label="Navegar pela fila"
        className="mt-8 flex items-center justify-center gap-3 text-xs text-muted-primary"
      >
        <button
          type="button"
          onClick={onPrevious}
          disabled={position <= 1 || busy}
          className="min-h-10 disabled:opacity-40"
        >
          Anterior
        </button>
        <span>
          {position} / {total}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={position >= total || busy}
          className="min-h-10 disabled:opacity-40"
        >
          Próxima
        </button>
      </nav>
    </section>
  );
}
