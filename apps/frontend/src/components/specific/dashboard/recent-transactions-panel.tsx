import { Lineicons } from '@lineiconshq/react-lineicons';
import { ArrowRightOutlined, MenuMeatballs1Outlined } from '@lineiconshq/free-icons';
import { Card } from './card';
import { SectionHeader } from './section-header';
import { formatCurrency } from '@/features/dashboard/utils';
import { sampleRecentTransactions } from '@/features/dashboard/sample-data';

export function RecentTransactionsPanel() {
  return (
    <Card className="px-6 py-5">
      <SectionHeader
        title="Ultimas transacoes"
        rightSlot={
          <button className="inline-flex items-center gap-2 rounded-full bg-layer02 px-3 py-1 text-xs text-muted-foreground">
            Ver mais
            <Lineicons icon={ArrowRightOutlined} size={12} aria-hidden />
          </button>
        }
      />
      <div className="mt-4 space-y-4">
        {sampleRecentTransactions.map((transaction) => (
          <div
            key={transaction.id}
            className="flex items-center gap-4 rounded-2xl border border-foreground/10 bg-layer02 px-4 py-4"
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
                <span className="rounded-full bg-layer01 px-2 py-1">{transaction.category}</span>
              </div>
              <div className="mt-2 text-sm font-medium text-foreground">{transaction.title}</div>
              <div className="text-base font-semibold text-foreground">{formatCurrency(transaction.amount)}</div>
            </div>
            <button className="rounded-full bg-layer01 px-3 py-2 text-xs text-muted-foreground">
              <Lineicons icon={MenuMeatballs1Outlined} size={14} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}
