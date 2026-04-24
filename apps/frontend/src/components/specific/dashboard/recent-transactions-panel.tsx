import { formatCurrency } from '@/shared/lib/utils';
import { Button } from '@/components/ui/button';

import { Label } from '@/components/ui/label';
import { Transaction } from '@/shared/lib/api/transactions';
import Link from 'next/link';

type RecentTransactionsPanelProps = {
  transactions?: Transaction[];
};

export function RecentTransactionsPanel({ transactions = [] }: RecentTransactionsPanelProps) {
  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      <div className="flex justify-between items-center shrink-0">
        <span className="text-md">Últimas transações</span>

        <Link href="/transactions">
          <Button tone="layer02" rightIcon="ArrowAngularTopRightOutlined">
            Ver mais
          </Button>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth flex flex-col gap-4">
        {transactions.length > 0 ? (
          transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center gap-4 rounded-2xl border border-foreground/10 bg-layer01 px-4 py-4 shrink-0"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-layer01 text-xs text-muted-foreground">
                {transaction.type === 'INCOME' ? 'IN' : 'OUT'}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Label tone={transaction.type === 'INCOME' ? 'success' : 'danger'} size="small">
                    {transaction.type === 'INCOME' ? 'Receita' : 'Despesa'}
                  </Label>
                  <Label tone="layer02" size="small">
                    {transaction.categoryId ?? 'Sem categoria'}
                  </Label>
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">{transaction.description}</div>
                <div className="text-base font-semibold text-foreground">
                  {formatCurrency(Number(transaction.value))}
                </div>
              </div>
              <Button tone="layer01" leftIcon="MenuMeatballs1Outlined" />
            </div>
          ))
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2 min-h-[100px] border border-dashed border-foreground/10 bg-layer02/50 rounded-2xl">
            <p className="text-sm">Não há transações recentes.</p>
          </div>
        )}
      </div>
    </div>
  );
}
