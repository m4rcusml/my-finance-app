'use client';

import type { Account } from '@finance/contracts';
import { useState } from 'react';
import { AccountFormDialog } from '@/features/accounts/account-form-dialog';
import {
  useArchiveAccountMutation,
  useDeleteAccountMutation,
  useRestoreAccountMutation,
} from '@/features/accounts/mutations';
import { useAccountsQuery } from '@/features/accounts/queries';
import { AccountRowActions } from '@/features/accounts/row-actions';
import { ACCOUNT_TYPE_LABELS, formatMoney } from '@/shared/lib/format';
import { PageHeader } from '@/shared/ui/app-shell';
import { ConfirmDialog } from '@/shared/ui/dialog';
import { ActionButton, Field } from '@/shared/ui/form';
import { Pagination } from '@/shared/ui/pagination';
import { PaginatedBoundary } from '@/shared/ui/query-state';

type PendingAction = { kind: 'archive' | 'delete'; account: Account } | null;

export function AccountsClient() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [includeArchived, setIncludeArchived] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const query = useAccountsQuery({ page, limit, includeArchived });

  const archiveMutation = useArchiveAccountMutation();
  const restoreMutation = useRestoreAccountMutation();
  const deleteMutation = useDeleteAccountMutation();

  const busyId =
    (archiveMutation.isPending ? archiveMutation.variables : null) ??
    (restoreMutation.isPending ? restoreMutation.variables : null) ??
    (deleteMutation.isPending ? deleteMutation.variables : null) ??
    null;

  const confirmBusy = archiveMutation.isPending || deleteMutation.isPending;

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(account: Account) {
    setEditing(account);
    setFormOpen(true);
  }

  function confirmPendingAction() {
    if (!pendingAction) return;
    const { kind, account } = pendingAction;
    const mutation = kind === 'archive' ? archiveMutation : deleteMutation;
    mutation.mutate(account.id, { onSuccess: () => setPendingAction(null) });
  }

  return (
    <section>
      <PageHeader
        title="Contas"
        description="Contas bancárias, carteiras e reservas. O saldo atual é o saldo inicial mais cada receita e menos cada despesa lançada na conta."
        actions={<ActionButton onClick={openCreate}>Nova conta</ActionButton>}
      />

      <p className="mb-4 rounded-lg border border-border bg-layer01 p-3 text-sm text-muted-foreground">
        <strong className="font-medium text-foreground">Arquivar preserva o histórico</strong> e apenas remove a conta
        dos seletores de novos lançamentos. A exclusão definitiva só acontece quando não há nenhum lançamento,
        recorrência, ocorrência ou meta vinculada à conta; havendo qualquer vínculo, a conta é arquivada em vez de
        excluída.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <Field label="Incluir arquivadas">
          {({ id }) => (
            <input
              id={id}
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => {
                setIncludeArchived(e.target.checked);
                setPage(1);
              }}
              className="size-5 rounded border-border-strong bg-layer02 accent-primary"
            />
          )}
        </Field>
      </div>

      <PaginatedBoundary
        query={query}
        loadingLabel="Carregando contas…"
        emptyTitle={includeArchived ? 'Nenhuma conta cadastrada' : 'Nenhuma conta ativa'}
        emptyMessage={
          includeArchived
            ? 'Cadastre a primeira conta para começar a lançar receitas e despesas.'
            : 'Você não tem contas ativas. Marque “incluir arquivadas” para ver as arquivadas ou cadastre uma nova.'
        }
        emptyAction={<ActionButton onClick={openCreate}>Nova conta</ActionButton>}
      >
        {(accounts, meta) => (
          <div className="flex flex-col gap-4">
            {/* Table from `sm` up; stacked cards below it, so 320px still works. */}
            <div className="hidden overflow-x-auto rounded-lg border border-border bg-layer01 sm:block">
              <table className="w-full min-w-[44rem] border-collapse text-sm">
                <caption className="sr-only">
                  Contas cadastradas, com instituição, tipo, saldo inicial e saldo atual.
                </caption>
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                      Nome
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                      Instituição
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                      Tipo
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Saldo inicial
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Saldo atual
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr
                      key={account.id}
                      className={`border-b border-border last:border-0 ${account.isActive ? '' : 'bg-layer00/40 text-muted-foreground'}`}
                    >
                      <th scope="row" className="px-4 py-3 text-left font-medium">
                        <span className={account.isActive ? 'text-foreground' : 'text-muted-foreground'}>
                          {account.name}
                        </span>
                        {account.isActive ? null : <ArchivedBadge />}
                      </th>
                      <td className="px-4 py-3">{account.institution}</td>
                      <td className="px-4 py-3">{ACCOUNT_TYPE_LABELS[account.type] ?? account.type}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatMoney(account.initialBalance)}</td>
                      <td className={`px-4 py-3 text-right font-medium tabular-nums ${balanceClass(account)}`}>
                        {formatMoney(account.balance)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <AccountRowActions
                            name={account.name}
                            isActive={account.isActive}
                            busy={busyId === account.id}
                            onEdit={() => openEdit(account)}
                            onArchive={() => setPendingAction({ kind: 'archive', account })}
                            onRestore={() => restoreMutation.mutate(account.id)}
                            onDelete={() => setPendingAction({ kind: 'delete', account })}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="flex flex-col gap-3 sm:hidden">
              {accounts.map((account) => (
                <li
                  key={account.id}
                  className={`rounded-lg border border-border bg-layer01 p-4 ${account.isActive ? '' : 'text-muted-foreground'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`truncate font-medium ${account.isActive ? 'text-foreground' : ''}`}>
                        {account.name}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {account.institution} · {ACCOUNT_TYPE_LABELS[account.type] ?? account.type}
                      </p>
                      {account.isActive ? null : <ArchivedBadge />}
                    </div>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Saldo inicial</dt>
                      <dd className="tabular-nums">{formatMoney(account.initialBalance)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Saldo atual</dt>
                      <dd className={`font-medium tabular-nums ${balanceClass(account)}`}>
                        {formatMoney(account.balance)}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3 border-t border-border pt-3">
                    <AccountRowActions
                      name={account.name}
                      isActive={account.isActive}
                      busy={busyId === account.id}
                      onEdit={() => openEdit(account)}
                      onArchive={() => setPendingAction({ kind: 'archive', account })}
                      onRestore={() => restoreMutation.mutate(account.id)}
                      onDelete={() => setPendingAction({ kind: 'delete', account })}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <Pagination
              meta={meta}
              itemLabel="contas"
              onPageChange={setPage}
              onLimitChange={(next) => {
                setLimit(next);
                setPage(1);
              }}
            />
          </div>
        )}
      </PaginatedBoundary>

      <AccountFormDialog open={formOpen} account={editing} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={pendingAction?.kind === 'archive'}
        title="Arquivar conta"
        message={`“${pendingAction?.account.name ?? ''}” sai dos seletores de novos lançamentos, mas todo o histórico continua visível. Você pode reativá-la a qualquer momento.`}
        confirmLabel="Arquivar"
        busy={confirmBusy}
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmDialog
        open={pendingAction?.kind === 'delete'}
        title="Excluir conta"
        message={`“${pendingAction?.account.name ?? ''}” só será excluída definitivamente se não houver nenhum lançamento, recorrência, ocorrência ou meta vinculada. Havendo qualquer vínculo, ela será apenas arquivada.`}
        confirmLabel="Excluir"
        destructive
        busy={confirmBusy}
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />
    </section>
  );
}

function balanceClass(account: Account): string {
  if (!account.isActive) return 'text-muted-foreground';
  return account.balance < 0 ? 'text-danger-text' : 'text-foreground';
}

function ArchivedBadge() {
  return (
    <span className="ml-2 inline-block rounded-full border border-border-strong bg-layer02 px-2 py-0.5 align-middle text-xs font-medium text-warning-text">
      Arquivada
    </span>
  );
}
