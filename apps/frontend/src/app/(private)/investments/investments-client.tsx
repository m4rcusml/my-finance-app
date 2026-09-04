'use client';

import { INVESTMENT_TYPES, type InvestmentType, type InvestmentWithAsset } from '@finance/contracts';
import { useState } from 'react';
import { useDeleteInvestmentMutation } from '@/features/investments/mutations';
import { useInvestmentsQuery } from '@/features/investments/queries';
import { errorMessage } from '@/shared/lib/api';
import { INVESTMENT_TYPE_LABELS, formatCivilDate, formatMoney, formatQuantity } from '@/shared/lib/format';
import { PageHeader } from '@/shared/ui/app-shell';
import { ConfirmDialog } from '@/shared/ui/dialog';
import { ActionButton, Field, IconButton, Select } from '@/shared/ui/form';
import { Pagination } from '@/shared/ui/pagination';
import { PaginatedBoundary } from '@/shared/ui/query-state';
import { useToast } from '@/shared/ui/toast';
import { PencilIcon, TrashIcon } from './icons';
import { InvestmentDialog } from './investment-dialog';
import { PortfolioSummaryStrip } from './portfolio-summary';

/** Label for the asset column: symbol first, name only when the API sent one. */
function assetLabel(investment: InvestmentWithAsset): { primary: string; secondary: string | null } {
  const asset = investment.marketAsset;
  if (!asset) return { primary: 'Sem ativo vinculado', secondary: null };
  return { primary: asset.symbol, secondary: asset.name };
}

