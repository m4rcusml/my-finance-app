import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal/modal';
import { Button } from '@/components/ui/button';
import { useUpdateAccountMutation } from '@/features/accounts/mutations';
import { Account } from '@/shared/lib/api/accounts';

interface EditAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
}

type AccountType = 'checking' | 'savings' | 'investment' | 'cash' | 'other';

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Conta Corrente' },
  { value: 'savings', label: 'Poupança' },
  { value: 'investment', label: 'Investimento' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'other', label: 'Outro' },
];

export function EditAccountModal({ isOpen, onClose, account }: EditAccountModalProps) {
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [initialBalance, setInitialBalance] = useState('');

  // Initialize mutation with empty string, will be ignored until used properly or we can't use hook conditionally.
  // Actually hook must be at top level. We can pass ID to mutate function.
  // Wait, useUpdateAccountMutation in features/accounts/mutations.ts takes accountId as argument!
  // That's a bit specific. Usually mutation hook is generic or returns a mutate function that takes payload.
  // Let's check the mutation definition again.
  // export function useUpdateAccountMutation(accountId: string) { ... }
  // This means we have to call the hook with the ID. But ID changes or is null.
  // We should modify useUpdateAccountMutation to NOT take ID in the hook, but in the mutate function
  // OR we just use a key-based hook but that's complex if account is null.
  //
  // Standard React Query: mutationFn: (variables) => ... return useMutation(...)

  // Let's assume I can't easily change the mutation file right now without breaking other things (though it seems unused elsewhere?).
  // If I look at the file content in Step 21:
  // export function useUpdateAccountMutation(accountId: string) { ... mutationFn: (dto) => accountsApi.update(accountId, dto) ... }
  // This is indeed restrictive. I should refactor useUpdateAccountMutation to take { id, ...dto } or just accept it's awkward.
  // But wait, if I use it here with account?.id, and account is null freely, it might be weird.
  // Let's refactor the mutation first to be more flexible, or create a flexible one here.
  // Refactoring is better practice. Be proactive.

  // Actually, I'll check features/accounts/mutations.ts again.

  const mutation = useUpdateAccountMutation();

  useEffect(() => {
    if (account) {
      setName(account.name);
      setInstitution(account.institution);
      // Ensure type matches our discriminated union or fallback
      const foundType = ACCOUNT_TYPES.find((t) => t.value === account.type)?.value || 'checking';
      setType(foundType);
      setInitialBalance(String(account.initialBalance));
    }
  }, [account]);

  const isLoading = mutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !institution || !initialBalance || !account) return;

    mutation.mutate(
      {
        id: account.id,
        dto: {
          name,
          institution,
          type,
          initialBalance: Number(parseFloat(String(initialBalance).replace(',', '.')).toFixed(2)),
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
    <Modal isOpen={isOpen} onClose={onClose} title="Editar conta">
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
            {isLoading ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
