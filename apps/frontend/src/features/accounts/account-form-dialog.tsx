'use client';

import { type Account, ACCOUNT_TYPES, type AccountType } from '@finance/contracts';
import { useEffect, useId, useRef, useState } from 'react';
import { errorDetails, errorMessage } from '@/shared/lib/api';
import { ACCOUNT_TYPE_LABELS } from '@/shared/lib/format';
import { Dialog } from '@/shared/ui/dialog';
import { ActionButton, Field, Select, TextInput } from '@/shared/ui/form';
import { useCreateAccountMutation, useUpdateAccountMutation } from './mutations';

/**
 * Create / edit dialog.
 *
 * On a rejection the dialog stays open and the backend message is rendered
 * inline, above the fields — a toast alone would vanish and take the only
 * explanation of the failure with it.
 */

/** Accepts `1500,50` and `1.500,50` as well as `1500.50`. `null` = unparseable. */
function parseDecimalInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

interface FormState {
  name: string;
  institution: string;
  type: AccountType;
  initialBalance: string;
}

const EMPTY: FormState = { name: '', institution: '', type: 'checking', initialBalance: '0' };

type FieldErrors = Partial<Record<keyof FormState, string>>;

export interface AccountFormDialogProps {
  open: boolean;
  /** `null` opens the dialog in "criar" mode. */
  account: Account | null;
  onClose: () => void;
}

export function AccountFormDialog({ open, account, onClose }: AccountFormDialogProps) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});

  const createMutation = useCreateAccountMutation();
  const updateMutation = useUpdateAccountMutation();
  const mutation = account ? updateMutation : createMutation;
  const isEditing = Boolean(account);

  const resetCreate = createMutation.reset;
  const resetUpdate = updateMutation.reset;

  // Reload the dialog from the row every time it opens, and drop any stale error.
  useEffect(() => {
    if (!open) return;
    setErrors({});
    resetCreate();
    resetUpdate();
    setForm(
      account
        ? {
            name: account.name,
            institution: account.institution,
            type: account.type,
            initialBalance: String(account.initialBalance),
          }
        : EMPTY,
    );

    // Dialog focuses its close button first; move on to the first field.
    const raf = requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLInputElement>('input, select, textarea')?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open, account, resetCreate, resetUpdate]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const next: FieldErrors = {};
    if (!form.name.trim()) next.name = 'Informe o nome da conta.';
    if (!form.institution.trim()) next.institution = 'Informe a instituição.';

    const initialBalance = parseDecimalInput(form.initialBalance);
    if (form.initialBalance.trim() === '') next.initialBalance = 'Informe o saldo inicial (use 0 se não houver).';
    else if (initialBalance === null) next.initialBalance = 'Valor inválido. Exemplo: 1500,00';

    setErrors(next);
    if (Object.keys(next).length > 0 || initialBalance === null) return;

    const body = {
      name: form.name.trim(),
      institution: form.institution.trim(),
      type: form.type,
      initialBalance,
    };

    if (account) {
      updateMutation.mutate({ id: account.id, body }, { onSuccess: onClose });
    } else {
      createMutation.mutate(body, { onSuccess: onClose });
    }
  }

  const details = errorDetails(mutation.error);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? 'Editar conta' : 'Nova conta'}
      description={
        isEditing
          ? 'O saldo atual é recalculado a partir do saldo inicial e dos lançamentos vinculados.'
          : 'O saldo atual passa a ser o saldo inicial, mais cada receita e menos cada despesa lançada nesta conta.'
      }
      footer={
        <>
          <ActionButton variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </ActionButton>
          <ActionButton type="submit" form={formId} loading={mutation.isPending}>
            {isEditing ? 'Salvar alterações' : 'Criar conta'}
          </ActionButton>
        </>
      }
    >
      <form id={formId} ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
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

        <Field label="Nome" required error={errors.name}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              value={form.name}
              maxLength={120}
              autoComplete="off"
              placeholder="Conta corrente principal"
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
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
              onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
            />
          )}
        </Field>

        <Field label="Tipo" required>
          {({ id, describedBy }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AccountType }))}
            >
              {ACCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ACCOUNT_TYPE_LABELS[type] ?? type}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label="Saldo inicial"
          required
          hint="Saldo do dia em que você começou a usar o app. Use vírgula ou ponto para os centavos."
          error={errors.initialBalance}
        >
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              inputMode="decimal"
              value={form.initialBalance}
              placeholder="0,00"
              onChange={(e) => setForm((f) => ({ ...f, initialBalance: e.target.value }))}
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}
