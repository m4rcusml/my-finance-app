'use client';

import type { OccurrenceWithTemplate } from '@finance/contracts';
import { useEffect, useId, useState } from 'react';
import { ApiError, errorDetails, errorMessage } from '@/shared/lib/api';
import { formatCivilDate, formatMoney } from '@/shared/lib/format';
import { Dialog } from '@/shared/ui/dialog';
import { ActionButton, Field, TextInput } from '@/shared/ui/form';
import { isCivilDateInput, parseMoneyInput, periodLabel, toMoneyInput } from '../helpers';
import type { ConfirmOccurrenceVariables } from '../mutations';
import { Callout } from './atoms';

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
  mutate: (
    variables: ConfirmOccurrenceVariables,
    options?: { onSuccess?: () => void },
  ) => void;
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
}: {
  open: boolean;
  onClose: () => void;
  occurrence: OccurrenceWithTemplate | null;
  mutation: ConfirmMutationLike;
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
    setValue('');
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
      description="Confirmar cria um lançamento vinculado a esta ocorrência, com a data e o valor informados abaixo."
      footer={
        <>
          <ActionButton variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </ActionButton>
          <ActionButton type="submit" form={formId} loading={mutation.isPending} disabled={!occurrence}>
            Confirmar
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

          <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-layer02 p-3 text-sm">
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">Modelo</dt>
              <dd className="font-medium text-foreground">
                {occurrence.fixedTransaction.description?.trim() ||
                  occurrence.description?.trim() ||
                  'Sem descrição'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Período</dt>
              <dd className="text-foreground">{periodLabel(occurrence.periodYear, occurrence.periodMonth)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Vencimento</dt>
              <dd className="text-foreground">{formatCivilDate(occurrence.dueDate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Valor do modelo</dt>
              <dd className="text-foreground">{formatMoney(occurrence.value)}</dd>
            </div>
          </dl>

          <Field
            label="Data real"
            required
            error={dateError}
            hint="O dia em que o dinheiro realmente entrou ou saiu. Vem preenchido com o vencimento."
          >
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

          <Field
            label="Valor real (opcional)"
            error={valueError}
            hint={`Deixe em branco para usar ${toMoneyInput(occurrence.value)}, o valor do modelo.`}
          >
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

          <Callout>
            A confirmação é definitiva: a ocorrência sai da lista de pendentes e o lançamento passa a contar no
            saldo e no painel.
          </Callout>
        </form>
      ) : null}
    </Dialog>
  );
}
