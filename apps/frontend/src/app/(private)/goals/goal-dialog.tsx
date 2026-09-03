'use client';

import {
  type CreateGoalRequest,
  GOAL_TYPES,
  type Goal,
  type GoalType,
  isCivilDate,
  roundMoney,
} from '@finance/contracts';
import { useEffect, useId, useState } from 'react';
import { parseDecimal, toDecimalInput } from '@/features/goals/decimal';
import { useCreateGoalMutation, useUpdateGoalMutation } from '@/features/goals/mutations';
import { useGoalAccountOptionsQuery, useGoalCategoryOptionsQuery } from '@/features/goals/queries';
import { errorDetails, errorMessage } from '@/shared/lib/api';
import { GOAL_TYPE_LABELS } from '@/shared/lib/format';
import { Dialog } from '@/shared/ui/dialog';
import { ActionButton, Field, Select, TextInput } from '@/shared/ui/form';
import { useToast } from '@/shared/ui/toast';

/**
 * Create / edit a goal.
 *
 * Every optional relation clears with an explicit `null` — `undefined` would be
 * a no-op under PATCH semantics and `''` is not a valid id — so choosing the
 * blank option genuinely detaches the category, the account or the deadline.
 */

interface FormState {
  name: string;
  type: GoalType;
  targetAmount: string;
  currentAmount: string;
  deadline: string;
  relatedCategoryId: string;
  relatedAccountId: string;
}

type FieldErrors = Partial<Record<'name' | 'targetAmount' | 'currentAmount' | 'deadline', string>>;

function blankForm(): FormState {
  return {
    name: '',
    type: 'saving',
    targetAmount: '',
    currentAmount: '0',
    deadline: '',
    relatedCategoryId: '',
    relatedAccountId: '',
  };
}

function formFor(goal: Goal): FormState {
  return {
    name: goal.name,
    type: goal.type,
    targetAmount: toDecimalInput(goal.targetAmount),
    currentAmount: toDecimalInput(goal.currentAmount),
    deadline: goal.deadline ?? '',
    relatedCategoryId: goal.relatedCategoryId ?? '',
    relatedAccountId: goal.relatedAccountId ?? '',
  };
}

const REFERENCE_HINT = 'Apenas referência — não afeta o progresso, que continua sendo informado por você.';

