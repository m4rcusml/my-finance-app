'use client';

import type { CreditCard } from '@finance/contracts';
import { useState } from 'react';
import { CreditCardFormDialog } from '@/features/credit-cards/credit-card-form-dialog';
import {
  useArchiveCreditCardMutation,
  useDeleteCreditCardMutation,
  useRestoreCreditCardMutation,
} from '@/features/credit-cards/mutations';
import { useCreditCardsQuery } from '@/features/credit-cards/queries';
import { CreditCardRowActions } from '@/features/credit-cards/row-actions';
import { formatCivilDate, formatMoney } from '@/shared/lib/format';
import { PageHeader } from '@/shared/ui/app-shell';
import { ConfirmDialog } from '@/shared/ui/dialog';
import { ActionButton, Field } from '@/shared/ui/form';
import { Pagination } from '@/shared/ui/pagination';
import { PaginatedBoundary } from '@/shared/ui/query-state';

type PendingAction = { kind: 'archive' | 'delete'; creditCard: CreditCard } | null;

export function CreditCardsClient({ embedded = false }: { embedded?: boolean }) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CreditCard | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const query = useCreditCardsQuery({ page, limit, includeArchived });
  const archiveMutation = useArchiveCreditCardMutation();
  const restoreMutation = useRestoreCreditCardMutation();
  const deleteMutation = useDeleteCreditCardMutation();

  const busyId =
    (archiveMutation.isPending ? archiveMutation.variables : null) ??
    (restoreMutation.isPending ? restoreMutation.variables : null) ??
    (deleteMutation.isPending ? deleteMutation.variables : null) ??
    null;

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(creditCard: CreditCard) {
    setEditing(creditCard);
    setFormOpen(true);
  }

  function confirmPendingAction() {
    if (!pendingAction) return;
    const mutation = pendingAction.kind === 'archive' ? archiveMutation : deleteMutation;
    mutation.mutate(pendingAction.creditCard.id, { onSuccess: () => setPendingAction(null) });
  }

  return (
    <section>
      {embedded ? (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Seus cartões</h2>
            <p className="mt-1 text-sm text-muted-foreground">Limite, uso e datas do ciclo vigente.</p>
          </div>
          <ActionButton onClick={openCreate}>Novo cartão</ActionButton>
        </div>
      ) : (
        <PageHeader
          title="Cartões de crédito"
          description="Acompanhe o limite e apenas os gastos do ciclo aberto de cada cartão."
          actions={<ActionButton onClick={openCreate}>Novo cartão</ActionButton>}
        />
      )}

      <div className="mb-4 rounded-xl border border-border bg-layer01 p-4">
        <Field label="Incluir arquivados">
          {({ id }) => (
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
          )}
        </Field>
      </div>

      <PaginatedBoundary
        query={query}
        loadingLabel="Carregando cartões…"
        emptyTitle={includeArchived ? 'Nenhum cartão cadastrado' : 'Nenhum cartão ativo'}
        emptyMessage="Adicione um cartão para acompanhar o uso do ciclo e o limite disponível."
        emptyAction={<ActionButton onClick={openCreate}>Novo cartão</ActionButton>}
      >
        {(creditCards, meta) => (
          <div className="flex flex-col gap-4">
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {creditCards.map((card) => (
                <li key={card.id} className="rounded-2xl border border-border bg-layer01 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">
                        {card.institution}
                      </p>
                      <h2 className="mt-1 truncate text-lg font-semibold text-foreground">{card.name}</h2>
                    </div>
                    <StatusBadge active={card.isActive} />
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Usado no ciclo</dt>
                      <dd className="font-semibold tabular-nums text-foreground">
                        {formatMoney(card.cycleUsedAmount)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Disponível</dt>
                      <dd
                        className={`font-semibold tabular-nums ${card.availableAmount < 0 ? 'text-danger-text' : 'text-success-text'}`}
                      >
                        {formatMoney(card.availableAmount)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Limite total</dt>
                      <dd className="tabular-nums text-foreground">{formatMoney(card.limitTotal)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Fechamento</dt>
                      <dd className="text-foreground">{card.closingDay ? `Dia ${card.closingDay}` : 'Mês civil'}</dd>
                    </div>
                  </dl>

                  <div className="mt-4">
                    <div className="h-2 overflow-hidden rounded-full bg-layer02" aria-hidden="true">
                      <div
                        className={`h-full rounded-full ${card.cycleUsedAmount > card.limitTotal ? 'bg-danger' : 'bg-primary'}`}
                        style={{ width: `${usagePercent(card)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Ciclo de {formatCivilDate(card.currentCycle.start)} a {formatCivilDate(card.currentCycle.end)}.
                    </p>
                  </div>

                  <div className="mt-4 border-t border-border pt-3">
                    <CreditCardRowActions
                      name={card.name}
                      isActive={card.isActive}
                      busy={busyId === card.id}
                      onEdit={() => openEdit(card)}
                      onArchive={() => setPendingAction({ kind: 'archive', creditCard: card })}
                      onRestore={() => restoreMutation.mutate(card.id)}
                      onDelete={() => setPendingAction({ kind: 'delete', creditCard: card })}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <Pagination
              meta={meta}
              itemLabel="cartões"
              onPageChange={setPage}
              onLimitChange={(next) => {
                setLimit(next);
                setPage(1);
              }}
            />
          </div>
        )}
      </PaginatedBoundary>

      <CreditCardFormDialog open={formOpen} creditCard={editing} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={pendingAction?.kind === 'archive'}
        title="Arquivar cartão"
        message={`“${pendingAction?.creditCard.name ?? ''}” sairá dos novos lançamentos, mas o histórico continuará visível.`}
        confirmLabel="Arquivar"
        busy={archiveMutation.isPending}
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmDialog
        open={pendingAction?.kind === 'delete'}
        title="Excluir cartão"
        message={`“${pendingAction?.creditCard.name ?? ''}” só será removido definitivamente se não possuir vínculos; caso contrário, será arquivado.`}
        confirmLabel="Excluir"
        destructive
        busy={deleteMutation.isPending}
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />
    </section>
  );
}

function usagePercent(card: CreditCard): number {
  if (card.limitTotal <= 0) return card.cycleUsedAmount > 0 ? 100 : 0;
  return Math.max(0, Math.min((card.cycleUsedAmount / card.limitTotal) * 100, 100));
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${active ? 'border-success/60 text-success-text' : 'border-border-strong text-warning-text'}`}
    >
      {active ? 'Ativo' : 'Arquivado'}
    </span>
  );
}
