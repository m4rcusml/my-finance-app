import { Lineicons } from '@lineiconshq/react-lineicons';
import {
  ArrowRightOutlined,
  CreditCardMultipleOutlined,
} from '@lineiconshq/free-icons';
import type { DashboardResponse } from '@/shared/lib/api/dashboard';
import { Card } from './card';
import { formatCurrency } from '@/features/dashboard/utils';
import { SectionHeader } from './section-header';

type AccountsPanelProps = {
  accounts: DashboardResponse['accounts'];
};

export function AccountsPanel({ accounts }: AccountsPanelProps) {
  return (
    <Card className="px-6 py-5">
      <SectionHeader
        title="Suas contas"
        rightSlot={
          <button className="inline-flex items-center gap-2 rounded-full bg-layer02 px-3 py-1 text-xs text-muted-foreground">
            Ver mais
            <Lineicons icon={ArrowRightOutlined} size={12} aria-hidden />
          </button>
        }
      />
      <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
        {accounts.length === 0 ? (
          <div className="rounded-2xl border border-foreground/10 bg-layer02 px-4 py-6 text-sm text-muted-foreground">
            Nenhuma conta cadastrada ainda.
          </div>
        ) : (
          accounts.map((account) => (
            <div
              key={account.id}
              className="min-w-[200px] rounded-2xl border border-foreground/10 bg-layer02 px-4 py-4 text-muted-foreground"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-layer01 text-sm text-muted-foreground">
                  <Lineicons icon={CreditCardMultipleOutlined} size={20} aria-hidden />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{account.institution}</p>
                  <p className="text-sm font-medium text-foreground">{account.name}</p>
                </div>
              </div>
              <div className="mt-4 text-xs text-muted-foreground">Saldo atual</div>
              <div className="text-lg font-semibold text-foreground">
                {formatCurrency(account.balance)}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
