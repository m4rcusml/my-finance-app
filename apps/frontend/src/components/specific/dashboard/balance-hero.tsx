import { SummaryCard } from './summary-card';
import { formatCurrency } from '@/features/dashboard/utils';
import { Button } from '@/components/ui/button';

type BalanceHeroProps = {
  totalBalance?: number;
  monthly?: {
    income: number;
    expense: number;
    net: number;
  };
  isLoading?: boolean;
};

export function BalanceHero({ totalBalance, monthly, isLoading }: BalanceHeroProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col items-start self-center gap-4">
        <div>
          <p className="text-md">Seu saldo total</p>
          <div className="flex flex-wrap gap-3">
            <span className="text-xxl font-semibold text-foreground">
              {isLoading ? 'Carregando...' : formatCurrency(totalBalance)}
            </span>
          </div>
        </div>
        <span className="rounded-full bg-green/20 px-3 py-1 text-xs font-medium text-green">+12%</span>
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
        <SummaryCard label="Receitas" value={monthly?.income} trend={12} tone="positive" />
        <SummaryCard label="Despesas" value={monthly?.expense} trend={-12} tone="negative" />
        <SummaryCard
          bgColor="layer02"
          label="Balanco"
          value={monthly?.net}
          trend={12}
          tone={monthly && monthly.net >= 0 ? 'positive' : 'negative'}
        />
      </div>
    </div>
  );
}
