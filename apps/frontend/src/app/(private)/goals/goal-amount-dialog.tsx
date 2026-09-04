'use client';

import type { Goal } from '@finance/contracts';
import { useEffect, useId, useState } from 'react';
import { parseDecimal, toDecimalInput } from '@/features/goals/decimal';
import { useUpdateGoalAmountMutation } from '@/features/goals/mutations';
import { errorDetails, errorMessage } from '@/shared/lib/api';
import { formatCivilDate, formatMoney, formatPercent, todayCivil } from '@/shared/lib/format';
import { Dialog } from '@/shared/ui/dialog';
import { ActionButton, Field, TextInput } from '@/shared/ui/form';
import { useToast } from '@/shared/ui/toast';

export function GoalAmountDialog({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const formId = useId();
  const toast = useToast();
  const updateAmount = useUpdateGoalAmountMutation();
  const [value, setValue] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitDetails, setSubmitDetails] = useState<string[]>([]);

  useEffect(() => {
    if (!goal) return;
    setValue(toDecimalInput(goal.currentAmount));
    setFieldError(undefined);
    setSubmitError(null);
    setSubmitDetails([]);
  }, [goal]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!goal) return;

    const parsed = parseDecimal(value);
    if (parsed === null || parsed < 0) {
      setFieldError('Informe um valor igual ou maior que zero.');
      return;
    }

    setFieldError(undefined);
    setSubmitError(null);
    setSubmitDetails([]);

    try {
      await updateAmount.mutateAsync({ id: goal.id, currentAmount: parsed });
      onClose();
    } catch (error) {
      const message = errorMessage(error);
      setSubmitError(message);
      setSubmitDetails(errorDetails(error));
      toast.error(message);
    }
  }

  return (
    <Dialog
      open={goal !== null}
      onClose={updateAmount.isPending ? () => undefined : onClose}
      title="Atualizar progresso"
      size="lg"
      footer={
        <>
          <ActionButton variant="secondary" onClick={onClose} disabled={updateAmount.isPending}>
            Cancelar
          </ActionButton>
          <ActionButton type="submit" form={formId} loading={updateAmount.isPending} disabled={updateAmount.isPending}>
            Atualizar
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

        {goal ? (
          <div className="rounded-xl border border-border bg-primary/10 p-4 text-sm">
            <p className="font-semibold">{goal.name}</p>
            <p className="mt-2 text-muted-primary">
              Atual: {formatPercent(goal.progress)} · {formatMoney(goal.currentAmount)}
            </p>
          </div>
        ) : null}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Novo valor guardado (R$)" required error={fieldError}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                disabled={updateAmount.isPending}
                autoComplete="off"
                placeholder="0,00"
              />
            )}
          </Field>
          <div>
            <p className="text-sm font-medium">Data da atualização</p>
            <p className="mt-1.5 min-h-11 rounded-xl border border-border bg-layer02 px-3.5 py-2.5 text-sm">
              {formatCivilDate(todayCivil())}
            </p>
          </div>
        </div>
        <p className="rounded-xl border border-border bg-primary/10 p-4 text-sm text-muted-primary">
          Registro manual: esta ação não altera contas ou transações.
        </p>
      </form>
    </Dialog>
  );
}
