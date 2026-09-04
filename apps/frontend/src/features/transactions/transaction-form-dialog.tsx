'use client';

import {
  type CreateTransactionRequest,
  isCivilDate,
  TRANSACTION_TYPES,
  type TransactionType,
  type TransactionWithRelations,
} from '@finance/contracts';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { categoryOptions, moneyToInput, parseMoneyInput } from '@/features/transactions/helpers';
import { useTransactionMutations } from '@/features/transactions/mutations';
import { useTransactionReferences } from '@/features/transactions/references';
import { errorDetails, errorMessage } from '@/shared/lib/api';
import { todayCivil, TRANSACTION_TYPE_LABELS } from '@/shared/lib/format';
import { Dialog } from '@/shared/ui/dialog';
import { ActionButton, Field, Select, TextInput } from '@/shared/ui/form';
import { useToast } from '@/shared/ui/toast';

/**
 * Create / edit dialog.
 *
 * The one rule the whole form is built around: a transaction has EXACTLY one
 * source. A radio group picks conta or cartão, only that selector is shown, and
 * the unused id is sent as an explicit `null` — never omitted, never `''` —
 * so a PATCH that switches from a card to an account really clears the card.
 * The category works the same way: the empty option sends `categoryId: null`.
 */

type SourceKind = 'account' | 'card';

interface FormState {
  type: TransactionType;
  value: string;
  date: string;
  sourceKind: SourceKind;
  accountId: string;
  creditCardId: string;
  categoryId: string;
  description: string;
}

type FieldErrors = Partial<Record<'value' | 'date' | 'accountId' | 'creditCardId', string>>;

function initialState(
  transaction: TransactionWithRelations | null,
  initialType: TransactionType = 'expense',
): FormState {
  if (!transaction) {
    return {
      type: initialType,
      value: '',
      date: todayCivil(),
      sourceKind: 'account',
      accountId: '',
      creditCardId: '',
      categoryId: '',
      description: '',
    };
  }

  return {
    type: transaction.type,
    value: moneyToInput(transaction.value),
    date: transaction.date,
    sourceKind: transaction.creditCardId ? 'card' : 'account',
    accountId: transaction.accountId ?? '',
    creditCardId: transaction.creditCardId ?? '',
    categoryId: transaction.categoryId ?? '',
    description: transaction.description ?? '',
  };
}

export interface TransactionFormDialogProps {
  /** `null` creates; a transaction edits it. */
  transaction: TransactionWithRelations | null;
  /** Optional shortcut used by dashboard “Nova receita/despesa” actions. */
  initialType?: TransactionType;
  onClose: () => void;
}

