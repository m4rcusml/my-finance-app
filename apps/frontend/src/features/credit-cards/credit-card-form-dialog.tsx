'use client';

import type { CreateCreditCardRequest, CreditCard } from '@finance/contracts';
import { useEffect, useId, useRef, useState } from 'react';
import { errorDetails, errorMessage } from '@/shared/lib/api';
import { Dialog } from '@/shared/ui/dialog';
import { ActionButton, Field, TextInput } from '@/shared/ui/form';
import { useCreateCreditCardMutation, useUpdateCreditCardMutation } from './mutations';

interface CreditCardFormState {
  name: string;
  institution: string;
  limitTotal: string;
  closingDay: string;
}

const EMPTY_FORM: CreditCardFormState = {
  name: '',
  institution: '',
  limitTotal: '',
  closingDay: '',
};

type FieldErrors = Partial<Record<keyof CreditCardFormState, string>>;

function parseMoney(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

export function CreditCardFormDialog({
  open,
  creditCard,
  onClose,
}: {
  open: boolean;
  creditCard: CreditCard | null;
  onClose: () => void;
}) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<CreditCardFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});

  const createMutation = useCreateCreditCardMutation();
  const updateMutation = useUpdateCreditCardMutation();
  const mutation = creditCard ? updateMutation : createMutation;
  const resetCreate = createMutation.reset;
  const resetUpdate = updateMutation.reset;

  useEffect(() => {
    if (!open) return;

    setForm(
      creditCard
        ? {
            name: creditCard.name,
            institution: creditCard.institution,
            limitTotal: creditCard.limitTotal.toFixed(2).replace('.', ','),
            closingDay: creditCard.closingDay === null ? '' : String(creditCard.closingDay),
          }
        : EMPTY_FORM,
    );
    setErrors({});
    resetCreate();
    resetUpdate();

    const frame = requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, creditCard, resetCreate, resetUpdate]);

  function patch(changes: Partial<CreditCardFormState>) {
    setForm((current) => ({ ...current, ...changes }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    const name = form.name.trim();
    const institution = form.institution.trim();
    const limitTotal = parseMoney(form.limitTotal);
    const closingDay = form.closingDay.trim() === '' ? null : Number(form.closingDay);

    if (!name) nextErrors.name = 'Informe o nome do cartão.';
    if (!institution) nextErrors.institution = 'Informe a instituição.';
    if (limitTotal === null || limitTotal <= 0) {
      nextErrors.limitTotal = 'Informe um limite maior que zero, com até duas casas decimais.';
    }
    if (closingDay !== null && (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31)) {
      nextErrors.closingDay = 'Use um dia inteiro entre 1 e 31, ou deixe em branco.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || limitTotal === null) {
      requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
      return;
    }

    const body: CreateCreditCardRequest = {
      name,
      institution,
      limitTotal,
      closingDay,
    };

    if (creditCard) {
      updateMutation.mutate({ id: creditCard.id, body }, { onSuccess: onClose });
    } else {
      createMutation.mutate(body, { onSuccess: onClose });
    }
  }

  const details = errorDetails(mutation.error);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={creditCard ? 'Editar cartão' : 'Novo cartão'}
      description="O uso exibido considera somente as despesas do ciclo atualmente aberto."
      footer={
        <>
          <ActionButton variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </ActionButton>
          <ActionButton type="submit" form={formId} loading={mutation.isPending}>
            {creditCard ? 'Salvar alterações' : 'Criar cartão'}
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

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" required error={errors.name}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                value={form.name}
                maxLength={120}
                autoComplete="off"
                placeholder="Cartão principal"
                onChange={(event) => patch({ name: event.target.value })}
              />
            )}
          </Field>

          <Field label="Instituição" required error={errors.institution}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                value={form.institution}
                maxLength={120}
                autoComplete="off"
                placeholder="Banco Inter"
                onChange={(event) => patch({ institution: event.target.value })}
              />
            )}
          </Field>

          <Field label="Limite total" required hint="Em reais. Exemplo: 5.000,00" error={errors.limitTotal}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                value={form.limitTotal}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                onChange={(event) => patch({ limitTotal: event.target.value })}
              />
            )}
          </Field>

          <Field
            label="Dia de fechamento"
            hint="De 1 a 31. Em meses curtos, o sistema usa o último dia. Vazio significa mês civil."
            error={errors.closingDay}
          >
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                type="number"
                min={1}
                max={31}
                step={1}
                value={form.closingDay}
                placeholder="10"
                onChange={(event) => patch({ closingDay: event.target.value })}
              />
            )}
          </Field>
        </div>
      </form>
    </Dialog>
  );
}
