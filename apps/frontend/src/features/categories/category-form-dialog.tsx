'use client';

import { type Category, CATEGORY_TYPES, type CategoryType, type CreateCategoryRequest } from '@finance/contracts';
import { useEffect, useId, useRef, useState } from 'react';
import { errorDetails, errorMessage } from '@/shared/lib/api';
import { CATEGORY_TYPE_LABELS } from '@/shared/lib/format';
import { Dialog } from '@/shared/ui/dialog';
import { ActionButton, Field, Select, TextInput } from '@/shared/ui/form';
import { useCreateCategoryMutation, useUpdateCategoryMutation } from './mutations';

interface CategoryFormState {
  name: string;
  type: CategoryType;
}

const EMPTY_FORM: CategoryFormState = { name: '', type: 'expense' };

export function CategoryFormDialog({
  open,
  category,
  onClose,
}: {
  open: boolean;
  category: Category | null;
  onClose: () => void;
}) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<CategoryFormState>(EMPTY_FORM);
  const [nameError, setNameError] = useState<string>();

  const createMutation = useCreateCategoryMutation();
  const updateMutation = useUpdateCategoryMutation();
  const mutation = category ? updateMutation : createMutation;
  const resetCreate = createMutation.reset;
  const resetUpdate = updateMutation.reset;

  useEffect(() => {
    if (!open) return;

    setForm(category ? { name: category.name, type: category.type } : EMPTY_FORM);
    setNameError(undefined);
    resetCreate();
    resetUpdate();

    const frame = requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, category, resetCreate, resetUpdate]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setNameError('Informe o nome da categoria.');
      return;
    }

    const body: CreateCategoryRequest = { name, type: form.type };
    if (category) {
      updateMutation.mutate({ id: category.id, body }, { onSuccess: onClose });
    } else {
      createMutation.mutate(body, { onSuccess: onClose });
    }
  }

  const details = errorDetails(mutation.error);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={category ? 'Editar categoria' : 'Nova categoria'}
      description="Categorias do tipo “Ambos” podem ser usadas em receitas e despesas."
      footer={
        <>
          <ActionButton variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </ActionButton>
          <ActionButton type="submit" form={formId} loading={mutation.isPending}>
            {category ? 'Salvar alterações' : 'Criar categoria'}
          </ActionButton>
        </>
      }
    >
      <form ref={formRef} id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {mutation.isError ? (
          <div role="alert" className="rounded-lg border border-danger/60 bg-layer02 p-3">
            <p className="text-sm font-medium text-danger-text">{errorMessage(mutation.error)}</p>
            {details.length > 0 ? (
              <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
                {details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <Field label="Nome" required error={nameError}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              value={form.name}
              maxLength={120}
              autoComplete="off"
              placeholder="Alimentação"
              onChange={(event) => {
                setForm((current) => ({ ...current, name: event.target.value }));
                setNameError(undefined);
              }}
            />
          )}
        </Field>

        <Field label="Tipo" required>
          {({ id, describedBy }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as CategoryType }))}
            >
              {CATEGORY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CATEGORY_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </form>
    </Dialog>
  );
}
