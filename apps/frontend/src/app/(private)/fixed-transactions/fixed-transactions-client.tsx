'use client';

import { OCCURRENCE_STATUSES, type OccurrenceStatus, type OccurrenceWithTemplate } from '@finance/contracts';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Callout, OccurrenceStatusBadge } from '@/features/fixed-transactions/components/atoms';
import { ConfirmOccurrenceDialog } from '@/features/fixed-transactions/components/confirm-occurrence-dialog';
import { TemplateDialog } from '@/features/fixed-transactions/components/template-dialog';
import { TemplatesPanel } from '@/features/fixed-transactions/components/templates-panel';
import { useSourceLookups } from '@/features/fixed-transactions/lookups';
import {
  useConfirmOccurrence,
  useFixedTransactionMutations,
  useSkipOccurrence,
} from '@/features/fixed-transactions/mutations';
import { useOccurrencesQuery } from '@/features/fixed-transactions/queries';
import { transactionsApi } from '@/shared/lib/api';
import {
  formatCivilDate,
  formatMoney,
  formatMonthLabel,
  todayCivil,
  TRANSACTION_TYPE_LABELS,
} from '@/shared/lib/format';
import { queryKeys } from '@/shared/lib/query/keys';
import { useSessionKey } from '@/shared/session/session-provider';
import { PageHeader } from '@/shared/ui/app-shell';
import { ConfirmDialog, Dialog } from '@/shared/ui/dialog';
import { ActionButton, Select, TextInput } from '@/shared/ui/form';
import { Pagination } from '@/shared/ui/pagination';
import { PaginatedBoundary, QueryBoundary } from '@/shared/ui/query-state';

type View = 'occurrences' | 'templates';

export function FixedTransactionsClient() {
  const [view, setView] = useState<View>('occurrences');
  const [creating, setCreating] = useState(false);
  const lookups = useSourceLookups();
  const mutations = useFixedTransactionMutations();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Recorrentes"
        description="Acompanhe os compromissos do mês e organize suas recorrências."
        actions={
          <ActionButton className="min-h-12 sm:min-w-52" onClick={() => setCreating(true)}>
            Nova recorrência
          </ActionButton>
        }
      />
      <fieldset aria-label="Área de recorrências" className="flex flex-wrap gap-2">
        <ActionButton
          className="rounded-full px-7"
          variant={view === 'occurrences' ? 'primary' : 'secondary'}
          aria-pressed={view === 'occurrences'}
          onClick={() => setView('occurrences')}
        >
          Ocorrências
        </ActionButton>
        <ActionButton
          className="rounded-full px-7"
          variant={view === 'templates' ? 'primary' : 'secondary'}
          aria-pressed={view === 'templates'}
          onClick={() => setView('templates')}
        >
          Modelos
        </ActionButton>
      </fieldset>
      {lookups.isError ? (
        <Callout>
          Alguns nomes de conta, cartão ou categoria não puderam ser carregados.{' '}
          <button type="button" className="underline" onClick={lookups.refetch}>
            Tentar novamente
          </button>
        </Callout>
      ) : null}
      {view === 'occurrences' ? (
        <OccurrencesPanel
          lookups={lookups}
          onCreate={() => setCreating(true)}
          onViewTemplates={() => setView('templates')}
        />
      ) : (
        <TemplatesPanel lookups={lookups} />
      )}
      <TemplateDialog
        open={creating}
        onClose={() => setCreating(false)}
        template={null}
        lookups={lookups}
        mutations={mutations}
      />
    </div>
  );
}

