'use client';

import { useState } from 'react';
import { useTransactionsQuery } from '@/features/transactions/queries';
import { useDeleteTransactionMutation } from '@/features/transactions/mutations';
import { useCategoriesQuery } from '@/features/categories/queries';
import { useAccountsQuery } from '@/features/accounts/queries';
import { useCreditCardsQuery } from '@/shared/lib/queries/credit-cards.queries';
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
  const { data: categories } = useCategoriesQuery();
  const { data: accounts } = useAccountsQuery();
  const { data: creditCards } = useCreditCardsQuery();
  const deleteMutation = useDeleteTransactionMutation();

  const activeFiltersCount = [
    filters.type,
    filters.fromDate,
    filters.toDate,
    filters.categoryId,
    filters.accountId,
    filters.creditCardId,
  ].filter(Boolean).length;

  function getCategoryName(categoryId?: string | null) {
    if (!categoryId) return 'Sem Categoria';
    const category = categories?.find((c) => c.id === categoryId);
    return category?.name ?? 'Categoria';
  }

  function getSourceName(transaction: Transaction) {
    if (transaction.accountId) {
      const account = accounts?.find((a) => a.id === transaction.accountId);
      return account?.name ?? 'Conta';
    }
    if (transaction.creditCardId) {
      const card = creditCards?.find((c) => c.id === transaction.creditCardId);
      return card?.name ?? 'Cartão';
    }
    return '—';
  }

  function handleDelete(transaction: Transaction) {
    if (window.confirm('Tem certeza que deseja excluir esta transação?')) {
      deleteMutation.mutate(transaction.id);
    }
  }

  function clearFilters() {
    setFilters({});
  }

  const inputClass =
    'w-full rounded-xl border border-foreground/10 bg-layer02 px-4 py-2.5 text-sm text-foreground placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30';

  return (
    <main className="flex-1 flex flex-col space-y-6 h-full p-4 md:p-8 pt-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Transações</h2>
          <p className="text-muted-foreground">Visualize e gerencie suas receitas e despesas.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setIsCreateModalOpen(true)}>Nova Transação</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Type filter */}
          <Button
            tone={!filters.type ? 'primary' : 'layer01'}
            size="small"
            onClick={() => setFilters((prev) => ({ ...prev, type: undefined }))}
          >
            Todas
          </Button>
          <Button
            tone={filters.type === 'income' ? 'green' : 'layer01'}
            size="small"
            onClick={() => setFilters((prev) => ({ ...prev, type: 'income' }))}
          >
            Receitas
          </Button>
          <Button
            tone={filters.type === 'expense' ? 'red' : 'layer01'}
            size="small"
            onClick={() => setFilters((prev) => ({ ...prev, type: 'expense' }))}
          >
            Despesas
          </Button>

          {activeFiltersCount > 0 && (
            <Button tone="layer02" size="small" onClick={clearFilters}>
              Limpar filtros ({activeFiltersCount})
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Date from */}
          <label className="block space-y-1 text-xs font-medium text-muted-foreground">
            Data inicial
            <input
              type="date"
              value={filters.fromDate ?? ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  fromDate: e.target.value || undefined,
                }))
              }
              className={inputClass}
            />
          </label>

          {/* Date to */}
          <label className="block space-y-1 text-xs font-medium text-muted-foreground">
            Data final
            <input
              type="date"
              value={filters.toDate ?? ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  toDate: e.target.value || undefined,
                }))
              }
              className={inputClass}
            />
          </label>

          {/* Category filter */}
          <label className="block space-y-1 text-xs font-medium text-muted-foreground">
            Categoria
            <select
              value={filters.categoryId ?? ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  categoryId: e.target.value || undefined,
                }))
              }
              className={`${inputClass} appearance-none cursor-pointer`}
            >
              <option value="">Todas as categorias</option>
              {categories?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          {/* Source filter (account or credit card) */}
          <label className="block space-y-1 text-xs font-medium text-muted-foreground">
            Origem
            <select
              value={filters.accountId ?? filters.creditCardId ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                if (!value) {
                  setFilters((prev) => ({
                    ...prev,
                    accountId: undefined,
                    creditCardId: undefined,
                  }));
                  return;
                }
                const isAccount = accounts?.some((a) => a.id === value);
                setFilters((prev) => ({
                  ...prev,
                  accountId: isAccount ? value : undefined,
                  creditCardId: isAccount ? undefined : value,
                }));
              }}
              className={`${inputClass} appearance-none cursor-pointer`}
            >
              <option value="">Todas as origens</option>
              <optgroup label="Contas">
                {accounts?.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Cartões">
                {creditCards?.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
        </div>
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
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Origem</th>
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
                      {getCategoryName(transaction.categoryId)}
                    </td>
                    <td className="p-4 align-middle text-muted-foreground">{getSourceName(transaction)}</td>
                    <td className="p-4 align-middle text-muted-foreground">
                      {new Date(transaction.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td
                      className={`p-4 align-middle text-right font-medium ${
                        transaction.type === 'INCOME' || transaction.type === 'income' ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {transaction.type === 'INCOME' || transaction.type === 'income' ? '+' : '-'} {formatCurrency(Number(transaction.value))}
                    </td>
                    <td className="p-4 align-middle text-right">
                      <div className="flex justify-end gap-2">
                        <Button tone="layer01" size="small" onClick={() => setEditingTransaction(transaction)}>
                          <Icon name="Pencil1Outlined" className="h-4 w-4" />
                        </Button>
                        <Button tone="layer01" size="small" onClick={() => handleDelete(transaction)}>
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
            {activeFiltersCount > 0 && (
              <Button tone="layer02" size="small" className="mt-3" onClick={clearFilters}>
                Limpar filtros
              </Button>
            )}
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
