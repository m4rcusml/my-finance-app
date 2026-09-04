'use client';

import { INVESTMENT_TYPES, type InvestmentType, type InvestmentWithAsset } from '@finance/contracts';
import Image from 'next/image';
import { useState } from 'react';
import { investmentMarker } from '@/features/investments/contribution-series';
import { useDeleteInvestmentMutation } from '@/features/investments/mutations';
import { useInvestmentsQuery, usePortfolioSummaryQuery } from '@/features/investments/queries';
import { errorMessage } from '@/shared/lib/api';
import {
  INVESTMENT_TYPE_LABELS,
  formatCivilDate,
  formatMoney,
  formatPercent,
  formatQuantity,
} from '@/shared/lib/format';
import { PageHeader } from '@/shared/ui/app-shell';
import { ConfirmDialog } from '@/shared/ui/dialog';
import { ActionButton, Field, IconButton, Select } from '@/shared/ui/form';
import { Pagination } from '@/shared/ui/pagination';
import { PaginatedBoundary } from '@/shared/ui/query-state';
import { useToast } from '@/shared/ui/toast';
import { PencilIcon, TrashIcon } from './icons';
import { InvestmentDialog } from './investment-dialog';
import { PortfolioAllocationPanel, PortfolioSummaryStrip } from './portfolio-summary';

function assetLabel(investment: InvestmentWithAsset): string {
  return investment.marketAsset?.name || investment.marketAsset?.symbol || INVESTMENT_TYPE_LABELS[investment.type];
}

