import { Lineicons } from '@lineiconshq/react-lineicons';
import { ArrowLeftOutlined, ArrowRightOutlined } from '@lineiconshq/free-icons';
import { Card } from './card';
import { SummaryCard } from './summary-card';
import { formatCurrency } from '@/features/dashboard/utils';

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
      <Card className="px-6 py-6">
        <p className="text-sm text-muted-foreground">Seu saldo total</p>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <span className="text-xxl font-semibold text-foreground">
            {isLoading ? 'Carregando...' : formatCurrency(totalBalance)}
          </span>
          <span className="rounded-full bg-green/20 px-3 py-1 text-xs font-medium text-green">
            +12%
          </span>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            className="flex min-w-[120px] items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-medium text-foreground transition hover:bg-muted-primary"
          >
            <Lineicons icon={ArrowLeftOutlined} size={16} aria-hidden />
            Pagar
          </button>
          <button
            type="button"
            className="flex min-w-[120px] items-center justify-center gap-2 rounded-full bg-layer02 px-4 py-2 text-xs font-medium text-muted-foreground transition hover:bg-layer01 hover:text-foreground"
          >
            <Lineicons icon={ArrowRightOutlined} size={16} aria-hidden />
            Receber
          </button>
        </div>
      </Card>

      <div className="grid gap-4">
        <SummaryCard
          label="Receitas"
          value={monthly?.income}
          trend={12}
          tone="positive"
        />
        <SummaryCard
          label="Despesas"
          value={monthly?.expense}
          trend={-12}
          tone="negative"
        />
        <SummaryCard
          label="Balanco"
          value={monthly?.net}
          trend={12}
          tone={monthly && monthly.net >= 0 ? 'positive' : 'negative'}
        />
      </div>
    </div>
  );
}
