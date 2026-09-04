'use client';

import type { Category, CategoryType } from '@finance/contracts';
import { useState } from 'react';
import { CategoryFormDialog } from '@/features/categories/category-form-dialog';
import {
  useArchiveCategoryMutation,
  useDeleteCategoryMutation,
  useRestoreCategoryMutation,
} from '@/features/categories/mutations';
import { useCategoriesQuery } from '@/features/categories/queries';
import { CATEGORY_TYPE_LABELS } from '@/shared/lib/format';
import { PageHeader } from '@/shared/ui/app-shell';
import { ConfirmDialog } from '@/shared/ui/dialog';
import { ActionButton, Field, Select } from '@/shared/ui/form';
import { Pagination } from '@/shared/ui/pagination';
import { PaginatedBoundary } from '@/shared/ui/query-state';

type PendingAction = { kind: 'archive' | 'delete'; category: Category } | null;

export function CategoriesClient({ embedded = false }: { embedded?: boolean }) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [type, setType] = useState<CategoryType | ''>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const query = useCategoriesQuery({
    page,
    limit,
    includeArchived,
    type: type || undefined,
  });
  const archiveMutation = useArchiveCategoryMutation();
  const restoreMutation = useRestoreCategoryMutation();
  const deleteMutation = useDeleteCategoryMutation();

  const busyId =
    (archiveMutation.isPending ? archiveMutation.variables : null) ??
    (restoreMutation.isPending ? restoreMutation.variables : null) ??
    (deleteMutation.isPending ? deleteMutation.variables : null) ??
    null;

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setFormOpen(true);
  }

  function confirmPendingAction() {
    if (!pendingAction) return;
    const mutation = pendingAction.kind === 'archive' ? archiveMutation : deleteMutation;
    mutation.mutate(pendingAction.category.id, { onSuccess: () => setPendingAction(null) });
  }

  return (
    <section>
      {embedded ? (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Categorias</h2>
            <p className="mt-1 text-sm text-muted-foreground">Organize receitas e despesas sem perder o histórico.</p>
          </div>
          <ActionButton onClick={openCreate}>Nova categoria</ActionButton>
        </div>
      ) : (
        <PageHeader
          title="Categorias"
          description="Organize receitas e despesas. Categorias arquivadas continuam identificando lançamentos antigos, mas não aparecem em novos lançamentos."
          actions={<ActionButton onClick={openCreate}>Nova categoria</ActionButton>}
        />
      )}

      <div className="mb-4 grid gap-4 rounded-xl border border-border bg-layer01 p-4 sm:grid-cols-2">
        <Field label="Tipo">
          {({ id, describedBy }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              value={type}
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
          )}
        </Field>

        <Field label="Incluir arquivadas">
          {({ id }) => (
            <label htmlFor={id} className="flex min-h-10 items-center gap-2 text-sm text-muted-foreground">
              <input
                id={id}
                type="checkbox"
                checked={includeArchived}
                onChange={(event) => {
                  setIncludeArchived(event.target.checked);
                  setPage(1);
                }}
                className="size-5 rounded border-border-strong bg-layer02 accent-primary"
              />
              Mostrar também categorias fora de uso
            </label>
          )}
        </Field>
      </div>

      <PaginatedBoundary
        query={query}
        loadingLabel="Carregando categorias…"
        emptyTitle="Nenhuma categoria encontrada"
        emptyMessage={
          type || includeArchived
            ? 'Não há categorias que correspondam aos filtros atuais.'
            : 'Crie categorias para identificar suas receitas e despesas.'
        }
        emptyAction={
          type ? (
            <ActionButton onClick={() => setType('')}>Limpar filtro</ActionButton>
          ) : (
            <ActionButton onClick={openCreate}>Nova categoria</ActionButton>
          )
        }
      >
        {(categories, meta) => (
          <div className="flex flex-col gap-4">
            <div className="hidden overflow-x-auto rounded-xl border border-border bg-layer01 sm:block">
              <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                <caption className="sr-only">Categorias cadastradas, com tipo, estado e ações.</caption>
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                      Nome
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                      Tipo
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                      Estado
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id} className="border-b border-border last:border-0 hover:bg-layer02/50">
                      <th scope="row" className="px-4 py-3 font-medium text-foreground">
                        {category.name}
                      </th>
                      <td className="px-4 py-3 text-muted-foreground">{CATEGORY_TYPE_LABELS[category.type]}</td>
                      <td className="px-4 py-3">
                        <StatusBadge active={category.isActive} />
                      </td>
                      <td className="px-4 py-3">
                        <CategoryActions
                          category={category}
                          busy={busyId === category.id}
                          onEdit={() => openEdit(category)}
                          onArchive={() => setPendingAction({ kind: 'archive', category })}
                          onRestore={() => restoreMutation.mutate(category.id)}
                          onDelete={() => setPendingAction({ kind: 'delete', category })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="flex flex-col gap-3 sm:hidden">
              {categories.map((category) => (
                <li key={category.id} className="rounded-xl border border-border bg-layer01 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{category.name}</p>
                      <p className="text-sm text-muted-foreground">{CATEGORY_TYPE_LABELS[category.type]}</p>
                    </div>
                    <StatusBadge active={category.isActive} />
                  </div>
                  <div className="mt-3 border-t border-border pt-3">
                    <CategoryActions
                      category={category}
                      busy={busyId === category.id}
                      onEdit={() => openEdit(category)}
                      onArchive={() => setPendingAction({ kind: 'archive', category })}
                      onRestore={() => restoreMutation.mutate(category.id)}
                      onDelete={() => setPendingAction({ kind: 'delete', category })}
                    />
                  </div>
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

      <CategoryFormDialog open={formOpen} category={editing} onClose={() => setFormOpen(false)} />

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

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
        active ? 'border-success/60 text-success-text' : 'border-border-strong text-warning-text'
      }`}
    >
      {active ? 'Ativa' : 'Arquivada'}
    </span>
  );
}

function CategoryActions({
  category,
  busy,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: {
  category: Category;
  busy: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <ActionButton variant="secondary" className="px-3 py-1.5" disabled={busy} onClick={onEdit}>
        Editar <span className="sr-only">{category.name}</span>
      </ActionButton>
      <ActionButton
        variant="secondary"
        className="px-3 py-1.5"
        disabled={busy}
        onClick={category.isActive ? onArchive : onRestore}
      >
        {category.isActive ? 'Arquivar' : 'Reativar'} <span className="sr-only">{category.name}</span>
      </ActionButton>
      <ActionButton variant="secondary" className="px-3 py-1.5" disabled={busy} onClick={onDelete}>
        Excluir <span className="sr-only">{category.name}</span>
      </ActionButton>
    </div>
  );
}
