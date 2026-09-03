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
import { ActionButton, Field, Select, TextArea, TextInput } from '@/shared/ui/form';
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
      description={
        isEdit
          ? 'Altere os dados do lançamento. A origem pode ser trocada entre conta e cartão.'
          : 'Registre uma receita ou despesa em uma conta ou em um cartão.'
      }
      size="lg"
      footer={
        <>
          <ActionButton variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </ActionButton>
          <ActionButton
            type="submit"
            form={formId}
            loading={pending}
            disabled={pending || referencesPending || referencesError}
          >
            {isEdit ? 'Salvar alterações' : 'Criar transação'}
          </ActionButton>
        </>
      }
    >
      <form ref={formRef} id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {referencesError ? (
          <div role="alert" className="rounded-lg border border-warning/60 bg-layer02 p-3 text-sm text-warning-text">
            Não foi possível carregar todas as contas, cartões e categorias. Feche e tente novamente antes de enviar o
            lançamento.
          </div>
        ) : null}

        {submitError ? (
          <div role="alert" className="rounded-lg border border-danger/60 bg-layer02 p-3">
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tipo" required>
            {({ id, describedBy }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={form.type}
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

          <Field
            label="Valor"
            required
            hint="Em reais. Use vírgula para os centavos: 1.234,56."
            error={fieldErrors.value}
          >
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={form.value}
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
                onChange={(event) => patch({ date: event.target.value })}
              />
            )}
          </Field>

          <Field label="Categoria" hint="Opcional. Deixe em “Sem categoria” para classificar depois.">
            {({ id, describedBy }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={form.categoryId}
                onChange={(event) => patch({ categoryId: event.target.value })}
                disabled={referencesPending}
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
        </div>

        <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <legend className="px-1 text-sm font-medium text-foreground">
            Origem
            <span className="ml-1 text-danger-text" aria-hidden="true">
              *
            </span>
            <span className="sr-only"> (obrigatório)</span>
          </legend>
          <p id={originHintId} className="text-xs text-muted-foreground">
            Uma transação pertence a uma conta ou a um cartão — nunca aos dois.
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { kind: 'account', label: 'Conta' },
                { kind: 'card', label: 'Cartão' },
              ] as const
            ).map(({ kind, label }) => (
              <label
                key={kind}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                  form.sourceKind === kind
                    ? 'border-muted-primary bg-layer03 text-foreground'
                    : 'border-border-strong bg-layer02 text-muted-foreground hover:bg-layer03'
                }`}
              >
                <input
                  type="radio"
                  name={`${baseId}-source`}
                  value={kind}
                  checked={form.sourceKind === kind}
                  aria-describedby={originHintId}
                  onChange={() => patch({ sourceKind: kind })}
                  className="size-4 accent-primary"
                />
                {label}
              </label>
            ))}
          </div>

          {form.sourceKind === 'account' ? (
            <Field
              label="Conta"
              required
              error={fieldErrors.accountId}
              hint={
                !referencesPending && accounts.length === 0
                  ? 'Nenhuma conta ativa. Cadastre uma conta antes de lançar por conta.'
                  : undefined
              }
            >
              {({ id, describedBy, invalid }) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  value={form.accountId}
                  onChange={(event) => patch({ accountId: event.target.value })}
                  disabled={referencesPending}
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
                  ? 'Nenhum cartão ativo. Cadastre um cartão antes de lançar por cartão.'
                  : undefined
              }
            >
              {({ id, describedBy, invalid }) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  value={form.creditCardId}
                  onChange={(event) => patch({ creditCardId: event.target.value })}
                  disabled={referencesPending}
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
        </fieldset>

        <Field label="Descrição" hint="Opcional. Ajuda a reconhecer o lançamento depois.">
          {({ id, describedBy }) => (
            <TextArea
              id={id}
              aria-describedby={describedBy}
              rows={2}
              maxLength={255}
              value={form.description}
              onChange={(event) => patch({ description: event.target.value })}
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}
