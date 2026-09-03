'use client';

import type { PortfolioSummary } from '@finance/contracts';
import { usePortfolioSummaryQuery } from '@/features/investments/queries';
import { INVESTMENT_TYPE_LABELS, formatMoney, formatPercent } from '@/shared/lib/format';
import { QueryBoundary } from '@/shared/ui/query-state';

/**
 * Cost-basis summary strip.
 *
 * Deliberately free of "valor atual", "rentabilidade" and "lucro": V1 has no
 * market prices, so any of those would be a number the app cannot know. The
 * proportion bars are `aria-hidden` decoration — every figure they encode is
 * also present as text in the same row.
 */
export function PortfolioSummaryStrip() {
  const summaryQuery = usePortfolioSummaryQuery();

  return (
    <QueryBoundary query={summaryQuery} loadingLabel="Carregando resumo da carteira…">
      {(summary) => <SummaryContent summary={summary} />}
    </QueryBoundary>
  );
}

function SummaryContent({ summary }: { summary: PortfolioSummary }) {
  const total = summary.totalInvested;
  const byType = [...summary.byType].sort((a, b) => b.totalInvested - a.totalInvested);

  return (
    <section aria-labelledby="resumo-carteira" className="rounded-xl border border-border bg-layer01 p-4 sm:p-5">
      <h2 id="resumo-carteira" className="text-sm font-semibold text-foreground">
        Resumo da carteira
      </h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-layer02 p-3">
          <p className="text-xs text-muted-foreground">Total investido (custo de aquisição)</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{formatMoney(total)}</p>
        </div>
        <div className="rounded-lg bg-layer02 p-3">
          <p className="text-xs text-muted-foreground">Posições registradas</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{summary.positions}</p>
        </div>
      </div>

      {byType.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhuma posição registrada ainda, então não há distribuição por tipo para mostrar.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[20rem] border-collapse text-sm">
            <caption className="sr-only">
              Distribuição do custo de aquisição por tipo de investimento, com o número de posições e a participação
              percentual de cada tipo no total investido.
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Tipo
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Posições
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Investido
                </th>
                <th scope="col" className="py-2 font-medium">
                  Participação
                </th>
              </tr>
            </thead>
            <tbody>
              {byType.map((row) => {
                const share = total > 0 ? row.totalInvested / total : 0;
                return (
                  <tr key={row.type} className="border-b border-border/60 last:border-0">
                    <th scope="row" className="py-2 pr-3 text-left font-medium text-foreground">
                      {INVESTMENT_TYPE_LABELS[row.type] ?? row.type}
                    </th>
                    <td className="py-2 pr-3 text-muted-foreground">{row.positions}</td>
                    <td className="py-2 pr-3 tabular-nums text-foreground">{formatMoney(row.totalInvested)}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="hidden h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-layer03 sm:block"
                        >
                          <span
                            className="block h-full rounded-full bg-muted-primary"
                            style={{ width: `${Math.round(share * 100)}%` }}
                          />
                        </span>
                        <span className="tabular-nums text-muted-foreground">{formatPercent(share)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
