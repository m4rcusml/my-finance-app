import type { DashboardResponse } from '@/shared/lib/api/dashboard';
import { formatCurrency } from '@/features/dashboard/utils';
import { Button } from '@/components/ui/button';

type AccountsPanelProps = {
  accounts: DashboardResponse['accounts'];
};

export function AccountsPanel({ accounts }: AccountsPanelProps) {
  return (
    <div className="bg-layer01 rounded-4xl px-6 py-5">
      <div className="flex justify-between items-center">
        <h3 className="text-md">Suas contas</h3>

        <Button tone="layer02" size="regular" rightIcon="ArrowAngularTopRightOutlined">
          Ver mais
        </Button>
      </div>

      <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
        {accounts.length === 0 ? (
          <div className="rounded-2xl border border-foreground/10 bg-layer02 px-4 py-6 text-sm text-muted-foreground">
            Nenhuma conta cadastrada ainda.
          </div>
        ) : (
          accounts.map((account) => (
            <div
              key={account.id}
              className="rounded-2xl border border-foreground/10 bg-layer02 p-4 text-muted-foreground"
            >
              <div className="flex items-center gap-3">
                <Button tone="layer01" leftIcon="CreditCardMultipleOutlined" />
                <div>
                  <p className="text-xs text-muted-foreground">{account.institution}</p>
                  <p className="text-sm font-medium text-foreground">{account.name}</p>
                </div>
              </div>

              <div className="mt-4 text-xs text-muted-foreground">Saldo atual</div>
              <div className="text-lg font-semibold text-foreground">{formatCurrency(account.balance)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
