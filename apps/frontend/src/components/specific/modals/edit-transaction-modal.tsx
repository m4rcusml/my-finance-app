import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal/modal';
import { Button } from '@/components/ui/button';
import { useUpdateTransactionMutation } from '@/features/transactions/mutations';
import { useAccountsQuery } from '@/features/accounts/queries';
import { useCategoriesQuery } from '@/features/categories/queries';
import { useCreditCardsQuery } from '@/shared/lib/queries/credit-cards.queries';
import { Transaction } from '@/shared/lib/api/transactions';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
}

type TransactionType = 'INCOME' | 'EXPENSE';
type SourceType = 'account' | 'creditCard';

export function EditTransactionModal({ isOpen, onClose, transaction }: EditTransactionModalProps) {
  const mutation = useUpdateTransactionMutation();
  const { data: accounts } = useAccountsQuery();
  const { data: categories } = useCategoriesQuery();
  const { data: creditCards } = useCreditCardsQuery();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [sourceType, setSourceType] = useState<SourceType>('account');
  const [accountId, setAccountId] = useState('');
  const [creditCardId, setCreditCardId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  useEffect(() => {
    if (transaction) {
      setDescription(transaction.description || '');
      setAmount(String(transaction.value));
      try {
        setDate(new Date(transaction.date).toISOString().split('T')[0]);
      } catch {
        setDate(new Date().toISOString().split('T')[0]);
      }
      setType((transaction.type.toUpperCase() as 'INCOME' | 'EXPENSE') || 'EXPENSE');
      const hasCreditCard = !!transaction.creditCardId;
      setSourceType(hasCreditCard ? 'creditCard' : 'account');
      setAccountId(transaction.accountId || '');
      setCreditCardId(transaction.creditCardId || '');
      setCategoryId(transaction.categoryId || '');
    }
  }, [transaction]);

  const isLoading = mutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sourceId = sourceType === 'account' ? accountId : creditCardId;
    if (!amount || !date || !sourceId || !transaction) return;

    mutation.mutate(
      {
        id: transaction.id,
        dto: {
          description,
          value: Number(parseFloat(amount.replace(',', '.')).toFixed(2)),
          date: new Date(date).toISOString(),
          type: type.toLowerCase() as 'income' | 'expense',
          accountId: sourceType === 'account' ? accountId : undefined,
          creditCardId: sourceType === 'creditCard' ? creditCardId : undefined,
          categoryId: categoryId || undefined,
        },
      },
      {
        onSuccess: () => {
          onClose();
        },
      },
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Transação">
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
            Origem
            <select
              value={sourceType}
              onChange={(e) => {
                setSourceType(e.target.value as SourceType);
                setAccountId('');
                setCreditCardId('');
              }}
              className="w-full rounded-xl border border-foreground/10 bg-layer02 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none"
              disabled={isLoading}
            >
              <option value="account">Conta</option>
              <option value="creditCard">Cartão de Crédito</option>
            </select>
          </label>
        </div>

        <label className="block space-y-1.5 text-sm font-medium text-foreground">
          {sourceType === 'account' ? 'Conta' : 'Cartão de Crédito'}
          <select
            value={sourceType === 'account' ? accountId : creditCardId}
            onChange={(e) => {
              if (sourceType === 'account') setAccountId(e.target.value);
              else setCreditCardId(e.target.value);
            }}
            className="w-full rounded-xl border border-foreground/10 bg-layer02 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none"
            required
            disabled={isLoading}
          >
            <option value="" disabled>
              Selecione
            </option>
            {sourceType === 'account'
              ? accounts?.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))
              : creditCards?.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name}
                  </option>
                ))}
          </select>
        </label>

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
            {isLoading ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
