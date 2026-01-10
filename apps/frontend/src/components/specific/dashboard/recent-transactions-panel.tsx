import { formatCurrency } from '@/features/dashboard/utils';
import { sampleRecentTransactions } from '@/features/dashboard/sample-data';
import { Button } from '@/components/ui/button';

export function RecentTransactionsPanel() {
  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden">
      <div className="flex justify-between items-center">
        <span className="text-md">Últimas transações</span>

        <Button tone="layer02" rightIcon="ArrowAngularTopRightOutlined">
          Ver mais
        </Button>
      </div>

      <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
        {sampleRecentTransactions.map((transaction) => (
          <div
            key={transaction.id}
            className="flex items-center gap-4 rounded-2xl border border-foreground/10 bg-layer01 px-4 py-4"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-layer01 text-xs text-muted-foreground">
              {transaction.type === 'income' ? 'IN' : 'OUT'}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span
                  className={`rounded-full px-2 py-1 ${
                    transaction.type === 'income' ? 'bg-green/20 text-green' : 'bg-red/20 text-red'
                  }`}
                >
                  {transaction.type === 'income' ? 'Receita' : 'Despesa'}
                </span>
                <span className="rounded-full bg-layer02 px-2 py-1">{transaction.category}</span>
              </div>
              <div className="mt-2 text-sm font-medium text-foreground">{transaction.title}</div>
              <div className="text-base font-semibold text-foreground">{formatCurrency(transaction.amount)}</div>
            </div>
            <Button tone="layer01" leftIcon="MenuMeatballs1Outlined" />
          </div>
        ))}
      </div>
    </div>
  );
}
