import { useState } from 'react';
import type { DashboardResponse } from '@/shared/lib/api/dashboard';
import { formatCurrency } from '@/shared/lib/utils';
import { CreateAccountModal } from '@/components/specific/modals/create-account-modal';
import { Button } from '@/components/ui/button';

type AccountsPanelProps = {
  accounts: DashboardResponse['accounts'];
};

export function AccountsPanel({ accounts }: AccountsPanelProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="bg-layer01 rounded-4xl px-6 py-5">
        <div className="flex justify-between items-center">
          <h3 className="text-md">Suas contas</h3>

          <div className="flex gap-2">
            <Button tone="layer02" size="regular" onClick={() => setIsModalOpen(true)}>
              Nova conta
            </Button>
            <Button tone="layer02" size="regular" rightIcon="ArrowAngularTopRightOutlined">
              Ver mais
            </Button>
          </div>
        </div>

        <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
          {accounts.length === 0 ? (
            <div className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-foreground/10 bg-layer02/50 py-8 text-center text-muted-foreground">
              <p className="text-sm">Nenhuma conta encontrada</p>
              <Button size="small" tone="layer01" onClick={() => setIsModalOpen(true)}>
                Criar primeira conta
              </Button>
            </div>
          ) : (
            accounts.map((account) => (
              <div
                key={account.id}
                className="rounded-2xl border border-foreground/10 bg-layer02 p-4 text-muted-foreground min-w-[200px]"
              >
                <div className="flex items-center gap-3">
                  <Button leftIcon="CreditCardMultipleOutlined" tone="layer01" />
                  <div>
                    <p className="text-xs text-muted-foreground">{account.institution}</p>
                    <p className="text-md font-medium text-foreground">{account.name}</p>
                  </div>
                </div>

                <div className="mt-4 text-xs text-muted-foreground">Saldo atual</div>
                <div className="text-lg font-semibold text-foreground">{formatCurrency(account.balance)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <CreateAccountModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
