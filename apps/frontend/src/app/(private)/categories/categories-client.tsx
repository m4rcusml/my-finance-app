'use client';

import type { Category, CategoryType } from '@finance/contracts';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { CategoryForm, CategoryFormDialog } from '@/features/categories/category-form-dialog';
import {
  useArchiveCategoryMutation,
  useDeleteCategoryMutation,
  useRestoreCategoryMutation,
} from '@/features/categories/mutations';
import { useCategoriesQuery } from '@/features/categories/queries';
import { useUncategorizedQuery } from '@/features/transactions/queries';
import { CATEGORY_TYPE_LABELS } from '@/shared/lib/format';
import { PageHeader } from '@/shared/ui/app-shell';
import { ConfirmDialog } from '@/shared/ui/dialog';
import { ActionButton, Select, TextInput } from '@/shared/ui/form';
import { Pagination } from '@/shared/ui/pagination';
import { PaginatedBoundary, QueryBoundary } from '@/shared/ui/query-state';

type PendingAction = { kind: 'archive' | 'delete'; category: Category } | null;

export function CategoriesClient({ embedded = false }: { embedded?: boolean }) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [status, setStatus] = useState<'active' | 'archived' | 'all'>('active');
  const [type, setType] = useState<CategoryType | ''>('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [editing, setEditing] = useState<Category | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const query = useCategoriesQuery({
    page,
    limit,
    status,
    type: type || undefined,
    search: deferredSearch || undefined,
  });
  const active = useCategoriesQuery({ status: 'active', limit: 1 });
  const archived = useCategoriesQuery({ status: 'archived', limit: 1 });
  const uncategorized = useUncategorizedQuery({ limit: 1 });
  const archiveMutation = useArchiveCategoryMutation();
  const restoreMutation = useRestoreCategoryMutation();
  const deleteMutation = useDeleteCategoryMutation();
  const busy = archiveMutation.isPending || restoreMutation.isPending || deleteMutation.isPending;
  function confirmPendingAction() {
    if (!pendingAction) return;
    const mutation = pendingAction.kind === 'archive' ? archiveMutation : deleteMutation;
    mutation.mutate(pendingAction.category.id, { onSuccess: () => setPendingAction(null) });
  }
  return (
    <section className="space-y-6">
      {!embedded ? (
        <PageHeader title="Categorias" description="Organize suas receitas e despesas sem perder o histórico." />
      ) : null}
      <dl className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: 'Ativas', query: active, tone: 'text-success-text' },
          { label: 'Arquivadas', query: archived, tone: 'text-muted-foreground' },
        ].map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-border bg-layer02 p-3 sm:p-5">
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">{metric.label}</dt>
            <dd className={`mt-2 text-[24px] font-semibold ${metric.tone}`}>
              <QueryBoundary query={metric.query} loadingLabel="Consultando…">
                {({ meta }) => meta.totalItems}
              </QueryBoundary>
            </dd>
          </div>
        ))}
        <div className="rounded-2xl border border-border bg-layer02 p-3 sm:p-5">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">Sem categoria</dt>
          <dd className="mt-2 text-[24px] font-semibold text-warning-text">
            <QueryBoundary query={uncategorized} loadingLabel="Consultando…">
              {({ meta }) => <Link href="/transactions?view=uncategorized">{meta.totalItems}</Link>}
            </QueryBoundary>
          </dd>
        </div>
      </dl>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <section
          className="min-w-0 rounded-2xl border border-border bg-layer01 p-4 sm:p-6"
          aria-labelledby="category-list-title"
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 id="category-list-title" className="text-[20px] font-semibold">
              Categorias cadastradas
            </h2>
            <TextInput
              aria-label="Buscar categoria"
              placeholder="Buscar categoria…"
              value={search}
              maxLength={80}
              className="bg-layer00 sm:max-w-60"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {(
              [
                { value: 'active', label: 'Ativas' },
                { value: 'archived', label: 'Arquivadas' },
                { value: 'all', label: 'Todas' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={status === option.value}
                onClick={() => {
                  setStatus(option.value);
                  setPage(1);
                }}
                className={`min-h-10 rounded-full border border-border px-4 text-xs font-medium ${status === option.value ? 'bg-muted-primary/20 text-muted-primary' : 'bg-layer02 text-muted-foreground'}`}
              >
                {option.label}
              </button>
            ))}
            <Select
              aria-label="Tipo de categoria"
              value={type}
              variant="filter"
              onChange={(event) => {
                setType(event.target.value as CategoryType | '');
                setPage(1);
              }}
            >
              <option value="">Todos os tipos</option>
              <option value="income">Receita</option>
              <option value="expense">Despesa</option>
              <option value="both">Ambos</option>
            </Select>
          </div>
          <PaginatedBoundary
            query={query}
            loadingLabel="Carregando categorias…"
            emptyTitle="Nenhuma categoria encontrada"
            emptyMessage="Crie uma categoria no formulário ou ajuste os filtros para encontrar uma existente."
            emptyAction={
              <ActionButton
                variant="secondary"
                onClick={() => {
                  setSearch('');
                  setStatus('all');
                  setType('');
                  setPage(1);
                }}
              >
                Limpar filtros
              </ActionButton>
            }
          >
            {(categories, meta) => (
              <div className="space-y-6">
                <ul className="space-y-3">
                  {categories.map((category) => (
                    <li
                      key={category.id}
                      className="relative flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-border bg-layer02/35 p-4"
                    >
                      <span
                        aria-hidden="true"
                        className="size-8 shrink-0 rounded-full"
                        style={{ backgroundColor: category.color ?? '#94a3b8' }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[16px] font-semibold">{category.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{CATEGORY_TYPE_LABELS[category.type]}</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-2 text-xs ${category.isActive ? 'bg-success/15 text-success-text' : 'bg-layer02 text-muted-foreground'}`}
                      >
                        {category.isActive ? 'Ativa' : 'Arquivada'}
                      </span>
                      <ActionButton
                        variant="secondary"
                        disabled={busy}
                        className="text-xs"
                        onClick={() => (category.isActive ? setEditing(category) : restoreMutation.mutate(category.id))}
                      >
                        {category.isActive ? 'Editar' : 'Restaurar'} <span className="sr-only">{category.name}</span>
                      </ActionButton>
                      <details>
                        <summary
                          aria-label={`Mais ações de ${category.name}`}
                          className="flex size-7 cursor-pointer list-none items-center justify-center text-lg text-muted-foreground"
                        >
                          ⋮
                        </summary>
                        <div className="absolute right-3 top-16 z-10 flex flex-col gap-2 rounded-xl border border-border bg-layer02 p-3 shadow-xl">
                          {!category.isActive ? (
                            <ActionButton variant="secondary" disabled={busy} onClick={() => setEditing(category)}>
                              Editar
                            </ActionButton>
                          ) : (
                            <ActionButton
                              variant="secondary"
                              disabled={busy}
                              onClick={() => setPendingAction({ kind: 'archive', category })}
                            >
                              Arquivar
                            </ActionButton>
                          )}
                          <ActionButton
                            variant="danger"
                            disabled={busy}
                            onClick={() => setPendingAction({ kind: 'delete', category })}
                          >
                            Excluir
                          </ActionButton>
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
                <Pagination
                  meta={meta}
                  itemLabel="categorias"
                  onPageChange={setPage}
                  onLimitChange={(next) => {
                    setLimit(next);
                    setPage(1);
                  }}
                />
              </div>
            )}
          </PaginatedBoundary>
        </section>
        <aside className="min-w-0 space-y-6">
          <section
            className="rounded-2xl border border-border bg-layer01 p-5 sm:p-6"
            aria-labelledby="new-category-title"
          >
            <h2 id="new-category-title" className="text-[20px] font-semibold">
              Nova categoria
            </h2>
            <p className="mb-7 mt-1 text-[13px] text-muted-foreground">
              Crie uma opção clara para classificar novas movimentações.
            </p>
            <CategoryForm />
          </section>
          <section className="rounded-2xl border border-border bg-muted-primary/10 p-5">
            <h2 className="text-[16px] font-semibold">Arquivar preserva o contexto</h2>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
              Se a categoria já aparece no histórico, ela continua legível e deixa de aceitar novos lançamentos.
            </p>
            <Link
              href="/transactions?view=uncategorized"
              className="mt-5 flex min-h-12 items-center justify-center rounded-xl border border-border bg-layer02 text-xs font-semibold text-muted-primary"
            >
              Revisar movimentações sem categoria
            </Link>
          </section>
        </aside>
      </div>
      <CategoryFormDialog open={editing !== null} category={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={pendingAction?.kind === 'archive'}
        title="Arquivar categoria"
        message={`“${pendingAction?.category.name ?? ''}” sairá dos novos lançamentos, mas continuará aparecendo no histórico.`}
        confirmLabel="Arquivar"
        busy={archiveMutation.isPending}
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />
      <ConfirmDialog
        open={pendingAction?.kind === 'delete'}
        title="Excluir categoria"
        message={`“${pendingAction?.category.name ?? ''}” só será removida definitivamente se não possuir vínculos; caso contrário, será arquivada.`}
        confirmLabel="Excluir"
        destructive
        busy={deleteMutation.isPending}
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />
    </section>
  );
}