export function InvestmentsClient() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [typeFilter, setTypeFilter] = useState<InvestmentType | ''>('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InvestmentWithAsset | null>(null);
  const [pendingDelete, setPendingDelete] = useState<InvestmentWithAsset | null>(null);

  const investmentsQuery = useInvestmentsQuery({
    page,
    limit,
    type: typeFilter === '' ? undefined : typeFilter,
  });
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
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Patrimônio"
        title="Investimentos"
        description="Registre sua carteira manualmente e acompanhe com clareza o custo de aquisição."
        actions={<ActionButton onClick={openCreate}>Novo investimento</ActionButton>}
      />

      <CostBasisNotice />

      <PortfolioSummaryStrip />

      <section aria-labelledby="lista-investimentos" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="lista-investimentos" className="text-sm font-semibold text-foreground">
            Posições registradas
          </h2>
          <div className="sm:w-56">
            <Field label="Filtrar por tipo">
              {({ id, describedBy }) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value as InvestmentType | '');
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
        </div>

        <PaginatedBoundary
          query={investmentsQuery}
          loadingLabel="Carregando investimentos…"
          emptyTitle={typeFilter === '' ? 'Nenhum investimento registrado' : 'Nenhum investimento deste tipo'}
          emptyMessage={
            typeFilter === ''
              ? 'Registre uma compra para começar a acompanhar quanto você já investiu.'
              : 'Nenhuma posição corresponde ao tipo selecionado. Troque o filtro ou registre uma nova compra.'
          }
          emptyAction={<ActionButton onClick={openCreate}>Novo investimento</ActionButton>}
        >
          {(investments, meta) => (
            <div className="flex flex-col gap-4">
              <InvestmentTable investments={investments} onEdit={openEdit} onDelete={setPendingDelete} />
              <InvestmentCards investments={investments} onEdit={openEdit} onDelete={setPendingDelete} />
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
      </section>

      <InvestmentDialog open={dialogOpen} onClose={() => setDialogOpen(false)} investment={editing} />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Excluir investimento"
        message={
          pendingDelete
            ? `Excluir a posição de ${assetLabel(pendingDelete).primary} na corretora ${pendingDelete.broker}? Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Excluir"
        destructive
        busy={deleteInvestment.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

/**
 * The honesty banner. It is not a footnote: without it the "total investido"
 * figure reads like a portfolio valuation, which it is not.
 */
function CostBasisNotice() {
  return (
    <aside aria-labelledby="aviso-cotacoes" className="rounded-xl border border-warning/60 bg-layer01 p-4 sm:p-5">
      <h2 id="aviso-cotacoes" className="text-sm font-semibold text-warning-text">
        Esta carteira não tem cotações
      </h2>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Todos os valores desta página são o{' '}
        <strong className="text-foreground">custo de aquisição que você informou</strong> — quanto você pagou, na data
        em que pagou. O app não consulta preços de mercado nesta versão, então ele não sabe e não mostra valor atual,
        rentabilidade nem lucro. Para saber quanto sua carteira vale hoje, consulte sua corretora.
      </p>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

interface RowActionsProps {
  onEdit: (investment: InvestmentWithAsset) => void;
  onDelete: (investment: InvestmentWithAsset) => void;
}

function RowActions({ investment, onEdit, onDelete }: RowActionsProps & { investment: InvestmentWithAsset }) {
  const label = assetLabel(investment).primary;
  return (
    <div className="flex items-center gap-1">
      <IconButton label={`Editar investimento ${label}`} onClick={() => onEdit(investment)}>
        <PencilIcon />
      </IconButton>
      <IconButton label={`Excluir investimento ${label}`} onClick={() => onDelete(investment)}>
        <TrashIcon />
      </IconButton>
    </div>
  );
}

/** Wide layout. Scrolls horizontally rather than squeezing eight columns. */
function InvestmentTable({ investments, onEdit, onDelete }: RowActionsProps & { investments: InvestmentWithAsset[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-xl border border-border bg-layer01 md:block">
      <table className="w-full min-w-[52rem] border-collapse text-sm">
        <caption className="sr-only">
          Investimentos registrados manualmente, com ativo, corretora, tipo, quantidade, preço de compra, valor
          investido e data da compra. Os valores são custo de aquisição, não valor de mercado.
        </caption>
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="p-3 font-medium">
              Ativo
            </th>
            <th scope="col" className="p-3 font-medium">
              Corretora
            </th>
            <th scope="col" className="p-3 font-medium">
              Tipo
            </th>
            <th scope="col" className="p-3 text-right font-medium">
              Quantidade
            </th>
            <th scope="col" className="p-3 text-right font-medium">
              Preço de compra
            </th>
            <th scope="col" className="p-3 text-right font-medium">
              Valor investido
            </th>
            <th scope="col" className="p-3 font-medium">
              Data da compra
            </th>
            <th scope="col" className="p-3 text-right font-medium">
              Ações
            </th>
          </tr>
        </thead>
        <tbody>
          {investments.map((investment) => {
            const { primary, secondary } = assetLabel(investment);
            return (
              <tr key={investment.id} className="border-b border-border/60 last:border-0">
                <th scope="row" className="p-3 text-left font-medium text-foreground">
                  <span className="block">{primary}</span>
                  {secondary ? <span className="block text-xs text-muted-foreground">{secondary}</span> : null}
                </th>
                <td className="p-3 text-muted-foreground">{investment.broker}</td>
                <td className="p-3 text-muted-foreground">
                  {INVESTMENT_TYPE_LABELS[investment.type] ?? investment.type}
                </td>
                <td className="p-3 text-right tabular-nums text-muted-foreground">
                  {formatQuantity(investment.quantity)}
                </td>
                <td className="p-3 text-right tabular-nums text-muted-foreground">
                  {formatMoney(investment.buyPrice)}
                </td>
                <td className="p-3 text-right tabular-nums font-medium text-foreground">
                  {formatMoney(investment.investedAmount)}
                </td>
                <td className="p-3 text-muted-foreground">{formatCivilDate(investment.buyDate)}</td>
                <td className="p-3">
                  <div className="flex justify-end">
                    <RowActions investment={investment} onEdit={onEdit} onDelete={onDelete} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Narrow layout (down to 320px): one card per position, no horizontal scroll. */
function InvestmentCards({ investments, onEdit, onDelete }: RowActionsProps & { investments: InvestmentWithAsset[] }) {
  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {investments.map((investment) => {
        const { primary, secondary } = assetLabel(investment);
        return (
          <li key={investment.id} className="rounded-xl border border-border bg-layer01 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{primary}</p>
                {secondary ? <p className="truncate text-xs text-muted-foreground">{secondary}</p> : null}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {INVESTMENT_TYPE_LABELS[investment.type] ?? investment.type} · {investment.broker}
                </p>
              </div>
              <RowActions investment={investment} onEdit={onEdit} onDelete={onDelete} />
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Quantidade</dt>
                <dd className="tabular-nums text-foreground">{formatQuantity(investment.quantity)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Preço de compra</dt>
                <dd className="tabular-nums text-foreground">{formatMoney(investment.buyPrice)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Valor investido</dt>
                <dd className="tabular-nums font-medium text-foreground">{formatMoney(investment.investedAmount)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Data da compra</dt>
                <dd className="text-foreground">{formatCivilDate(investment.buyDate)}</dd>
              </div>
            </dl>
          </li>
        );
      })}
    </ul>
  );
}