function OccurrencesPanel({
  lookups,
  onCreate,
  onViewTemplates,
}: {
  lookups: ReturnType<typeof useSourceLookups>;
  onCreate: () => void;
  onViewTemplates: () => void;
}) {
  const currentMonth = useMemo(() => todayCivil().slice(0, 7), []);
  const [period, setPeriod] = useState(currentMonth);
  const [wholeYear, setWholeYear] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [status, setStatus] = useState<OccurrenceStatus | ''>('');
  const [confirming, setConfirming] = useState<OccurrenceWithTemplate | null>(null);
  const [skipping, setSkipping] = useState<OccurrenceWithTemplate | null>(null);
  const [viewing, setViewing] = useState<OccurrenceWithTemplate | null>(null);
  const [year, month] = period.split('-').map(Number);
  const periodFilter = { year, month: wholeYear ? undefined : month };
  const query = useOccurrencesQuery({ ...periodFilter, page, limit, status: status || undefined });
  const pending = useOccurrencesQuery({ ...periodFilter, page: 1, limit: 1, status: 'pending' });
  const confirmed = useOccurrencesQuery({ ...periodFilter, page: 1, limit: 1, status: 'confirmed' });
  const skipped = useOccurrencesQuery({ ...periodFilter, page: 1, limit: 1, status: 'skipped' });
  const confirm = useConfirmOccurrence();
  const skip = useSkipOccurrence();

  const summary = [
    { key: 'pending', label: 'PENDENTES', note: 'Requerem decisão', query: pending, tone: 'text-muted-foreground' },
    {
      key: 'confirmed',
      label: 'CONFIRMADAS',
      note: 'Geraram lançamentos',
      query: confirmed,
      tone: 'text-success-text',
    },
    { key: 'skipped', label: 'IGNORADAS', note: 'Sem impacto no saldo', query: skipped, tone: 'text-danger-text' },
  ];

  function sourceLabel(occurrence: OccurrenceWithTemplate) {
    if (occurrence.accountId) return lookups.accountNames.get(occurrence.accountId) ?? 'Conta indisponível';
    if (occurrence.creditCardId) return lookups.creditCardNames.get(occurrence.creditCardId) ?? 'Cartão indisponível';
    return 'Origem indisponível';
  }

  return (
    <section aria-label="Ocorrências recorrentes" className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2 lg:-mt-16 lg:ml-auto lg:max-w-[65%]">
        <TextInput
          aria-label="Mês das ocorrências"
          type="month"
          value={period}
          min="1900-01"
          max="9999-12"
          className="w-auto min-w-0 flex-1 rounded-full lg:flex-none"
          onChange={(event) => {
            if (event.target.value) {
              setPeriod(event.target.value);
              setWholeYear(false);
              setPage(1);
            }
          }}
        />
        <Select
          aria-label="Status das ocorrências"
          className="w-auto rounded-full"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as OccurrenceStatus | '');
            setPage(1);
          }}
        >
          <option value="">Todos os status</option>
          {OCCURRENCE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value === 'pending' ? 'Pendentes' : value === 'confirmed' ? 'Confirmadas' : 'Ignoradas'}
            </option>
          ))}
        </Select>
        <ActionButton
          variant="secondary"
          aria-pressed={wholeYear}
          className="rounded-full"
          onClick={() => {
            setWholeYear(!wholeYear);
            setPage(1);
          }}
        >
          {wholeYear ? 'Voltar ao mês' : 'Todo o ano'}
        </ActionButton>
      </div>
      <dl className="grid gap-4 sm:grid-cols-3">
        {summary.map((metric) => (
          <div key={metric.key} className="min-w-0 rounded-2xl border border-border bg-layer02 p-5">
            <dt className="text-xs tracking-wide text-muted-foreground">{metric.label}</dt>
            <dd className="mt-2">
              <QueryBoundary query={metric.query} loadingLabel="Carregando…">
                {(result) => (
                  <p className="text-2xl font-semibold">
                    {result.meta.totalItems} {result.meta.totalItems === 1 ? 'ocorrência' : 'ocorrências'}
                  </p>
                )}
              </QueryBoundary>
            </dd>
            <dd className={`mt-2 text-xs ${metric.tone}`}>{metric.note}</dd>
          </div>
        ))}
      </dl>
      <div className="rounded-2xl border border-border bg-layer01 p-4 sm:p-6">
        <h2 className="text-[20px] font-bold">Ocorrências de {wholeYear ? year : formatMonthLabel(period)}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {query.data ? `${query.data.meta.totalItems} itens no período` : 'Acompanhe as próximas datas'}
        </p>
        <div className="mt-5">
          <PaginatedBoundary
            query={query}
            loadingLabel="Carregando ocorrências…"
            emptyTitle="Nenhuma ocorrência neste filtro"
            emptyMessage="Crie uma recorrência ou escolha outro período/status para consultar o histórico."
            emptyAction={<ActionButton onClick={onCreate}>Nova recorrência</ActionButton>}
          >
            {(occurrences, meta) => (
              <div className="flex flex-col gap-4">
                <div
                  className="hidden grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_minmax(0,1.5fr)] gap-4 rounded-lg border border-border bg-layer02/60 px-4 py-3 text-[11px] font-semibold text-muted-foreground lg:grid"
                  aria-hidden="true"
                >
                  {['RECORRÊNCIA', 'VENCIMENTO', 'VALOR', 'STATUS', 'AÇÃO'].map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
                <ul className="space-y-3">
                  {occurrences.map((occurrence) => {
                    const name =
                      occurrence.description?.trim() ||
                      occurrence.fixedTransaction.description?.trim() ||
                      'Sem descrição';
                    return (
                      <li
                        key={occurrence.id}
                        className="grid min-w-0 gap-4 rounded-xl border border-border bg-layer02/15 p-4 lg:min-h-26 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_minmax(0,1.5fr)] lg:items-center"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            aria-hidden="true"
                            className={`flex size-10 shrink-0 items-center justify-center rounded-full font-bold text-layer00 ${occurrence.status === 'confirmed' ? 'bg-success-text' : occurrence.status === 'skipped' ? 'bg-muted-foreground' : 'bg-muted-primary'}`}
                          >
                            {name.slice(0, 1).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <h3 className="break-words font-semibold">{name}</h3>
                            <p className="mt-1 break-words text-xs text-muted-foreground">
                              {occurrence.category?.name ??
                                lookups.categoryNames.get(occurrence.categoryId) ??
                                'Categoria indisponível'}{' '}
                              · {sourceLabel(occurrence)}
                            </p>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span className="mr-2 lg:hidden">Vencimento:</span>
                          {formatCivilDate(occurrence.dueDate)}
                          {occurrence.realDate ? (
                            <p className="mt-1 text-xs">Real: {formatCivilDate(occurrence.realDate)}</p>
                          ) : null}
                        </div>
                        <p className="break-words text-[18px] font-bold tabular-nums">
                          {formatMoney(occurrence.value)}
                          <span className="ml-2 text-xs font-normal text-muted-foreground lg:hidden">
                            {TRANSACTION_TYPE_LABELS[occurrence.type]}
                          </span>
                        </p>
                        <div>
                          <OccurrenceStatusBadge status={occurrence.status} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {occurrence.status === 'pending' ? (
                            <>
                              <ActionButton className="px-3 text-xs" onClick={() => setConfirming(occurrence)}>
                                Confirmar
                              </ActionButton>
                              <ActionButton
                                className="px-3 text-xs"
                                variant="secondary"
                                onClick={() => setSkipping(occurrence)}
                              >
                                Ignorar
                              </ActionButton>
                            </>
                          ) : occurrence.status === 'confirmed' && occurrence.transactionId ? (
                            <ActionButton
                              className="px-3 text-xs"
                              variant="secondary"
                              onClick={() => setViewing(occurrence)}
                            >
                              Ver lançamento
                            </ActionButton>
                          ) : (
                            <ActionButton className="px-3 text-xs" variant="secondary" onClick={onViewTemplates}>
                              Ver modelos
                            </ActionButton>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
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
        </div>
        <p className="mt-5 rounded-xl border border-border bg-primary/10 px-4 py-3 text-xs leading-relaxed text-muted-primary">
          Uma ocorrência só pode ser confirmada uma vez. Se outra sessão agir primeiro, atualizamos a lista sem duplicar
          o lançamento.
        </p>
      </div>
      <ConfirmOccurrenceDialog
        open={confirming !== null}
        occurrence={confirming}
        mutation={confirm}
        onClose={() => setConfirming(null)}
        onSkip={() => {
          setSkipping(confirming);
          setConfirming(null);
        }}
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
      <OccurrenceTransactionDialog occurrence={viewing} onClose={() => setViewing(null)} />
    </section>
  );
}

function OccurrenceTransactionDialog({
  occurrence,
  onClose,
}: {
  occurrence: OccurrenceWithTemplate | null;
  onClose: () => void;
}) {
  const session = useSessionKey();
  const transactionId = occurrence?.transactionId;
  const query = useQuery({
    queryKey: queryKeys.transactions.detail(session, transactionId ?? ''),
    queryFn: () => transactionsApi.get(transactionId ?? ''),
    enabled: Boolean(transactionId),
  });
  return (
    <Dialog
      open={Boolean(occurrence)}
      onClose={onClose}
      title="Lançamento da recorrência"
      footer={<ActionButton onClick={onClose}>Fechar</ActionButton>}
    >
      <QueryBoundary query={query}>
        {(transaction) => (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Descrição</dt>
              <dd className="mt-1 font-semibold">
                {transaction.description || occurrence?.description || 'Sem descrição'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Data real</dt>
              <dd className="mt-1">{formatCivilDate(transaction.date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Valor</dt>
              <dd className="mt-1 font-semibold">{formatMoney(transaction.value)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Tipo</dt>
              <dd className="mt-1">{TRANSACTION_TYPE_LABELS[transaction.type]}</dd>
            </div>
          </dl>
        )}
      </QueryBoundary>
    </Dialog>
  );
}
