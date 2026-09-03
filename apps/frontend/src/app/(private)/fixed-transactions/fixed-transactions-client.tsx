'use client';

import { OCCURRENCE_STATUSES, type OccurrenceStatus, type OccurrenceWithTemplate } from '@finance/contracts';
import { useMemo, useState } from 'react';
import { ConfirmOccurrenceDialog } from '@/features/fixed-transactions/components/confirm-occurrence-dialog';
import {
  Callout,
  OccurrenceStatusBadge,
  RowAction,
  TableScroller,
} from '@/features/fixed-transactions/components/atoms';
import { TemplatesPanel } from '@/features/fixed-transactions/components/templates-panel';
import { useSourceLookups } from '@/features/fixed-transactions/lookups';
import { useConfirmOccurrence, useSkipOccurrence } from '@/features/fixed-transactions/mutations';
import { useOccurrencesQuery } from '@/features/fixed-transactions/queries';
import { formatCivilDate, formatMoney, OCCURRENCE_STATUS_LABELS, TRANSACTION_TYPE_LABELS } from '@/shared/lib/format';
import { PageHeader } from '@/shared/ui/app-shell';
import { ConfirmDialog } from '@/shared/ui/dialog';
import { Field, Select } from '@/shared/ui/form';
import { Pagination } from '@/shared/ui/pagination';
import { PaginatedBoundary } from '@/shared/ui/query-state';

type View = 'occurrences' | 'templates';

export function FixedTransactionsClient() {
  const [view, setView] = useState<View>('occurrences');
  const lookups = useSourceLookups();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Transações recorrentes"
        description="Confirme o que realmente aconteceu em cada período e mantenha os modelos mensais sem reescrever o histórico."
        actions={
          <div
            role="tablist"
            aria-label="Área de recorrências"
            className="flex rounded-lg border border-border bg-layer01 p-1"
          >
            <TabButton selected={view === 'occurrences'} onClick={() => setView('occurrences')}>
              Ocorrências
            </TabButton>
            <TabButton selected={view === 'templates'} onClick={() => setView('templates')}>
              Modelos
            </TabButton>
          </div>
        }
      />

      {lookups.isError ? (
        <Callout>
          Alguns nomes de conta, cartão ou categoria não puderam ser carregados. As recorrências continuam disponíveis.
        </Callout>
      ) : null}

      {view === 'occurrences' ? <OccurrencesPanel lookups={lookups} /> : <TemplatesPanel lookups={lookups} />}
    </div>
  );
}

function TabButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
        selected ? 'bg-layer03 text-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function OccurrencesPanel({ lookups }: { lookups: ReturnType<typeof useSourceLookups> }) {
  const now = useMemo(() => new Date(), []);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [status, setStatus] = useState<OccurrenceStatus | ''>('pending');
  const [confirming, setConfirming] = useState<OccurrenceWithTemplate | null>(null);
  const [skipping, setSkipping] = useState<OccurrenceWithTemplate | null>(null);

  const query = useOccurrencesQuery({
    page,
    limit,
    year: year ? Number(year) : undefined,
    month: month ? Number(month) : undefined,
    status: status || undefined,
  });
  const confirm = useConfirmOccurrence();
  const skip = useSkipOccurrence();

  function sourceLabel(occurrence: OccurrenceWithTemplate) {
    if (occurrence.accountId) return `Conta · ${lookups.accountNames.get(occurrence.accountId) ?? 'Não disponível'}`;
    if (occurrence.creditCardId)
      return `Cartão · ${lookups.creditCardNames.get(occurrence.creditCardId) ?? 'Não disponível'}`;
    return 'Origem não disponível';
  }

  return (
    <section aria-labelledby="ocorrencias-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="ocorrencias-heading" className="text-sm font-semibold text-foreground">
            Ocorrências
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Somente pendências podem ser confirmadas ou ignoradas.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Field label="Ano">
            {({ id, describedBy }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={year}
                onChange={(event) => {
                  setYear(event.target.value);
                  setPage(1);
                }}
                className="sm:w-28"
              >
                <option value="">Todos</option>
                {[-1, 0, 1].map((offset) => {
                  const value = now.getFullYear() + offset;
                  return (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  );
                })}
              </Select>
            )}
          </Field>
          <Field label="Mês">
            {({ id, describedBy }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={month}
                onChange={(event) => {
                  setMonth(event.target.value);
                  setPage(1);
                }}
                className="sm:w-36"
              >
                <option value="">Todos</option>
                {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value}>
                    {new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(
                      new Date(Date.UTC(2026, value - 1, 1)),
                    )}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="col-span-2">
            <Field label="Status">
              {({ id, describedBy }) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as OccurrenceStatus | '');
                    setPage(1);
                  }}
                  className="sm:w-40"
                >
                  <option value="">Todos</option>
                  {OCCURRENCE_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {OCCURRENCE_STATUS_LABELS[value]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </div>
      </div>

      <PaginatedBoundary
        query={query}
        loadingLabel="Carregando ocorrências…"
        emptyTitle="Nenhuma ocorrência neste filtro"
        emptyMessage="Troque o período/status ou cadastre um modelo recorrente."
      >
        {(occurrences, meta) => (
          <div className="flex flex-col gap-4">
            <TableScroller label="Ocorrências recorrentes">
              <table className="w-full min-w-[64rem] border-collapse text-sm">
                <caption className="sr-only">
                  Ocorrências com período, vencimento, valor, categoria, origem, status e ações.
                </caption>
                <thead>
                  <tr className="border-b border-border bg-layer01 text-left text-muted-foreground">
                    {[
                      'Descrição',
                      'Tipo',
                      'Período',
                      'Vencimento / data real',
                      'Valor',
                      'Categoria',
                      'Origem',
                      'Status',
                      'Ações',
                    ].map((label) => (
                      <th key={label} scope="col" className="px-3 py-2.5 font-medium">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {occurrences.map((occurrence) => (
                    <tr key={occurrence.id} className="border-b border-border last:border-0">
                      <th scope="row" className="px-3 py-3 text-left font-medium text-foreground">
                        {occurrence.description?.trim() ||
                          occurrence.fixedTransaction.description?.trim() ||
                          'Sem descrição'}
                      </th>
                      <td className="px-3 py-3 text-muted-foreground">{TRANSACTION_TYPE_LABELS[occurrence.type]}</td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {String(occurrence.periodMonth).padStart(2, '0')}/{occurrence.periodYear}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {formatCivilDate(occurrence.realDate ?? occurrence.dueDate)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap tabular-nums">{formatMoney(occurrence.value)}</td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {occurrence.category?.name ??
                          lookups.categoryNames.get(occurrence.categoryId) ??
                          'Sem categoria'}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{sourceLabel(occurrence)}</td>
                      <td className="px-3 py-3">
                        <OccurrenceStatusBadge status={occurrence.status} />
                      </td>
                      <td className="px-3 py-3">
                        {occurrence.status === 'pending' ? (
                          <div className="flex gap-2">
                            <RowAction onClick={() => setConfirming(occurrence)}>Confirmar</RowAction>
                            <RowAction tone="danger" onClick={() => setSkipping(occurrence)}>
                              Ignorar
                            </RowAction>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Finalizada</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroller>
            <Pagination
              meta={meta}
              itemLabel="ocorrências"
              onPageChange={setPage}
              onLimitChange={(next) => {
                setLimit(next);
                setPage(1);
              }}
            />
          </div>
        )}
      </PaginatedBoundary>

      <ConfirmOccurrenceDialog
        open={confirming !== null}
        occurrence={confirming}
        mutation={confirm}
        onClose={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={skipping !== null}
        title="Ignorar ocorrência"
        message={`Ignorar “${skipping?.description?.trim() || skipping?.fixedTransaction.description?.trim() || 'esta ocorrência'}” encerra este período sem criar uma transação.`}
        confirmLabel="Ignorar"
        destructive
        busy={skip.isPending}
        onCancel={() => setSkipping(null)}
        onConfirm={() => {
          if (skipping) skip.mutate(skipping.id, { onSuccess: () => setSkipping(null) });
        }}
      />
    </section>
  );
}
