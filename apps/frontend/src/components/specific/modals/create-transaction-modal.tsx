import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal/modal';
import { Button } from '@/components/ui/button';
import { useCreateTransactionMutation } from '@/features/transactions/mutations';
import { useAccountsQuery } from '@/features/accounts/queries';
import { useCategoriesQuery } from '@/features/categories/queries';

interface CreateTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: TransactionType;
}

type TransactionType = 'INCOME' | 'EXPENSE';

export function CreateTransactionModal({ isOpen, onClose, initialType = 'EXPENSE' }: CreateTransactionModalProps) {
  const mutation = useCreateTransactionMutation();
  const { data: accounts } = useAccountsQuery();
  const { data: categories } = useCategoriesQuery();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<TransactionType>(initialType);
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  useEffect(() => {
    if (isOpen) {
      setType(initialType);
    }
  }, [isOpen, initialType]);

  useEffect(() => {
    setDate(new Date().toISOString().split('T')[0]);
  }, []);

  const isLoading = mutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !date || !accountId) return;

    mutation.mutate(
      {
        description,
        value: Number(parseFloat(amount.replace(',', '.')).toFixed(2)),
        date: new Date(date).toISOString(),
        type: type,
        accountId,
        categoryId: categoryId || undefined,
      },
      {
        onSuccess: () => {
          onClose();
          resetForm();
        },
      },
    );
  }

  function resetForm() {
    setDescription('');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setType(initialType);
    setAccountId('');
    setCategoryId('');
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova Transação">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-4">
          <Button
            type="button"
            tone={type === 'EXPENSE' ? 'red' : 'layer02'}
            className="flex-1"
            onClick={() => setType('EXPENSE')}
          >
            Despesa
          </Button>
          <Button
            type="button"
            tone={type === 'INCOME' ? 'green' : 'layer02'}
            className="flex-1"
            onClick={() => setType('INCOME')}
          >
            Receita
          </Button>
        </div>

        <label className="block space-y-1.5 text-sm font-medium text-foreground">
          Descrição
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Compras do mês"
            className="w-full rounded-xl border border-foreground/10 bg-layer02 px-4 py-3 text-sm text-foreground placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            disabled={isLoading}
          />
        </label>

        <label className="block space-y-1.5 text-sm font-medium text-foreground">
          Valor
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className="w-full rounded-xl border border-foreground/10 bg-layer02 px-4 py-3 text-sm text-foreground placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            required
            disabled={isLoading}
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block space-y-1.5 text-sm font-medium text-foreground">
            Data
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-foreground/10 bg-layer02 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              required
              disabled={isLoading}
            />
          </label>

          <label className="block space-y-1.5 text-sm font-medium text-foreground">
            Conta
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-xl border border-foreground/10 bg-layer02 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none"
              required
              disabled={isLoading}
            >
              <option value="" disabled>
                Selecione
              </option>
              {accounts?.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-1.5 text-sm font-medium text-foreground">
          Categoria
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-xl border border-foreground/10 bg-layer02 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none"
            disabled={isLoading}
          >
            <option value="">Sem categoria</option>
            {categories?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" tone="layer02" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
