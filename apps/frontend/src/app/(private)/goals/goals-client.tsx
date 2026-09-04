'use client';

import type { Account, Category, Goal } from '@finance/contracts';
import { useState } from 'react';
import { useDeleteGoalMutation } from '@/features/goals/mutations';
import { useGoalAccountOptionsQuery, useGoalCategoryOptionsQuery, useGoalsQuery } from '@/features/goals/queries';
import { errorMessage } from '@/shared/lib/api';
import { formatCivilDate, formatMoney, formatPercent, GOAL_TYPE_LABELS } from '@/shared/lib/format';
import { PageHeader } from '@/shared/ui/app-shell';
import { ConfirmDialog } from '@/shared/ui/dialog';
import { ActionButton, IconButton } from '@/shared/ui/form';
import { Pagination } from '@/shared/ui/pagination';
import { PaginatedBoundary } from '@/shared/ui/query-state';
import { useToast } from '@/shared/ui/toast';
import { GoalAmountDialog } from './goal-amount-dialog';
import { GoalDialog } from './goal-dialog';
import { PencilIcon, TrashIcon } from './icons';

export function GoalsClient() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [amountGoal, setAmountGoal] = useState<Goal | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Goal | null>(null);

  const goalsQuery = useGoalsQuery({ page, limit });
  const categoriesQuery = useGoalCategoryOptionsQuery();
  const accountsQuery = useGoalAccountOptionsQuery();
  const deleteGoal = useDeleteGoalMutation();

  const categoryNames = namesById(categoriesQuery.data?.data ?? []);
  const accountNames = namesById(accountsQuery.data?.data ?? []);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(goal: Goal) {
    setEditing(goal);
    setDialogOpen(true);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteGoal.mutateAsync(pendingDelete.id);
      setPendingDelete(null);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Patrimônio"
        title="Metas"
        description="Transforme planos em objetivos claros e atualize o progresso no seu ritmo."
        actions={<ActionButton onClick={openCreate}>Nova meta</ActionButton>}
      />

      <aside className="rounded-2xl border border-border bg-layer01 p-4 sm:p-5" aria-labelledby="progresso-manual">
        <h2 id="progresso-manual" className="text-sm font-semibold text-foreground">
          Progresso manual
        </h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Os valores desta tela são informados por você. Nesta versão, contas, categorias e transações servem apenas
          como referências e nunca alteram uma meta automaticamente.
        </p>
      </aside>

      <PaginatedBoundary
        query={goalsQuery}
        loadingLabel="Carregando metas…"
        emptyTitle="Nenhuma meta cadastrada"
        emptyMessage="Crie uma meta e atualize o valor realizado conforme seu avanço."
        emptyAction={<ActionButton onClick={openCreate}>Criar primeira meta</ActionButton>}
      >
        {(goals, meta) => (
          <div className="flex flex-col gap-4">
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  categoryName={relationLabel(goal.relatedCategoryId, categoryNames)}
                  accountName={relationLabel(goal.relatedAccountId, accountNames)}
                  onEdit={() => openEdit(goal)}
                  onUpdateAmount={() => setAmountGoal(goal)}
                  onDelete={() => setPendingDelete(goal)}
                />
              ))}
            </ul>

            <Pagination
              meta={meta}
              itemLabel="metas"
              onPageChange={setPage}
              onLimitChange={(next) => {
                setLimit(next);
                setPage(1);
              }}
            />
          </div>
        )}
      </PaginatedBoundary>

      <GoalDialog open={dialogOpen} onClose={() => setDialogOpen(false)} goal={editing} />
      <GoalAmountDialog goal={amountGoal} onClose={() => setAmountGoal(null)} />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Excluir meta"
        message={pendingDelete ? `Excluir a meta “${pendingDelete.name}”? Esta ação não pode ser desfeita.` : ''}
        confirmLabel="Excluir"
        destructive
        busy={deleteGoal.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function namesById(items: Array<Account | Category>): Map<string, string> {
  return new Map(items.map((item) => [item.id, item.name]));
}

function relationLabel(id: string | null, names: Map<string, string>): string | null {
  if (!id) return null;
  return names.get(id) ?? 'Referência indisponível';
}

function GoalCard({
  goal,
  categoryName,
  accountName,
  onEdit,
  onUpdateAmount,
  onDelete,
}: {
  goal: Goal;
  categoryName: string | null;
  accountName: string | null;
  onEdit: () => void;
  onUpdateAmount: () => void;
  onDelete: () => void;
}) {
  const progressPercent = Math.round(goal.progress * 1000) / 10;

  return (
    <li className="flex min-w-0 flex-col rounded-xl border border-border bg-layer01 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{goal.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {GOAL_TYPE_LABELS[goal.type] ?? goal.type} · progresso manual
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <IconButton label={`Editar meta ${goal.name}`} onClick={onEdit}>
            <PencilIcon />
          </IconButton>
          <IconButton label={`Excluir meta ${goal.name}`} onClick={onDelete}>
            <TrashIcon />
          </IconButton>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-end justify-between gap-3">
          <p className="text-lg font-semibold tabular-nums text-foreground">{formatMoney(goal.currentAmount)}</p>
          <p className="text-sm tabular-nums text-muted-foreground">de {formatMoney(goal.targetAmount)}</p>
        </div>
        <div
          role="progressbar"
          aria-label={`Progresso manual da meta ${goal.name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
          className="mt-2 h-2 overflow-hidden rounded-full bg-layer03"
        >
          <span className="block h-full rounded-full bg-primary" style={{ width: `${progressPercent}%` }} />
        </div>
        <p className="mt-1 text-right text-xs font-medium text-muted-foreground">{formatPercent(goal.progress)}</p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-4 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Prazo</dt>
          <dd className="text-foreground">{goal.deadline ? formatCivilDate(goal.deadline) : 'Sem prazo'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Fonte</dt>
          <dd className="text-foreground">Informado por você</dd>
        </div>
        {categoryName ? (
          <div>
            <dt className="text-xs text-muted-foreground">Categoria</dt>
            <dd className="truncate text-foreground" title={categoryName}>
              {categoryName}
            </dd>
          </div>
        ) : null}
        {accountName ? (
          <div>
            <dt className="text-xs text-muted-foreground">Conta</dt>
            <dd className="truncate text-foreground" title={accountName}>
              {accountName}
            </dd>
          </div>
        ) : null}
      </dl>

      <ActionButton variant="secondary" className="mt-4 w-full" onClick={onUpdateAmount}>
        Atualizar valor atual
      </ActionButton>
    </li>
  );
}
