'use client';

import { useState } from 'react';
import { useAccountsQuery } from '@/features/accounts/queries';
import { CreateAccountModal } from '@/components/specific/modals/create-account-modal';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { formatCurrency } from '@/shared/lib/utils';

export default function AccountsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: accounts, isLoading } = useAccountsQuery();

  return (
    <main className="flex-1 flex flex-col space-y-6 h-full p-4 md:p-8 pt-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Contas</h2>
          <p className="text-muted-foreground">Gerencie suas contas bancárias e saldos.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setIsModalOpen(true)}>Nova Conta</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-40 rounded-xl bg-layer02 animate-pulse" />)
        ) : accounts && accounts.length > 0 ? (
          accounts.map((account) => (
            <div
              key={account.id}
              className="rounded-xl border border-foreground/10 bg-layer01 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between space-y-0 pb-2">
                <div className="font-medium text-sm text-muted-foreground">{account.institution}</div>
                <div className="p-2 bg-layer02 rounded-full">
                  <Icon name="CreditCardMultipleOutlined" className="h-4 w-4 text-foreground" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-xl font-bold text-foreground">{account.name}</div>
                <p className="text-xs text-muted-foreground uppercase mt-1">{account.type}</p>
                {/* Note: Showing initialBalance as general balance might be misleading if it's not updated correctly, 
                    but existing specific/dashboard/accounts-panel uses 'balance' which comes from dashboard aggregator. 
                    The /accounts endpoint returns Account entity which has initialBalance. 
                    Ideally we should have a 'balance' field computed. 
                    Given the task constraints, I will display what is available. 
                */}
                <div className="mt-4 text-2xl font-bold text-foreground">{formatCurrency(account.initialBalance)}</div>
                <p className="text-xs text-muted-foreground">Saldo inicial</p>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full flex h-[450px] shrink-0 items-center justify-center rounded-md border border-dashed border-foreground/20">
            <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
              <div className="p-4 bg-layer02 rounded-full mb-4">
                <Icon name="CreditCardMultipleOutlined" className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">Nenhuma conta cadastrada</h3>
              <p className="mb-4 mt-2 text-sm text-muted-foreground">
                Você ainda não tem nenhuma conta cadastrada. Adicione uma para começar.
              </p>
              <Button onClick={() => setIsModalOpen(true)}>Adicionar Conta</Button>
            </div>
          </div>
        )}
      </div>

      <CreateAccountModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </main>
  );
}
