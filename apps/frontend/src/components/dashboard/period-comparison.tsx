'use client';

import type { DashboardOverview } from '@finance/contracts';
import { formatMoney } from '@/shared/lib/format';
import { DashboardSection } from './dashboard-section';
import { StatCard } from './stat-card';
import { TrendBadge } from './trend-badge';

type Totals = DashboardOverview['totals'];

/**
 * Receitas, despesas and net for the selected window, each next to the same
 * figure for the previous comparable window and the percentage the API already
 * computed. Nothing is derived here: a difference the client recomputed would
 * eventually disagree with the server's rounding.
 */
export function PeriodComparison({ totals }: { totals: Totals }) {
  const { current, previous, trends } = totals;

  return (
    <DashboardSection
      title="Receitas e despesas do período"
      description={`${current.transactionCount} ${
        current.transactionCount === 1 ? 'lançamento' : 'lançamentos'
      } no período selecionado, comparados com ${previous.transactionCount} no período anterior.`}
    >
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Receitas" value={formatMoney(current.income)} tone="positive">
          <TrendBadge trending={trends.income.trending} goodWhen="up" />
          <span className="mt-1 block text-xs text-muted-foreground">
            Período anterior: {formatMoney(previous.income)}
          </span>
        </StatCard>

        <StatCard label="Despesas" value={formatMoney(current.expense)} tone="negative">
          <TrendBadge trending={trends.expense.trending} goodWhen="down" />
          <span className="mt-1 block text-xs text-muted-foreground">
            Período anterior: {formatMoney(previous.expense)}
          </span>
        </StatCard>

        <StatCard
          label="Saldo do período"
          value={formatMoney(current.net)}
          tone={current.net < 0 ? 'negative' : current.net > 0 ? 'positive' : 'neutral'}
        >
          <TrendBadge trending={trends.net.trending} goodWhen="up" />
          <span className="mt-1 block text-xs text-muted-foreground">
            Período anterior: {formatMoney(previous.net)}
          </span>
        </StatCard>
      </dl>
    </DashboardSection>
  );
}