export function InvestmentsClient() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [typeFilter, setTypeFilter] = useState<InvestmentType | ''>('');
  const [managing, setManaging] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InvestmentWithAsset | null>(null);
  const [pendingDelete, setPendingDelete] = useState<InvestmentWithAsset | null>(null);
  const investmentsQuery = useInvestmentsQuery({ page, limit, type: typeFilter || undefined });
  const summaryQuery = usePortfolioSummaryQuery();
  const deleteInvestment = useDeleteInvestmentMutation();

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(investment: InvestmentWithAsset) {
    setEditing(investment);
    setDialogOpen(true);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteInvestment.mutateAsync(pendingDelete.id);
      setPendingDelete(null);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <section>
      <PageHeader
        title="Investimentos"
        description="Uma carteira manual para acompanhar aportes, posições e alocação."
        actions={
          <ActionButton onClick={openCreate} className="min-h-11">
            Adicionar posição
          </ActionButton>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-border bg-primary/15 px-5 py-2 text-[13px] font-semibold text-muted-primary">
          Carteira manual
        </span>
        <p className="text-[13px] text-muted-foreground">
          Atualize suas compras e quantidades para acompanhar o custo de aquisição.
        </p>
      </div>
      <PortfolioSummaryStrip />
      <div className="mt-6 grid items-start gap-4 xl:grid-cols-2">
        <PortfolioAllocationPanel />
        <section
          aria-labelledby="lista-investimentos"
          className="min-w-0 rounded-2xl border border-border bg-layer01 p-4 sm:p-6"
        >
          <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="lista-investimentos" className="text-[21px] font-semibold">
                Posições
              </h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {investmentsQuery.data?.meta.totalItems ?? '—'} posições · atualização manual
              </p>
            </div>
            <button
              type="button"
              aria-pressed={managing}
              onClick={() => setManaging(!managing)}
              className="min-h-10 rounded-lg py-2 text-[13px] font-semibold text-muted-primary hover:text-foreground"
            >
              {managing ? 'Concluir edição' : 'Editar posições'}
            </button>
          </header>
          <div className="mb-5">
            <Field label="Filtrar por tipo">
              {({ id, describedBy }) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  value={typeFilter}
                  onChange={(event) => {
                    setTypeFilter(event.target.value as InvestmentType | '');
                    setPage(1);
                  }}
                >
                  <option value="">Todos os tipos</option>
                  {INVESTMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {INVESTMENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <PaginatedBoundary
            query={investmentsQuery}
            loadingLabel="Carregando investimentos…"
            emptyTitle={typeFilter ? 'Nenhum investimento deste tipo' : 'Nenhum investimento registrado'}
            emptyMessage={
              typeFilter
                ? 'Troque o filtro ou adicione uma nova posição.'
                : 'Adicione sua primeira compra para acompanhar aportes e alocação.'
            }
            emptyAction={<ActionButton onClick={openCreate}>Adicionar posição</ActionButton>}
          >
            {(investments, meta) => (
              <div className="space-y-4">
                <ul className="space-y-3">
                  {investments.map((investment) => {
                    const total = summaryQuery.isSuccess ? summaryQuery.data.totalInvested : null;
                    const share = total !== null && total > 0 ? investment.investedAmount / total : null;
                    return (
                      <li key={investment.id} className="overflow-hidden rounded-xl border border-border bg-layer00/20">
                        <button
                          type="button"
                          className="w-full p-4 text-left transition hover:bg-layer02/40"
                          aria-label={`Editar investimento ${assetLabel(investment)}`}
                          onClick={() => openEdit(investment)}
                        >
                          <span className="flex items-start gap-3">
                            <Image
                              src={investmentMarker(investment.type)}
                              alt=""
                              width={12}
                              height={12}
                              className="mt-1.5 size-3 shrink-0"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                                <span className="break-words text-[16px] font-semibold">{assetLabel(investment)}</span>
                                <span className="text-xs tabular-nums text-muted-foreground">
                                  Qtd. {formatQuantity(investment.quantity)}
                                </span>
                              </span>
                              <span className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                                <span className="text-xs text-muted-foreground">
                                  {INVESTMENT_TYPE_LABELS[investment.type]}
                                  {share !== null ? ` · ${formatPercent(share)} da carteira` : ''}
                                </span>
                                <span className="break-words text-[17px] font-semibold tabular-nums">
                                  {formatMoney(investment.investedAmount)}
                                </span>
                              </span>
                              <span className="mt-2 block break-words text-xs text-muted-foreground">
                                {investment.broker} · compra em {formatCivilDate(investment.buyDate)}
                              </span>
                            </span>
                          </span>
                        </button>
                        {managing ? (
                          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2">
                            <span className="text-xs text-muted-foreground">
                              Preço de compra: {formatMoney(investment.buyPrice)}
                            </span>
                            <div className="flex gap-1">
                              <IconButton
                                label={`Editar posição de ${assetLabel(investment)}`}
                                onClick={() => openEdit(investment)}
                              >
                                <PencilIcon />
                              </IconButton>
                              <IconButton
                                label={`Excluir investimento ${assetLabel(investment)}`}
                                onClick={() => setPendingDelete(investment)}
                              >
                                <TrashIcon />
                              </IconButton>
                            </div>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                <Pagination
                  meta={meta}
                  itemLabel="investimentos"
                  onPageChange={setPage}
                  onLimitChange={(next) => {
                    setLimit(next);
                    setPage(1);
                  }}
                />
              </div>
            )}
          </PaginatedBoundary>
          <aside className="mt-5 rounded-xl border border-border bg-primary/5 p-4">
            <p className="text-[13px] font-medium text-muted-primary">
              Valores não são atualizados por cotação ao vivo.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Os valores representam o custo de aquisição informado, sem estimativa de valor de mercado ou
              rentabilidade.
            </p>
          </aside>
        </section>
      </div>
      <InvestmentDialog open={dialogOpen} onClose={() => setDialogOpen(false)} investment={editing} />
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Excluir investimento"
        message={
          pendingDelete
            ? `Excluir a posição de ${assetLabel(pendingDelete)} na corretora ${pendingDelete.broker}? Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Excluir"
        destructive
        busy={deleteInvestment.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
