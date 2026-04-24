import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal/modal';
import { Button } from '@/components/ui/button';
import { useUpdateCategoryMutation } from '@/features/categories/mutations';
import { Category } from '@/shared/lib/api/categories';

interface EditCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category | null;
}

export function EditCategoryModal({ isOpen, onClose, category }: EditCategoryModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense' | 'both'>('expense');

  const mutation = useUpdateCategoryMutation(category?.id ?? '');
  const isLoading = mutation.isPending;

  useEffect(() => {
    if (category) {
      setName(category.name);
      setType(category.type);
    }
  }, [category]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !category) return;

    mutation.mutate(
      { name, type },
      {
        onSuccess: () => {
          onClose();
        },
      },
    );
  }

  const inputClass =
    'w-full rounded-xl border border-foreground/10 bg-layer02 px-4 py-3 text-sm text-foreground placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30';

  if (!category) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar categoria">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1.5 text-sm font-medium text-foreground">
          Nome
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Alimentação, Transporte, Salário"
            className={inputClass}
            required
            disabled={isLoading}
          />
        </label>

        <label className="block space-y-1.5 text-sm font-medium text-foreground">
          Tipo
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'income' | 'expense' | 'both')}
            className={`${inputClass} appearance-none cursor-pointer`}
            disabled={isLoading}
          >
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
            <option value="both">Ambos</option>
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
