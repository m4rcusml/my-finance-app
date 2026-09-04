'use client';

import type { OccurrenceWithTemplate } from '@finance/contracts';
import { useEffect, useId, useState } from 'react';
import { ApiError, errorDetails, errorMessage } from '@/shared/lib/api';
import { formatCivilDate, formatMoney } from '@/shared/lib/format';
import { Dialog } from '@/shared/ui/dialog';
import { ActionButton, Field, TextInput } from '@/shared/ui/form';
import { isCivilDateInput, parseMoneyInput, toMoneyInput } from '../helpers';
import type { ConfirmOccurrenceVariables } from '../mutations';

/**
 * Confirming an occurrence.
 *
 * The date is the user's answer to "when did this actually happen?", not the
 * instant they clicked the button — so it is a real `<input type="date">`
 * pre-filled with the nominal `dueDate`, and nothing is auto-confirmed with
 * `new Date()`. The value is optional and overrides the template amount for
 * this period only.
 */

interface ConfirmMutationLike {
  mutate: (variables: ConfirmOccurrenceVariables, options?: { onSuccess?: () => void }) => void;
  reset: () => void;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
}

export function ConfirmOccurrenceDialog({
  open,
  onClose,
  occurrence,
  mutation,
  onSkip,
}: {
  open: boolean;
  onClose: () => void;
  occurrence: OccurrenceWithTemplate | null;
  mutation: ConfirmMutationLike;
  onSkip?: () => void;
}) {
  const formId = useId();
  const [realDate, setRealDate] = useState('');
  const [value, setValue] = useState('');
  const [dateError, setDateError] = useState<string | undefined>();
  const [valueError, setValueError] = useState<string | undefined>();

  const { reset } = mutation;

  useEffect(() => {
    if (!open || !occurrence) return;
    // The nominal due day is the honest default; the user overrides it if the
    // money actually moved on another day.
    setRealDate(occurrence.dueDate);
    setValue(toMoneyInput(occurrence.value));
    setDateError(undefined);
    setValueError(undefined);
    reset();
  }, [open, occurrence, reset]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!occurrence) return;

    if (!isCivilDateInput(realDate)) {
      setDateError('Informe a data real no formato dia/mês/ano.');
      return;
    }

    let override: number | undefined;
    if (value.trim() !== '') {
      const parsed = parseMoneyInput(value);
      if (parsed === null || parsed <= 0) {
        setValueError('Informe um valor válido maior que zero, ou deixe em branco.');
        return;
      }
      override = parsed;
    }

    setDateError(undefined);
    setValueError(undefined);
    mutation.mutate({ id: occurrence.id, realDate, value: override }, { onSuccess: onClose });
  }

  const conflict = mutation.error instanceof ApiError && mutation.error.isConflict;
  const serverError = mutation.isError ? errorMessage(mutation.error) : null;
  const serverDetails = mutation.isError ? errorDetails(mutation.error) : [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Confirmar ocorrência"
      size="lg"
      footer={
        <>
          <ActionButton variant="secondary" onClick={onSkip ?? onClose} disabled={mutation.isPending}>
            {onSkip ? 'Ignorar' : 'Cancelar'}
          </ActionButton>
          <ActionButton type="submit" form={formId} loading={mutation.isPending} disabled={!occurrence}>
            Confirmar agora
          </ActionButton>
        </>
      }
    >
      {occurrence ? (
        <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {serverError ? (
            <div role="alert" className="rounded-lg border border-danger/60 bg-layer02 p-3">
              <p className="text-sm font-medium text-danger-text">{serverError}</p>
              {conflict ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  A lista foi atualizada com o estado real desta ocorrência.
                </p>
              ) : null}
              {serverDetails.length > 0 ? (
                <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                  {serverDetails.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <p className="rounded-xl border border-border bg-primary/10 p-4 text-sm text-muted-primary">
            {occurrence.description?.trim() || occurrence.fixedTransaction.description?.trim() || 'Sem descrição'} ·
            previsto para {formatCivilDate(occurrence.dueDate)} · {formatMoney(occurrence.value)}
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Data real" required error={dateError}>
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  type="date"
                  value={realDate}
                  onChange={(event) => {
                    setRealDate(event.target.value);
                    setDateError(undefined);
                  }}
                />
              )}
            </Field>

            <Field label="Valor real" error={valueError}>
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  inputMode="decimal"
                  autoComplete="off"
                  value={value}
                  placeholder={toMoneyInput(occurrence.value)}
                  onChange={(event) => {
                    setValue(event.target.value);
                    setValueError(undefined);
                  }}
                />
              )}
            </Field>
          </div>
          <p className="rounded-xl border border-warning/30 bg-warning/15 p-4 text-sm text-warning-text">
            Confirmar cria um lançamento. Se outra sessão confirmar primeiro, nenhum lançamento será duplicado.
          </p>
        </form>
      ) : null}
    </Dialog>
  );
}
