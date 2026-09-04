'use client';
import type { DashboardOverview } from '@finance/contracts';
import { formatMoney } from '@/shared/lib/format';
import { TrendBadge } from './trend-badge';

export function TotalsCards({ totals }: { totals: DashboardOverview['totals'] }) {
  return (
    <dl className="grid items-center gap-4 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr]" aria-label="Resumo financeiro">
      <div
        className="flex min-h-44 flex-col justify-center rounded-2xl border border-border bg-layer02 p-6 sm:col-span-2 xl:col-span-1"
        data-tour="financial-overview"
      >
        <dt className="text-sm text-muted-foreground">Saldo em caixa</dt>
        <dd
          className={`mt-2 text-[2.5rem] font-semibold leading-tight tabular-nums ${totals.netBalance < 0 ? 'text-danger-text' : ''}`}
        >
          {formatMoney(totals.netBalance)}
        </dd>
        <dd className="mt-3 text-xs text-muted-foreground">Disponível nas contas · investimentos separados</dd>
      </div>
      {(['income', 'expense'] as const).map((kind) => (
        <div key={kind} className="min-h-36 rounded-2xl border border-border bg-layer02 p-5">
          <dt className="text-sm text-muted-foreground">{kind === 'income' ? 'Receitas' : 'Despesas'}</dt>
          <dd
            className={`mt-2 text-[1.75rem] font-semibold tabular-nums ${kind === 'income' ? 'text-success-text' : 'text-danger-text'}`}
          >
            {formatMoney(totals.current[kind])}
          </dd>
          <dd className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <TrendBadge trending={totals.trends[kind].trending} goodWhen={kind === 'income' ? 'up' : 'down'} />
            vs. período anterior
          </dd>
          <dd className="mt-1 text-xs text-muted-foreground">Anterior: {formatMoney(totals.previous[kind])}</dd>
        </div>
      ))}
    </dl>
  );
}
