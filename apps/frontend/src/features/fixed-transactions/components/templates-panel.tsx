'use client';

import type { FixedTransaction } from '@finance/contracts';
import { useState } from 'react';
import { errorMessage } from '@/shared/lib/api';
import { formatMoney, TRANSACTION_TYPE_LABELS } from '@/shared/lib/format';
import { ConfirmDialog } from '@/shared/ui/dialog';
import { ActionButton } from '@/shared/ui/form';
import { Pagination } from '@/shared/ui/pagination';
import { PaginatedBoundary } from '@/shared/ui/query-state';
import type { SourceLookups } from '../lookups';
import { useFixedTransactionMutations } from '../mutations';
import { useFixedTransactionsQuery } from '../queries';
import { ActiveBadge, Callout, RowAction, TableScroller } from './atoms';
import { TemplateDialog } from './template-dialog';

/**
 * "Modelos" — the recurring templates themselves.
 *
 * Archiving is not a delete: the template stops generating occurrences from now
 * on, and every occurrence already confirmed keeps its transaction. The UI says
 * so out loud, in the callout, in the dialog and in the confirmation.
 */

const HEADERS = [
  'Descrição',
  'Tipo',
  'Valor',
  'Dia de referência',
  'Margem',
  'Categoria',
  'Conta / Cartão',
  'Status',
] as const;

export function TemplatesPanel({ lookups }: { lookups: SourceLookups }) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [includeArchived, setIncludeArchived] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FixedTransaction | null>(null);
  const [archiving, setArchiving] = useState<FixedTransaction | null>(null);
  const [restoring, setRestoring] = useState<FixedTransaction | null>(null);

  const query = useFixedTransactionsQuery({ page, limit, includeArchived });
  const mutations = useFixedTransactionMutations();

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(template: FixedTransaction) {
    setEditing(template);
    setDialogOpen(true);
  }

  function sourceLabel(template: FixedTransaction): string {
    if (template.accountId) return `Conta · ${lookups.accountNames.get(template.accountId) ?? '—'}`;
    if (template.creditCardId) return `Cartão · ${lookups.creditCardNames.get(template.creditCardId) ?? '—'}`;
    return '—';
  }

  const archiveError = mutations.archive.isError ? errorMessage(mutations.archive.error) : null;
  const restoreError = mutations.restore.isError ? errorMessage(mutations.restore.error) : null;

  return (
    <div className="flex flex-col gap-4">
      <Callout>
        Editar ou arquivar um modelo afeta apenas as ocorrências futuras. O histórico já confirmado, e os
        lançamentos criados a partir dele, permanecem intactos.
      </Callout>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">Exibir</span>
          <select
            value={includeArchived ? 'all' : 'active'}
            onChange={(event) => {
              setIncludeArchived(event.target.value === 'all');
              setPage(1);
            }}
            className="w-full rounded-lg border border-border-strong bg-layer02 px-3 py-2 text-sm text-foreground sm:w-64"
          >
            <option value="active">Somente modelos ativos</option>
            <option value="all">Ativos e arquivados</option>
          </select>
        </label>

        <ActionButton onClick={openCreate}>Novo modelo</ActionButton>
      </div>

      <PaginatedBoundary
        query={query}
        loadingLabel="Carregando modelos…"
        emptyTitle="Nenhum modelo recorrente"
        emptyMessage={
          includeArchived
            ? 'Você ainda não cadastrou nenhum modelo. Crie um para gerar as ocorrências mensais automaticamente.'
            : 'Nenhum modelo ativo. Crie um novo, ou mude o filtro para ver os arquivados.'
        }
        emptyAction={<ActionButton onClick={openCreate}>Criar primeiro modelo</ActionButton>}
      >
        {(templates, meta) => (
          <div className="flex flex-col gap-4">
            <TableScroller label="Modelos recorrentes">
              <table className="w-full min-w-[56rem] border-collapse text-sm">
                <caption className="sr-only">
                  Modelos de transações recorrentes, com tipo, valor, dia de referência, margem, categoria, origem
                  e status.
                </caption>
                <thead>
                  <tr className="border-b border-border bg-layer01 text-left">
                    {HEADERS.map((header) => (
                      <th key={header} scope="col" className="px-3 py-2.5 font-medium text-muted-foreground">
                        {header}
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((template) => (
                    <tr key={template.id} className="border-b border-border last:border-0">
                      <th scope="row" className="px-3 py-3 text-left font-medium text-foreground">
                        {template.description?.trim() || 'Sem descrição'}
                      </th>
                      <td className="px-3 py-3">
                        <span
                          className={
                            template.type === 'income' ? 'text-success-text' : 'text-danger-text'
                          }
                        >
                          {TRANSACTION_TYPE_LABELS[template.type] ?? template.type}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-foreground">{formatMoney(template.value)}</td>
                      <td className="px-3 py-3 text-muted-foreground">Dia {template.referenceDay}</td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {template.marginDays} {template.marginDays === 1 ? 'dia' : 'dias'}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {lookups.categoryNames.get(template.categoryId) ?? (lookups.isPending ? '…' : '—')}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{sourceLabel(template)}</td>
                      <td className="px-3 py-3">
                        <ActiveBadge isActive={template.isActive} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <RowAction onClick={() => openEdit(template)}>Editar</RowAction>
                          {template.isActive ? (
                            <RowAction tone="danger" onClick={() => setArchiving(template)}>
                              Arquivar
                            </RowAction>
                          ) : (
                            <RowAction onClick={() => setRestoring(template)}>Reativar</RowAction>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroller>

            <Pagination
              meta={meta}
              itemLabel="modelos"
              onPageChange={setPage}
              onLimitChange={(next) => {
                setLimit(next);
                setPage(1);
              }}
            />
          </div>
        )}
      </PaginatedBoundary>

      <TemplateDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        template={editing}
        lookups={lookups}
        mutations={mutations}
      />

      <ConfirmDialog
        open={archiving !== null}
        destructive
        busy={mutations.archive.isPending}
        title="Arquivar modelo"
        confirmLabel="Arquivar"
        message={
          archiveError
            ? `Não foi possível arquivar: ${archiveError}`
            : `Arquivar "${archiving?.description?.trim() || 'este modelo'}" interrompe a geração de novas ocorrências. As ocorrências já confirmadas e os lançamentos criados por elas permanecem intactos.`
        }
        onCancel={() => {
          setArchiving(null);
          mutations.archive.reset();
        }}
        onConfirm={() => {
          if (!archiving) return;
          mutations.archive.mutate(archiving.id, { onSuccess: () => setArchiving(null) });
        }}
      />

      <ConfirmDialog
        open={restoring !== null}
        busy={mutations.restore.isPending}
        title="Reativar modelo"
        confirmLabel="Reativar"
        message={
          restoreError
            ? `Não foi possível reativar: ${restoreError}`
            : `Reativar "${restoring?.description?.trim() || 'este modelo'}" volta a gerar ocorrências mensais a partir de agora. Os períodos passados não são recriados.`
        }
        onCancel={() => {
          setRestoring(null);
          mutations.restore.reset();
        }}
        onConfirm={() => {
          if (!restoring) return;
          mutations.restore.mutate(restoring.id, { onSuccess: () => setRestoring(null) });
        }}
      />
    </div>
  );
}
