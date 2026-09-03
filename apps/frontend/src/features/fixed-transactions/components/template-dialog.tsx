'use client';

import type {
  CreateFixedTransactionRequest,
  FixedTransaction,
  FixedTransactionType,
  UpdateFixedTransactionRequest,
} from '@finance/contracts';
import { useEffect, useId, useState } from 'react';
import { errorDetails, errorMessage } from '@/shared/lib/api';
import { CATEGORY_TYPE_LABELS, TRANSACTION_TYPE_LABELS } from '@/shared/lib/format';
import { Dialog } from '@/shared/ui/dialog';
import { ActionButton, Field, Select, TextInput } from '@/shared/ui/form';
import { parseIntegerInput, parseMoneyInput, toMoneyInput } from '../helpers';
import type { SourceLookups } from '../lookups';
import type { FixedTransactionMutations } from '../mutations';
import { Callout } from './atoms';

/**
 * Create / edit dialog for a recurring template.
 *
 * The rule the form exists to enforce: a template is booked to an account OR to
 * a credit card, never to both and never to neither. The radio picks one; the
 * other side is sent as an explicit `null`, which is what clears it server-side
 * (`undefined` would leave the old value in place on a PATCH).
 */

type SourceKind = 'account' | 'creditCard';

interface FormState {
  description: string;
  type: FixedTransactionType;
  value: string;
  referenceDay: string;
  marginDays: string;
  categoryId: string;
  sourceKind: SourceKind;
  accountId: string;
  creditCardId: string;
}

const EMPTY_FORM: FormState = {
  description: '',
  type: 'expense',
  value: '',
  referenceDay: '1',
  marginDays: '0',
  categoryId: '',
  sourceKind: 'account',
  accountId: '',
  creditCardId: '',
};

function toFormState(template: FixedTransaction): FormState {
  return {
    description: template.description ?? '',
    type: template.type,
    value: toMoneyInput(template.value),
    referenceDay: String(template.referenceDay),
    marginDays: String(template.marginDays),
    categoryId: template.categoryId,
    sourceKind: template.creditCardId ? 'creditCard' : 'account',
    accountId: template.accountId ?? '',
    creditCardId: template.creditCardId ?? '',
  };
}

type FormErrors = Partial<Record<keyof FormState, string>>;

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};

  if (form.description.trim() === '') {
    errors.description = 'Informe uma descrição para identificar o modelo.';
  }

  const value = parseMoneyInput(form.value);
  if (value === null) errors.value = 'Informe um valor válido, por exemplo 1.250,00.';
  else if (value <= 0) errors.value = 'O valor deve ser maior que zero.';

  const referenceDay = parseIntegerInput(form.referenceDay);
  if (referenceDay === null || referenceDay < 1 || referenceDay > 31) {
    errors.referenceDay = 'Informe um dia entre 1 e 31.';
  }

  const marginDays = parseIntegerInput(form.marginDays);
  if (marginDays === null || marginDays > 15) {
    errors.marginDays = 'Informe uma margem entre 0 e 15 dias.';
  }

  if (form.categoryId === '') errors.categoryId = 'Escolha uma categoria.';

  if (form.sourceKind === 'account' && form.accountId === '') {
    errors.accountId = 'Escolha a conta que será usada.';
  }
  if (form.sourceKind === 'creditCard' && form.creditCardId === '') {
    errors.creditCardId = 'Escolha o cartão que será usado.';
  }

  return errors;
}

