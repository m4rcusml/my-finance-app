'use client';

import { buildContributionSeries, INVESTMENT_COLORS } from '@/features/investments/contribution-series';
import { useContributionInvestmentsQuery, usePortfolioSummaryQuery } from '@/features/investments/queries';
import { INVESTMENT_TYPE_LABELS, formatMoney, formatMonthShort, formatPercent, todayCivil } from '@/shared/lib/format';
import { QueryBoundary } from '@/shared/ui/query-state';

export function PortfolioSummaryStrip() {
  const summaryQuery = usePortfolioSummaryQuery();
  return (
    <QueryBoundary query={summaryQuery} loadingLabel="Carregando resumo da carteira…">
      {(summary) => (
        <dl className="grid gap-4 sm:grid-cols-3">
          <Metric label="Total aportado" value={formatMoney(summary.totalInvested)} detail="Base de custo manual" />
          <Metric label="Posições registradas" value={String(summary.positions)} detail="Compras informadas por você" />
          <Metric
            label="Tipos de investimento"
            value={String(summary.byType.length)}
            detail="Distribuição da carteira"
          />
        </dl>
      )}
    </QueryBoundary>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-layer02 p-5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-2 break-words text-[24px] font-semibold tabular-nums">{value}</dd>
      <dd className="mt-2 text-xs text-muted-foreground">{detail}</dd>
    </div>
  );
}

export function PortfolioAllocationPanel() {
  const summaryQuery = usePortfolioSummaryQuery();
  return (
    <section
      className="min-w-0 rounded-2xl border border-border bg-layer01 p-4 sm:p-6"
      aria-labelledby="portfolio-allocation-title"
    >
      <h2 id="portfolio-allocation-title" className="text-[21px] font-semibold">
        Alocação da carteira
      </h2>
      <p className="mt-1 text-[13px] text-muted-foreground">Distribuição sobre o custo de aquisição informado</p>
      <div className="mt-8">
        <QueryBoundary query={summaryQuery} loadingLabel="Carregando alocação…">
          {(summary) =>
            summary.byType.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-5 text-[13px] text-muted-foreground">
                Adicione uma posição para visualizar a distribuição da sua carteira.
              </p>
            ) : (
              <ul className="space-y-7">
                {[...summary.byType]
                  .sort((a, b) => b.totalInvested - a.totalInvested)
                  .map((row) => {
                    const share = summary.totalInvested > 0 ? row.totalInvested / summary.totalInvested : 0;
                    return (
                      <li key={row.type}>
                        <div className="flex items-center justify-between gap-3 text-[14px]">
                          <span className="text-muted-foreground">{INVESTMENT_TYPE_LABELS[row.type]}</span>
                          <span className="font-semibold tabular-nums">{formatPercent(share)}</span>
                        </div>
                        <div aria-hidden="true" className="mt-3 h-2.5 overflow-hidden rounded-full bg-layer02">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, Math.max(0, share * 100))}%`,
                              backgroundColor: INVESTMENT_COLORS[row.type],
                            }}
                          />
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {formatMoney(row.totalInvested)} · {row.positions} posições
                        </p>
                      </li>
                    );
                  })}
              </ul>
            )
          }
        </QueryBoundary>
      </div>
      <ContributionHistory />
    </section>
  );
}

function ContributionHistory() {
  const query = useContributionInvestmentsQuery();
  return (
    <section
      className="mt-8 rounded-xl border border-border bg-layer00/20 p-4"
      aria-labelledby="contribution-history-title"
    >
      <h3 id="contribution-history-title" className="text-[17px] font-semibold">
        Histórico de aportes
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">Últimos 6 meses · datas das compras registradas</p>
      <div className="mt-5">
        <QueryBoundary query={query} loadingLabel="Carregando histórico de aportes…">
          {(investments) => {
            const series = buildContributionSeries(investments, todayCivil());
            const max = Math.max(1, ...series.map((point) => point.amount));
            const hasContributions = series.some((point) => point.amount > 0);
            return (
              <>
                <div aria-hidden="true" className="grid h-36 grid-cols-6 items-end gap-2 sm:gap-4">
                  {series.map((point, index) => (
                    <div key={point.month} className="flex h-full min-w-0 flex-col justify-end gap-2 text-center">
                      <div
                        className={`mx-auto w-full max-w-12 rounded-t-md ${index === 5 ? 'bg-muted-primary' : 'bg-layer03'}`}
                        style={{ height: `${point.amount > 0 ? Math.max(3, (point.amount / max) * 108) : 2}px` }}
                        title={formatMoney(point.amount)}
                      />
                      <span className="text-[10px] text-muted-foreground">{formatMonthShort(point.month)}</span>
                    </div>
                  ))}
                </div>
                <div className="sr-only">
                  <table>
                    <caption>Aportes registrados nos últimos seis meses</caption>
                    <thead>
                      <tr>
                        <th scope="col">Mês</th>
                        <th scope="col">Aportes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {series.map((point) => (
                        <tr key={point.month}>
                          <th scope="row">{formatMonthShort(point.month)}</th>
                          <td>{formatMoney(point.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!hasContributions ? (
                  <p className="mt-4 text-xs text-muted-foreground">Nenhum aporte registrado neste período.</p>
                ) : null}
              </>
            );
          }}
        </QueryBoundary>
      </div>
    </section>
  );
}
