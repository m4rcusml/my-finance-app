import { useState } from 'react';
import { Modal } from '@/components/ui/modal/modal';
import { Button } from '@/components/ui/button';
import { useCreateCreditCardMutation } from '@/shared/lib/queries/credit-cards.queries';

interface CreateCreditCardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateCreditCardModal({ isOpen, onClose }: CreateCreditCardModalProps) {
  const mutation = useCreateCreditCardMutation();
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [limitTotal, setLimitTotal] = useState('');
  const [closingDay, setClosingDay] = useState('');

  const isLoading = mutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !institution || !limitTotal) return;

    mutation.mutate(
      {
        name,
        institution,
        limitTotal: Number(parseFloat(limitTotal.replace(',', '.')).toFixed(2)),
        closingDay: closingDay ? Number(closingDay) : undefined,
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
    setLimitTotal('');
    setClosingDay('');
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Adicionar cartão de crédito">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1.5 text-sm font-medium text-foreground">
          Nome do cartão
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Cartão Principal"
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
            placeholder="Ex: Nubank, Inter, Bradesco"
            className="w-full rounded-xl border border-foreground/10 bg-layer02 px-4 py-3 text-sm text-foreground placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            required
            disabled={isLoading}
          />
        </label>

        <label className="block space-y-1.5 text-sm font-medium text-foreground">
          Limite total
          <input
            type="number"
            step="0.01"
            value={limitTotal}
            onChange={(e) => setLimitTotal(e.target.value)}
            placeholder="0,00"
            className="w-full rounded-xl border border-foreground/10 bg-layer02 px-4 py-3 text-sm text-foreground placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            required
            disabled={isLoading}
          />
        </label>

        <label className="block space-y-1.5 text-sm font-medium text-foreground">
          Dia de fechamento (opcional)
          <input
            type="number"
            min={1}
            max={31}
            value={closingDay}
            onChange={(e) => setClosingDay(e.target.value)}
            placeholder="Ex: 10"
            className="w-full rounded-xl border border-foreground/10 bg-layer02 px-4 py-3 text-sm text-foreground placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            disabled={isLoading}
          />
        </label>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" tone="layer02" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Criando...' : 'Criar cartão'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
