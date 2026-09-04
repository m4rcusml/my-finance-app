'use client';

import { type Category, CATEGORY_TYPES, type CategoryType, type CreateCategoryRequest } from '@finance/contracts';
import { useId, useState } from 'react';
import { errorMessage } from '@/shared/lib/api';
import { CATEGORY_TYPE_LABELS } from '@/shared/lib/format';
import { Dialog } from '@/shared/ui/dialog';
import { ActionButton, Field, Select, TextInput } from '@/shared/ui/form';
import { useCreateCategoryMutation, useUpdateCategoryMutation } from './mutations';

export const CATEGORY_COLORS = [
  { name: 'Violeta', value: '#a78bfa' },
  { name: 'Verde', value: '#34d399' },
  { name: 'Azul', value: '#60a5fa' },
  { name: 'Amarelo', value: '#fbbf24' },
  { name: 'Vermelho', value: '#f87171' },
  { name: 'Cinza', value: '#94a3b8' },
] as const;

export function CategoryFormDialog({
  open,
  category,
  onClose,
}: {
  open: boolean;
  category: Category | null;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <Dialog open onClose={onClose} title={category ? 'Editar categoria' : 'Nova categoria'}>
      <CategoryForm key={category?.id ?? 'new'} category={category} onSaved={onClose} onCancel={onClose} />
    </Dialog>
  );
}

export function CategoryForm({
  category = null,
  onSaved,
  onCancel,
}: {
  category?: Category | null;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const colorGroup = useId();
  const [name, setName] = useState(category?.name ?? '');
  const [type, setType] = useState<CategoryType>(category?.type ?? 'expense');
  const [color, setColor] = useState<string | null>(category?.color ?? CATEGORY_COLORS[0].value);
  const [nameError, setNameError] = useState<string>();
  const create = useCreateCategoryMutation();
  const update = useUpdateCategoryMutation();
  const mutation = category ? update : create;
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setNameError('Informe o nome da categoria.');
      return;
    }
    const body: CreateCategoryRequest = { name: name.trim(), type, color };
    try {
      if (category) await update.mutateAsync({ id: category.id, body });
      else {
        await create.mutateAsync(body);
        setName('');
      }
      onSaved?.();
    } catch {
      /* Mutation keeps the entered values and renders the error below. */
    }
  }
  return (
    <form onSubmit={save} noValidate className="space-y-6">
      {mutation.isError ? (
        <p role="alert" className="rounded-xl border border-danger/60 bg-layer02 p-3 text-sm text-danger-text">
          {errorMessage(mutation.error)}
        </p>
      ) : null}
      <Field label="Nome" required error={nameError}>
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setNameError(undefined);
            }}
            maxLength={80}
            placeholder="Ex.: Educação"
            autoComplete="off"
            className="bg-layer00"
          />
        )}
      </Field>
      <Field label="Tipo" required>
        {({ id }) => (
          <Select
            id={id}
            value={type}
            className="bg-layer00"
            onChange={(event) => setType(event.target.value as CategoryType)}
          >
            {CATEGORY_TYPES.map((value) => (
              <option key={value} value={value}>
                {CATEGORY_TYPE_LABELS[value]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <fieldset>
        <legend className="mb-3 text-xs font-medium uppercase text-muted-foreground">Cor</legend>
        <div className="flex flex-wrap gap-3">
          {CATEGORY_COLORS.map((option) => (
            <label key={option.value} className="relative cursor-pointer" title={option.name}>
              <input
                type="radio"
                name={colorGroup}
                aria-label={option.name}
                checked={color === option.value}
                onChange={() => setColor(option.value)}
                className="peer sr-only"
              />
              <span
                className="block size-8 rounded-full border-2 border-transparent peer-checked:border-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-muted-primary"
                style={{ backgroundColor: option.value }}
              />
            </label>
          ))}
        </div>
        {category ? (
          <button type="button" className="mt-3 text-xs text-muted-primary" onClick={() => setColor(null)}>
            Usar cor padrão
          </button>
        ) : null}
      </fieldset>
      <div className="flex gap-2">
        {onCancel ? (
          <ActionButton variant="secondary" onClick={onCancel} disabled={mutation.isPending}>
            Cancelar
          </ActionButton>
        ) : null}
        <ActionButton type="submit" loading={mutation.isPending} className="min-h-12 flex-1">
          {category ? 'Salvar alterações' : 'Criar categoria'}
        </ActionButton>
      </div>
      {!category ? (
        <p className="text-xs text-muted-foreground">Use um nome único para cada tipo de categoria.</p>
      ) : null}
    </form>
  );
}
