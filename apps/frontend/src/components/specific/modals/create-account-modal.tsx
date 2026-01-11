import { useState } from 'react';
import { Modal } from '@/components/ui/modal/modal';
import { Button } from '@/components/ui/button';
import { useCreateAccountMutation } from '@/features/accounts/mutations';

interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AccountType = 'CHECKING' | 'INVESTMENT' | 'CASH';

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'CHECKING', label: 'Conta Corrente' },
  { value: 'INVESTMENT', label: 'Investimento' },
  { value: 'CASH', label: 'Dinheiro' },
];

export function CreateAccountModal({ isOpen, onClose }: CreateAccountModalProps) {
  const mutation = useCreateAccountMutation();
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [type, setType] = useState<AccountType>('CHECKING');
  const [initialBalance, setInitialBalance] = useState('');

  const isLoading = mutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !institution || !initialBalance) return;

    mutation.mutate(
      {
        name,
        institution,
        type,
        initialBalance: Number(parseFloat(initialBalance.replace(',', '.')).toFixed(2)),
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
    setName('');
    setInstitution('');
    setType('CHECKING');
    setInitialBalance('');
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Adicionar conta">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1.5 text-sm font-medium text-foreground">
          Nome da conta
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Conta Principal"
            className="w-full rounded-xl border border-foreground/10 bg-layer02 px-4 py-3 text-sm text-foreground placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            required
            disabled={isLoading}
          />
        </label>

        <label className="block space-y-1.5 text-sm font-medium text-foreground">
          Instituição
          <input
            type="text"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="Ex: Nubank, Inter, Carteira"
            className="w-full rounded-xl border border-foreground/10 bg-layer02 px-4 py-3 text-sm text-foreground placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            required
            disabled={isLoading}
          />
        </label>

        <label className="block space-y-1.5 text-sm font-medium text-foreground">
          Tipo
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AccountType)}
            className="w-full rounded-xl border border-foreground/10 bg-layer02 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none"
            disabled={isLoading}
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5 text-sm font-medium text-foreground">
          Saldo inicial
          <input
            type="number"
            step="0.01"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            placeholder="0,00"
            className="w-full rounded-xl border border-foreground/10 bg-layer02 px-4 py-3 text-sm text-foreground placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            required
            disabled={isLoading}
          />
        </label>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" tone="layer02" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Criando...' : 'Criar conta'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