export function TransactionFormDialog({ transaction, initialType = 'expense', onClose }: TransactionFormDialogProps) {
  const isEdit = transaction !== null;
  const {
    accounts,
    creditCards,
    categories,
    isPending: referencesPending,
    isError: referencesError,
    refetch: retryReferences,
  } = useTransactionReferences();
  const { create, update } = useTransactionMutations();
  const toast = useToast();

  const baseId = useId();
  const formId = `${baseId}-form`;
  const originHintId = `${baseId}-origin-hint`;
  const formRef = useRef<HTMLFormElement>(null);

  const [form, setForm] = useState<FormState>(() => initialState(transaction, initialType));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitDetails, setSubmitDetails] = useState<string[]>([]);

  const pending = create.isPending || update.isPending;

  const availableCategories = useMemo(
    () => categoryOptions(categories, form.type, transaction?.categoryId),
    [categories, form.type, transaction?.categoryId],
  );

  // Switching income <-> expense can strand a category that no longer applies.
  useEffect(() => {
    if (!form.categoryId) return;
    if (availableCategories.some((category) => category.id === form.categoryId)) return;
    setForm((current) => ({ ...current, categoryId: '' }));
  }, [availableCategories, form.categoryId]);

  function patch(changes: Partial<FormState>) {
    setForm((current) => ({ ...current, ...changes }));
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};

    const parsed = parseMoneyInput(form.value);
    if (parsed === null) errors.value = 'Informe um valor numérico, por exemplo 1.234,56.';
    else if (parsed <= 0) errors.value = 'O valor precisa ser maior que zero.';

    if (!isCivilDate(form.date)) errors.date = 'Informe uma data válida.';

    if (form.sourceKind === 'account' && !form.accountId) errors.accountId = 'Selecione a conta.';
    if (form.sourceKind === 'card' && !form.creditCardId) errors.creditCardId = 'Selecione o cartão.';

    return errors;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSubmitDetails([]);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      // Move keyboard focus to the first control that failed, after the
      // re-render that stamps `aria-invalid` on it.
      requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
      return;
    }

    const payload: CreateTransactionRequest = {
      type: form.type,
      value: parseMoneyInput(form.value) as number,
      date: form.date,
      // Exactly one source: the other is an explicit null, which is what clears
      // it server-side. `undefined` would leave the old relation in place.
      accountId: form.sourceKind === 'account' ? form.accountId : null,
      creditCardId: form.sourceKind === 'card' ? form.creditCardId : null,
      categoryId: form.categoryId || null,
      description: form.description.trim() || null,
    };

    try {
      if (transaction) {
        await update.mutateAsync({ id: transaction.id, body: payload });
        toast.success('Transação atualizada.');
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch (error) {
      // The form stays open with the reason visible; the toast fired in the
      // mutation hook can auto-dismiss without taking the message with it.
      setSubmitError(errorMessage(error));
      setSubmitDetails(errorDetails(error));
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={isEdit ? 'Editar transação' : 'Nova transação'}
      size="lg"
      footer={
        <>
          <p className="mr-auto max-w-64 text-xs text-muted-foreground">
            Ao trocar a origem, o vínculo anterior é removido.
          </p>
          <ActionButton variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </ActionButton>
          <ActionButton
            type="submit"
            form={formId}
            loading={pending}
            disabled={pending || referencesPending || referencesError}
          >
            {isEdit ? 'Salvar alterações' : 'Salvar transação'}
          </ActionButton>
        </>
      }
    >
      <form ref={formRef} id={formId} onSubmit={handleSubmit} noValidate className="space-y-5">
        {referencesError ? (
          <div role="alert" className="rounded-xl border border-warning/60 bg-layer02 p-3 text-sm text-warning-text">
            Não foi possível carregar contas, cartões e categorias.{' '}
            <button type="button" className="underline" onClick={retryReferences}>
              Tentar novamente
            </button>
          </div>
        ) : null}
        {submitError ? (
          <div role="alert" className="rounded-xl border border-danger/60 bg-layer02 p-3">
            <p className="text-sm font-semibold text-danger-text">Não foi possível salvar</p>
            <p className="mt-1 text-sm text-muted-foreground">{submitError}</p>
            {submitDetails.length > 0 ? (
              <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                {submitDetails.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Valor" required error={fieldErrors.value}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={form.value}
                className="bg-layer00"
                onChange={(event) => patch({ value: event.target.value })}
              />
            )}
          </Field>
          <Field label="Data" required error={fieldErrors.date}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                type="date"
                value={form.date}
                className="bg-layer00"
                onChange={(event) => patch({ date: event.target.value })}
              />
            )}
          </Field>
          <Field label="Tipo" required>
            {({ id }) => (
              <Select
                id={id}
                value={form.type}
                className="bg-layer00"
                onChange={(event) => patch({ type: event.target.value as TransactionType })}
              >
                {TRANSACTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {TRANSACTION_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoria">
            {({ id }) => (
              <Select
                id={id}
                value={form.categoryId}
                className="bg-layer00"
                disabled={referencesPending}
                onChange={(event) => patch({ categoryId: event.target.value })}
              >
                <option value="">Sem categoria</option>
                {availableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <fieldset className="min-w-0">
            <legend className="mb-1.5 text-sm font-medium">Origem · escolha uma</legend>
            <p id={originHintId} className="sr-only">
              Uma transação pertence a uma conta ou a um cartão.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { kind: 'account', label: 'Conta' },
                  { kind: 'card', label: 'Cartão' },
                ] as const
              ).map(({ kind, label }) => (
                <label key={kind} className="relative cursor-pointer">
                  <input
                    type="radio"
                    name={`${baseId}-source`}
                    value={kind}
                    checked={form.sourceKind === kind}
                    aria-describedby={originHintId}
                    onChange={() => patch({ sourceKind: kind, accountId: '', creditCardId: '' })}
                    className="peer sr-only"
                  />
                  <span className="flex min-h-11 items-center justify-center rounded-xl border border-border bg-layer00 text-[14px] text-muted-foreground peer-checked:border-muted-primary/50 peer-checked:bg-muted-primary/20 peer-checked:text-muted-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-muted-primary">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {form.sourceKind === 'account' ? (
            <Field
              label="Conta"
              required
              error={fieldErrors.accountId}
              hint={
                !referencesPending && accounts.length === 0
                  ? 'Cadastre uma conta em Contas e cartões para continuar.'
                  : undefined
              }
            >
              {({ id, describedBy, invalid }) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  value={form.accountId}
                  className="bg-layer00"
                  disabled={referencesPending}
                  onChange={(event) => patch({ accountId: event.target.value })}
                >
                  <option value="">Selecione uma conta</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : (
            <Field
              label="Cartão"
              required
              error={fieldErrors.creditCardId}
              hint={
                !referencesPending && creditCards.length === 0
                  ? 'Cadastre um cartão em Contas e cartões para continuar.'
                  : undefined
              }
            >
              {({ id, describedBy, invalid }) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  value={form.creditCardId}
                  className="bg-layer00"
                  disabled={referencesPending}
                  onChange={(event) => patch({ creditCardId: event.target.value })}
                >
                  <option value="">Selecione um cartão</option>
                  {creditCards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <Field label="Descrição">
            {({ id }) => (
              <TextInput
                id={id}
                maxLength={500}
                value={form.description}
                className="bg-layer00"
                placeholder="Ex.: Mercado"
                onChange={(event) => patch({ description: event.target.value })}
              />
            )}
          </Field>
        </div>
      </form>
    </Dialog>
  );
}