export function GoalDialog({ open, onClose, goal }: { open: boolean; onClose: () => void; goal: Goal | null }) {
  const toast = useToast();
  const formId = useId();
  const [form, setForm] = useState<FormState>(blankForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitDetails, setSubmitDetails] = useState<string[]>([]);

  const categoriesQuery = useGoalCategoryOptionsQuery();
  const accountsQuery = useGoalAccountOptionsQuery();
  const createGoal = useCreateGoalMutation();
  const updateGoal = useUpdateGoalMutation();

  const pending = createGoal.isPending || updateGoal.isPending;

  useEffect(() => {
    if (!open) return;
    setForm(goal ? formFor(goal) : blankForm());
    setFieldErrors({});
    setSubmitError(null);
    setSubmitDetails([]);
  }, [open, goal]);

  function patch(changes: Partial<FormState>) {
    setForm((current) => ({ ...current, ...changes }));
  }

  const targetAmount = parseDecimal(form.targetAmount);
  const currentAmount = parseDecimal(form.currentAmount);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};

    if (!form.name.trim()) errors.name = 'Informe o nome da meta.';

    if (targetAmount === null) errors.targetAmount = 'Informe o valor alvo.';
    else if (targetAmount <= 0) errors.targetAmount = 'O valor alvo precisa ser maior que zero.';

    if (form.currentAmount.trim() && currentAmount === null) {
      errors.currentAmount = 'Informe um valor atual válido.';
    } else if (currentAmount !== null && currentAmount < 0) {
      errors.currentAmount = 'O valor atual não pode ser negativo.';
    }

    if (form.deadline && !isCivilDate(form.deadline)) errors.deadline = 'Informe um prazo válido.';

    return errors;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSubmitDetails([]);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload: CreateGoalRequest = {
      name: form.name.trim(),
      type: form.type,
      targetAmount: roundMoney(targetAmount ?? 0),
      currentAmount: roundMoney(currentAmount ?? 0),
      deadline: form.deadline ? form.deadline : null,
      relatedCategoryId: form.relatedCategoryId ? form.relatedCategoryId : null,
      relatedAccountId: form.relatedAccountId ? form.relatedAccountId : null,
    };

    try {
      if (goal) await updateGoal.mutateAsync({ id: goal.id, body: payload });
      else await createGoal.mutateAsync(payload);
      onClose();
    } catch (error) {
      setSubmitError(errorMessage(error));
      setSubmitDetails(errorDetails(error));
      toast.error(errorMessage(error));
    }
  }

  const categories = categoriesQuery.data?.data ?? [];
  const accounts = accountsQuery.data?.data ?? [];

  return (
    <Dialog
      open={open}
      onClose={pending ? () => undefined : onClose}
      title={goal ? 'Editar meta' : 'Nova meta'}
      description="O progresso desta meta é sempre o valor que você informa. O app não o calcula a partir das suas transações."
      size="lg"
      footer={
        <>
          <ActionButton variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </ActionButton>
          <ActionButton type="submit" form={formId} loading={pending} disabled={pending}>
            {goal ? 'Salvar alterações' : 'Criar meta'}
          </ActionButton>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {submitError ? (
          <div role="alert" className="rounded-lg border border-danger/60 bg-layer02 p-3">
            <p className="text-sm font-medium text-danger-text">{submitError}</p>
            {submitDetails.length > 0 ? (
              <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                {submitDetails.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <Field label="Nome" required error={fieldErrors.name}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              disabled={pending}
              autoComplete="off"
              placeholder="Ex.: Reserva de emergência"
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo" required>
            {({ id, describedBy }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={form.type}
                onChange={(e) => patch({ type: e.target.value as GoalType })}
                disabled={pending}
              >
                {GOAL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {GOAL_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Prazo" hint="Opcional. Deixe em branco para remover o prazo." error={fieldErrors.deadline}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                type="date"
                value={form.deadline}
                onChange={(e) => patch({ deadline: e.target.value })}
                disabled={pending}
              />
            )}
          </Field>

          <Field label="Valor alvo (R$)" required error={fieldErrors.targetAmount}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                inputMode="decimal"
                value={form.targetAmount}
                onChange={(e) => patch({ targetAmount: e.target.value })}
                disabled={pending}
                autoComplete="off"
                placeholder="0,00"
              />
            )}
          </Field>

          <Field
            label="Valor atual (R$)"
            hint="Quanto você já juntou. Este número é seu — o app não o recalcula."
            error={fieldErrors.currentAmount}
          >
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                inputMode="decimal"
                value={form.currentAmount}
                onChange={(e) => patch({ currentAmount: e.target.value })}
                disabled={pending}
                autoComplete="off"
                placeholder="0,00"
              />
            )}
          </Field>
        </div>

        <fieldset className="flex flex-col gap-4 rounded-lg border border-border bg-layer02/50 p-3">
          <legend className="px-1 text-sm font-medium text-foreground">Referências opcionais</legend>
          <p className="text-xs text-muted-foreground">{REFERENCE_HINT}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Categoria relacionada"
              hint={
                categoriesQuery.isError
                  ? 'Não foi possível carregar as categorias. Você ainda pode salvar a meta sem categoria.'
                  : 'Opcional.'
              }
            >
              {({ id, describedBy }) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  value={form.relatedCategoryId}
                  onChange={(e) => patch({ relatedCategoryId: e.target.value })}
                  disabled={pending || categoriesQuery.isPending}
                >
                  <option value="">Sem categoria</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field
              label="Conta relacionada"
              hint={
                accountsQuery.isError
                  ? 'Não foi possível carregar as contas. Você ainda pode salvar a meta sem conta.'
                  : 'Opcional.'
              }
            >
              {({ id, describedBy }) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  value={form.relatedAccountId}
                  onChange={(e) => patch({ relatedAccountId: e.target.value })}
                  disabled={pending || accountsQuery.isPending}
                >
                  <option value="">Sem conta</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