export function TemplateDialog({
  open,
  onClose,
  template,
  lookups,
  mutations,
}: {
  open: boolean;
  onClose: () => void;
  /** `null` creates a new template; a value edits that one. */
  template: FixedTransaction | null;
  lookups: SourceLookups;
  mutations: FixedTransactionMutations;
}) {
  const formId = useId();
  const sourceName = useId();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  const isEditing = template !== null;
  const mutation = isEditing ? mutations.update : mutations.create;
  const { reset } = mutation;

  // Reload the form (and drop any stale server error) every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setForm(template ? toFormState(template) : EMPTY_FORM);
    setErrors({});
    reset();
  }, [open, template, reset]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    // `validate` already proved these parse; the `?? 0` only satisfies the type.
    const body: CreateFixedTransactionRequest = {
      type: form.type,
      value: parseMoneyInput(form.value) ?? 0,
      referenceDay: parseIntegerInput(form.referenceDay) ?? 1,
      marginDays: parseIntegerInput(form.marginDays) ?? 0,
      categoryId: form.categoryId,
      description: form.description.trim(),
      // Exactly one source: the unused side is explicitly cleared.
      accountId: form.sourceKind === 'account' ? form.accountId : null,
      creditCardId: form.sourceKind === 'creditCard' ? form.creditCardId : null,
    };

    if (isEditing && template) {
      const patch: UpdateFixedTransactionRequest = body;
      mutations.update.mutate({ id: template.id, body: patch }, { onSuccess: onClose });
    } else {
      mutations.create.mutate(body, { onSuccess: onClose });
    }
  }

  // Categories are typed income / expense / both. Offer the compatible ones, but
  // never hide the one already saved — that would silently rewrite the template.
  const categoryOptions = lookups.categories.filter(
    (category) => category.type === form.type || category.type === 'both' || category.id === form.categoryId,
  );

  const accountMissing = form.accountId !== '' && !lookups.accounts.some((a) => a.id === form.accountId);
  const cardMissing = form.creditCardId !== '' && !lookups.creditCards.some((c) => c.id === form.creditCardId);

  const serverError = mutation.isError ? errorMessage(mutation.error) : null;
  const serverDetails = mutation.isError ? errorDetails(mutation.error) : [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={isEditing ? 'Editar modelo recorrente' : 'Novo modelo recorrente'}
      description={
        isEditing
          ? 'As alterações valem apenas para as ocorrências futuras. O histórico já confirmado permanece intacto.'
          : 'O modelo gera uma ocorrência por mês, que você confirma ou pula.'
      }
      footer={
        <>
          <ActionButton variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </ActionButton>
          <ActionButton type="submit" form={formId} loading={mutation.isPending}>
            {isEditing ? 'Salvar alterações' : 'Criar modelo'}
          </ActionButton>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {serverError ? (
          <div role="alert" className="rounded-lg border border-danger/60 bg-layer02 p-3">
            <p className="text-sm font-medium text-danger-text">{serverError}</p>
            {serverDetails.length > 0 ? (
              <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                {serverDetails.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {lookups.isError ? (
          <p role="alert" className="text-sm text-danger-text">
            Não foi possível carregar contas, cartões e categorias. Feche e tente novamente.
          </p>
        ) : null}

        <Field label="Descrição" required error={errors.description}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              value={form.description}
              maxLength={120}
              autoComplete="off"
              placeholder="Ex.: Aluguel"
              onChange={(event) => set('description', event.target.value)}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo" required error={errors.type}>
            {({ id, describedBy, invalid }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                value={form.type}
                onChange={(event) => set('type', event.target.value as FixedTransactionType)}
              >
                <option value="expense">{TRANSACTION_TYPE_LABELS.expense}</option>
                <option value="income">{TRANSACTION_TYPE_LABELS.income}</option>
              </Select>
            )}
          </Field>

          <Field label="Valor" required error={errors.value} hint="Use vírgula para os centavos. Ex.: 1.250,00">
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                inputMode="decimal"
                autoComplete="off"
                value={form.value}
                placeholder="0,00"
                onChange={(event) => set('value', event.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Dia de referência"
            required
            error={errors.referenceDay}
            hint="Entre 1 e 31. Os dias 29, 30 e 31 são ajustados para o último dia em meses mais curtos."
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
                inputMode="numeric"
                value={form.referenceDay}
                onChange={(event) => set('referenceDay', event.target.value)}
              />
            )}
          </Field>

          <Field
            label="Margem (dias)"
            required
            error={errors.marginDays}
            hint="Entre 0 e 15. Quantos dias antes ou depois do dia de referência a ocorrência pode ser lançada."
          >
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                type="number"
                min={0}
                max={15}
                step={1}
                inputMode="numeric"
                value={form.marginDays}
                onChange={(event) => set('marginDays', event.target.value)}
              />
            )}
          </Field>
        </div>

        <Field
          label="Categoria"
          required
          error={errors.categoryId}
          hint={lookups.isPending ? 'Carregando categorias…' : undefined}
        >
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              value={form.categoryId}
              onChange={(event) => set('categoryId', event.target.value)}
            >
              <option value="">Selecione uma categoria</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} · {CATEGORY_TYPE_LABELS[category.type] ?? category.type}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <legend className="px-1 text-sm font-medium text-foreground">Origem do lançamento</legend>
          <p className="text-xs text-muted-foreground">
            Escolha exatamente uma origem. A outra é limpa automaticamente.
          </p>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="radio"
                name={sourceName}
                value="account"
                checked={form.sourceKind === 'account'}
                onChange={() => set('sourceKind', 'account')}
                className="size-4 accent-primary"
              />
              Conta
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="radio"
                name={sourceName}
                value="creditCard"
                checked={form.sourceKind === 'creditCard'}
                onChange={() => set('sourceKind', 'creditCard')}
                className="size-4 accent-primary"
              />
              Cartão
            </label>
          </div>

          {form.sourceKind === 'account' ? (
            <Field label="Conta" required error={errors.accountId}>
              {({ id, describedBy, invalid }) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  value={form.accountId}
                  onChange={(event) => set('accountId', event.target.value)}
                >
                  <option value="">Selecione uma conta</option>
                  {accountMissing ? <option value={form.accountId}>Conta indisponível (arquivada)</option> : null}
                  {lookups.accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · {account.institution}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : (
            <Field label="Cartão" required error={errors.creditCardId}>
              {({ id, describedBy, invalid }) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  value={form.creditCardId}
                  onChange={(event) => set('creditCardId', event.target.value)}
                >
                  <option value="">Selecione um cartão</option>
                  {cardMissing ? <option value={form.creditCardId}>Cartão indisponível (arquivado)</option> : null}
                  {lookups.creditCards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name} · {card.institution}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
        </fieldset>

        <Callout>
          Alterar um modelo afeta apenas as ocorrências futuras. As ocorrências já confirmadas e os lançamentos criados
          por elas permanecem exatamente como estão.
        </Callout>
      </form>
    </Dialog>
  );
}
