import { SummaryCard } from './summary-card';
import { formatCurrency } from '@/features/dashboard/utils';
import { Button } from '@/components/ui/button';

import { Label } from '@/components/ui/label';
import { DashboardResponse } from '@/shared/lib/api/dashboard';

type BalanceHeroProps = {
  totals?: DashboardResponse['totals'];
  isLoading?: boolean;
};

export function BalanceHero({ totals, isLoading }: BalanceHeroProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col items-start self-center gap-4">
        <div>
          <p className="text-md">Seu saldo total</p>
          <div className="flex flex-wrap gap-3">
            <span className="text-xxl font-semibold text-foreground">
              {isLoading ? 'Carregando...' : formatCurrency(totals?.totalBalance)}
            </span>
          </div>
        </div>

        <Label tone={!totals?.trending ? 'neutral' : totals.trending > 0 ? 'success' : 'danger'}>
          {totals?.trending === undefined
            ? '--'
            : `${totals.trending > 0 ? '+' : ''}${totals.trending}% vs. mês anterior`}
        </Label>

        <div className="flex self-stretch flex-wrap gap-4">
          <Button className="flex-1" size="xLarge" leftIcon="ArrowUpwardOutlined">
            Pagar
          </Button>
          <Button className="flex-1" size="xLarge" tone="layer02" rightIcon="ArrowDownwardOutlined">
            Receber
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        <SummaryCard
          label="Receitas"
          value={totals?.currentMonth.income.value}
          trend={totals?.currentMonth.income.trending}
          tone="positive"
        />
        <SummaryCard
          label="Despesas"
          value={totals?.currentMonth.expense.value}
          trend={totals?.currentMonth.expense.trending}
          tone="negative"
        />
        <SummaryCard
          bgColor="layer02"
          label="Balanço"
          value={totals?.currentMonth.net.value}
          trend={totals?.currentMonth.net.trending}
          tone={
            !totals?.currentMonth.net.value ? 'neutral' : totals.currentMonth.net.value > 0 ? 'positive' : 'negative'
          }
        />
      </div>
    </div>
  );
}
