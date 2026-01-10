import { Card } from './card';
import { formatCurrency } from '@/features/dashboard/utils';
import { sampleFixedTransactions } from '@/features/dashboard/sample-data';

export function FixedTransactionsPanel() {
  return (
    <Card className="px-6 py-5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-layer02 text-sm text-muted-foreground"
        >
          <i className="lni lni-arrow-left" aria-hidden />
        </button>
        <h3 className="text-base font-medium text-foreground">
          Transacoes fixas - mes atual
        </h3>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-layer02 text-sm text-muted-foreground"
        >
          <i className="lni lni-arrow-right" aria-hidden />
        </button>
      </div>
      <div className="mt-4 space-y-4">
        {sampleFixedTransactions.map((transaction) => (
          <div
            key={transaction.id}
            className="rounded-2xl border border-foreground/10 bg-layer02 px-4 py-4"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-green/20 px-2 py-1 text-green">
                Receita
              </span>
              <span className="rounded-full bg-layer01 px-2 py-1">
                {transaction.category}
              </span>
            </div>
            <div className="mt-2 text-sm font-medium text-foreground">
              {transaction.title}
            </div>
            <div className="mt-1 text-base font-semibold text-foreground">
              {formatCurrency(transaction.amount)}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {transaction.due}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-foreground transition hover:bg-muted-primary"
              >
                Marcar como concluida
              </button>
              <button
                type="button"
                className="rounded-full bg-layer01 px-4 py-2 text-xs font-medium text-muted-foreground transition hover:bg-layer02 hover:text-foreground"
              >
                Marcar como nao concluida
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
