'use client';

import type { Goal } from '@finance/contracts';
import { useState } from 'react';
import { useDeleteGoalMutation } from '@/features/goals/mutations';
import { useGoalsQuery, useGoalsSummaryQuery } from '@/features/goals/queries';
import { errorMessage } from '@/shared/lib/api';
import { formatCivilDate, formatMoney, formatPercent, GOAL_TYPE_LABELS } from '@/shared/lib/format';
import { PageHeader } from '@/shared/ui/app-shell';
import { ConfirmDialog } from '@/shared/ui/dialog';
import { ActionButton, IconButton } from '@/shared/ui/form';
import { Pagination } from '@/shared/ui/pagination';
import { PaginatedBoundary, QueryBoundary } from '@/shared/ui/query-state';
import { useToast } from '@/shared/ui/toast';
import { GoalAmountDialog } from './goal-amount-dialog';
import { GoalDialog } from './goal-dialog';

export function GoalsClient() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [amountGoal, setAmountGoal] = useState<Goal | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Goal | null>(null);
  const goalsQuery = useGoalsQuery({ page, limit });
  const summaryQuery = useGoalsSummaryQuery();
  const deleteGoal = useDeleteGoalMutation();

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteGoal.mutateAsync(pendingDelete.id);
      setPendingDelete(null);
      if (goalsQuery.data?.data.length === 1 && page > 1) setPage(page - 1);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Metas"
        description="Planeje objetivos e registre o progresso no seu próprio ritmo."
        actions={
          <ActionButton className="min-h-12 sm:min-w-44" onClick={openCreate}>
            Nova meta
          </ActionButton>
        }
      />
      <p className="rounded-xl border border-border bg-primary/10 px-4 py-3 text-sm text-muted-primary">
        Progresso manual: as metas não movimentam saldos nem criam transações automaticamente.
      </p>
      <QueryBoundary query={summaryQuery} loadingLabel="Carregando resumo das metas…">
        {(goals) => {
          const active = goals.filter((goal) => goal.progress < 1).length;
          const average = goals.length ? goals.reduce((sum, goal) => sum + goal.progress, 0) / goals.length : 0;
          const total = goals.reduce((sum, goal) => sum + Math.round(goal.targetAmount * 100), 0) / 100;
          return (
            <dl className="grid gap-4 sm:grid-cols-3">
              <GoalMetric
                label="METAS ATIVAS"
                value={`${active} ${active === 1 ? 'objetivo' : 'objetivos'}`}
                note={`${goals.length - active} concluídas`}
              />
              <GoalMetric
                label="PROGRESSO MÉDIO"
                value={formatPercent(average)}
                note="Atualizado manualmente"
                positive
              />
              <GoalMetric label="TOTAL PLANEJADO" value={formatMoney(total)} note="Sem impacto no caixa" />
            </dl>
          );
        }}
      </QueryBoundary>
      <PaginatedBoundary
        query={goalsQuery}
        loadingLabel="Carregando metas…"
        emptyTitle="Nenhuma meta cadastrada"
        emptyMessage="Crie uma meta e registre quanto já guardou para alcançar seu objetivo."
        emptyAction={<ActionButton onClick={openCreate}>Criar primeira meta</ActionButton>}
      >
        {(goals, meta) => (
          <div className="flex flex-col gap-4">
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onEdit={() => {
                    setEditing(goal);
                    setDialogOpen(true);
                  }}
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

function GoalMetric({
  label,
  value,
  note,
  positive = false,
}: {
  label: string;
  value: string;
  note: string;
  positive?: boolean;
}) {
  return (
    <div className="flex min-h-30 min-w-0 flex-col gap-2 rounded-2xl border border-border bg-layer02 p-5">
      <dt className="text-xs tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-words text-2xl font-semibold tabular-nums">{value}</dd>
      <dd className={`text-xs ${positive ? 'text-success-text' : 'text-muted-foreground'}`}>{note}</dd>
    </div>
  );
}

function GoalCard({
  goal,
  onEdit,
  onUpdateAmount,
  onDelete,
}: {
  goal: Goal;
  onEdit: () => void;
  onUpdateAmount: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const progress = Math.min(100, Math.max(0, Math.round(goal.progress * 1000) / 10));
  const colors =
    goal.type === 'debt_payoff'
      ? 'bg-success-text'
      : goal.type === 'spending_limit'
        ? 'bg-[#60a5fa]'
        : 'bg-muted-primary';
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  return (
    <li className="flex min-w-0 flex-col rounded-2xl border border-border bg-layer01 p-5 sm:min-h-[610px] sm:p-6">
      <div className="relative flex items-center justify-between gap-3">
        <span className="rounded-full border border-border bg-primary/10 px-5 py-2 text-xs font-semibold text-muted-primary">
          {GOAL_TYPE_LABELS[goal.type]}
        </span>
        <IconButton
          label={`Opções da meta ${goal.name}`}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setMenuOpen(false);
          }}
        >
          •••
        </IconButton>
        {menuOpen ? (
          <div className="absolute right-0 top-12 z-10 rounded-xl border border-border bg-layer02 p-2 shadow-xl">
            <ActionButton variant="ghost" className="text-danger-text" onClick={onDelete}>
              Excluir meta
            </ActionButton>
          </div>
        ) : null}
      </div>
      <h2 className="mt-6 break-words text-[20px] font-bold">{goal.name}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {goal.deadline ? `Prazo: ${formatCivilDate(goal.deadline)}` : 'Sem prazo definido'}
      </p>
      <div className="mt-9">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">Progresso atual</span>
          <strong className="text-[20px] tabular-nums">{formatPercent(goal.progress)}</strong>
        </div>
        <div
          role="progressbar"
          aria-label={`Progresso manual da meta ${goal.name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="mt-4 h-3 overflow-hidden rounded-full bg-layer03"
        >
          <span className={`block h-full rounded-full ${colors}`} style={{ width: `${progress}%` }} />
        </div>
      </div>
      <dl className="mt-7 grid grid-cols-2 gap-3 rounded-xl border border-border bg-layer02/25 p-4 sm:min-h-30">
        <div className="min-w-0">
          <dt className="text-[11px] text-muted-foreground">GUARDADO</dt>
          <dd className="mt-3 break-words text-[18px] font-bold tabular-nums">{formatMoney(goal.currentAmount)}</dd>
        </div>
        <div className="min-w-0 text-right">
          <dt className="text-[11px] text-muted-foreground">OBJETIVO</dt>
          <dd className="mt-3 break-words text-[18px] font-bold tabular-nums">{formatMoney(goal.targetAmount)}</dd>
        </div>
      </dl>
      <p className="mt-6 text-sm text-muted-foreground">
        {remaining > 0 ? `Faltam ${formatMoney(remaining)} para concluir` : 'Objetivo alcançado!'}
      </p>
      <div className="mt-auto flex flex-col gap-3 pt-8">
        <ActionButton className="min-h-12 w-full" onClick={onUpdateAmount}>
          Atualizar progresso
        </ActionButton>
        <ActionButton variant="secondary" className="min-h-11 w-full" onClick={onEdit}>
          Editar meta
        </ActionButton>
      </div>
      <p className="mt-8 text-center text-xs text-muted-foreground">Registro manual · não altera contas</p>
    </li>
  );
}
