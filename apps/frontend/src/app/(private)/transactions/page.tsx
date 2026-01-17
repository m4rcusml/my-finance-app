'use client';

import { useState } from 'react';
import { useTransactionsQuery } from '@/features/transactions/queries';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { formatCurrency } from '@/shared/lib/utils';
import { ListTransactionsFilters, Transaction } from '@/shared/lib/api/transactions';
import { CreateTransactionModal } from '@/components/specific/modals/create-transaction-modal';
import { EditTransactionModal } from '@/components/specific/modals/edit-transaction-modal';

export default function TransactionsPage() {
  const [filters, setFilters] = useState<ListTransactionsFilters>({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const { data: transactions, isLoading } = useTransactionsQuery(filters);

  return (
    <main className="flex-1 flex flex-col space-y-6 h-full p-4 md:p-8 pt-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Transações</h2>
          <p className="text-muted-foreground">Visualize e gerencie suas receitas e despesas.</p>
        </div>
        <div className="flex items-center space-x-2">
          {/* <Button variant="outline">Importar</Button> */}
          <Button onClick={() => setIsCreateModalOpen(true)}>Nova Transação</Button>
        </div>
      </div>

      <div className="flex items-center gap-2 py-4">
        {/* Simple Filter Placeholders - Functionality can be expanded later */}
        <Button
          tone={!filters.type ? 'layer02' : 'layer01'}
          size="small"
          onClick={() => setFilters((prev) => ({ ...prev, type: undefined }))}
        >
          Todas
        </Button>
        <Button
          tone={filters.type === 'INCOME' ? 'layer02' : 'layer01'}
          size="small"
          onClick={() => setFilters((prev) => ({ ...prev, type: 'INCOME' }))}
        >
          Receitas
        </Button>
        <Button
          tone={filters.type === 'EXPENSE' ? 'layer02' : 'layer01'}
          size="small"
          onClick={() => setFilters((prev) => ({ ...prev, type: 'EXPENSE' }))}
        >
          Despesas
        </Button>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-layer01 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando transações...</div>
        ) : transactions && transactions.length > 0 ? (
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b [&_tr]:border-foreground/10">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Descrição</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Categoria</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Data</th>
                  <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Valor</th>
                  <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {transactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="border-b border-foreground/5 transition-colors hover:bg-layer02/50"
                  >
                    <td className="p-4 align-middle font-medium text-foreground">
                      {transaction.description || 'Sem descrição'}
                    </td>
                    <td className="p-4 align-middle text-muted-foreground">
                      {/* We might need to fetch category name or it comes populated? 
                          Transactions API response usually has categoryId. 
                          If we want names, backend should include relation or we fetch categories. 
                          For now, displaying ID or placeholder if relation not loaded. 
                          Ideally the backend returns the Category object.
                          Let's assume for now it's just ID or we need to look it up.
                      */}
                      {transaction.categoryId ? 'Categoria' : 'Sem Categoria'}
                    </td>
                    <td className="p-4 align-middle text-muted-foreground">
                      {new Date(transaction.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td
                      className={`p-4 align-middle text-right font-medium ${
                        transaction.type === 'INCOME' ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {transaction.type === 'INCOME' ? '+' : '-'} {formatCurrency(Number(transaction.value))}
                    </td>
                    <td className="p-4 align-middle text-right">
                      <div className="flex justify-end gap-2">
                        <Button tone="layer01" size="small" onClick={() => setEditingTransaction(transaction)}>
                          <Icon name="Pencil1Outlined" className="h-4 w-4" />
                        </Button>
                        <Button tone="layer01" size="small">
                          <Icon name="Trash3Outlined" className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex h-[300px] flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <div className="p-3 bg-layer02 rounded-full mb-3">
              <Icon name="FilePlusCircleOutlined" className="h-6 w-6" />
            </div>
            <p>Nenhuma transação encontrada.</p>
          </div>
        )}
      </div>

      <CreateTransactionModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      <EditTransactionModal
        isOpen={!!editingTransaction}
        onClose={() => setEditingTransaction(null)}
        transaction={editingTransaction}
      />
    </main>
  );
}
