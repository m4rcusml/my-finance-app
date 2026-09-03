'use client';

import { type Account, type CreditCard, isCivilDate, type OccurrenceWithTemplate } from '@finance/contracts';
import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { useConfirmOccurrence, useSkipOccurrence } from '@/features/dashboard/mutations';
import { parseMoneyInput } from '@/features/transactions/helpers';
import { errorDetails, errorMessage } from '@/shared/lib/api';
import { formatCivilDate, formatMoney, TRANSACTION_TYPE_LABELS } from '@/shared/lib/format';
import { ConfirmDialog, Dialog } from '@/shared/ui/dialog';
import { ActionButton, Field, TextInput } from '@/shared/ui/form';
import { EmptyState } from '@/shared/ui/query-state';
import { DashboardSection } from './dashboard-section';

export function PendingOccurrences({
  occurrences,
  accounts,
  creditCards,
}: {
  occurrences: OccurrenceWithTemplate[];
  accounts: Account[];
  creditCards: CreditCard[];
}) {
  const [confirming, setConfirming] = useState<OccurrenceWithTemplate | null>(null);
  const [skipping, setSkipping] = useState<OccurrenceWithTemplate | null>(null);
  const skipMutation = useSkipOccurrence();

  const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
  const cardNames = new Map(creditCards.map((card) => [card.id, card.name]));

  function confirmSkip() {
    if (!skipping) return;
    skipMutation.mutate({ id: skipping.id }, { onSuccess: () => setSkipping(null) });
  }

  return (
    <DashboardSection
      title="Recorrências pendentes"
      description="Confirme com a data e o valor reais ou pule apenas esta ocorrência."
      action={
        <Link
          href="/fixed-transactions"
          className="rounded-lg border border-border-strong bg-layer02 px-3 py-2 text-sm font-medium text-foreground transition hover:bg-layer03"
        >
          Ver recorrências
        </Link>
      }
    >
      {occurrences.length === 0 ? (
        <EmptyState
          title="Nada pendente neste período"
          message="As ocorrências recorrentes a confirmar aparecerão aqui."
        />
      ) : (
        <ul className="divide-y divide-border">
          {occurrences.map((occurrence) => {
            const origin = occurrence.accountId
              ? (accountNames.get(occurrence.accountId) ?? 'Conta arquivada')
              : occurrence.creditCardId
                ? (cardNames.get(occurrence.creditCardId) ?? 'Cartão arquivado')
                : 'Origem indisponível';

            return (
              <li
                key={occurrence.id}
                className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {occurrence.description?.trim() ||
                      occurrence.fixedTransaction.description?.trim() ||
                      'Sem descrição'}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatCivilDate(occurrence.dueDate)} · {occurrence.category?.name ?? 'Categoria arquivada'} ·{' '}
                    {origin}
                  </p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                    {TRANSACTION_TYPE_LABELS[occurrence.type]} · {formatMoney(occurrence.value)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <ActionButton variant="secondary" className="px-3 py-1.5" onClick={() => setSkipping(occurrence)}>
                    Pular
                    <span className="sr-only"> {occurrence.description || 'ocorrência'}</span>
                  </ActionButton>
                  <ActionButton className="px-3 py-1.5" onClick={() => setConfirming(occurrence)}>
                    Confirmar
                    <span className="sr-only"> {occurrence.description || 'ocorrência'}</span>
                  </ActionButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmOccurrenceDialog occurrence={confirming} onClose={() => setConfirming(null)} />

      <ConfirmDialog
        open={skipping !== null}
        title="Pular ocorrência"
        message={`Pular “${skipping?.description?.trim() || 'esta ocorrência'}” não cria lançamento neste período e não altera os próximos meses.`}
        confirmLabel="Pular ocorrência"
        busy={skipMutation.isPending}
        onConfirm={confirmSkip}
        onCancel={() => {
          setSkipping(null);
          skipMutation.reset();
        }}
      />
    </DashboardSection>
  );
}

function ConfirmOccurrenceDialog({
  occurrence,
  onClose,
}: {
  occurrence: OccurrenceWithTemplate | null;
  onClose: () => void;
}) {
  const formId = useId();
  const [realDate, setRealDate] = useState('');
  const [value, setValue] = useState('');
  const [dateError, setDateError] = useState<string>();
  const [valueError, setValueError] = useState<string>();
  const mutation = useConfirmOccurrence();
  const resetMutation = mutation.reset;

  useEffect(() => {
    if (!occurrence) return;
    setRealDate(occurrence.dueDate);
    setValue('');
    setDateError(undefined);
    setValueError(undefined);
    resetMutation();
  }, [occurrence, resetMutation]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!occurrence) return;

    if (!isCivilDate(realDate)) {
      setDateError('Informe uma data real válida.');
      return;
    }

    const parsedValue = value.trim() ? parseMoneyInput(value) : undefined;
    if (parsedValue === null || (parsedValue !== undefined && parsedValue <= 0)) {
      setValueError('Informe um valor maior que zero ou deixe o campo em branco.');
      return;
    }

    setDateError(undefined);
    setValueError(undefined);
    mutation.mutate({ id: occurrence.id, realDate, value: parsedValue }, { onSuccess: onClose });
  }

  const details = errorDetails(mutation.error);

  return (
    <Dialog
      open={occurrence !== null}
      onClose={onClose}
      title="Confirmar ocorrência"
      description="A confirmação cria um lançamento e é definitiva para esta ocorrência."
      footer={
        <>
          <ActionButton variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </ActionButton>
          <ActionButton type="submit" form={formId} loading={mutation.isPending}>
            Confirmar e lançar
          </ActionButton>
        </>
      }
    >
      {occurrence ? (
        <form id={formId} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
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

          <div className="rounded-lg border border-border bg-layer02 p-3">
            <p className="text-sm font-medium text-foreground">
              {occurrence.description?.trim() || occurrence.fixedTransaction.description?.trim() || 'Sem descrição'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Prevista para {formatCivilDate(occurrence.dueDate)} · {formatMoney(occurrence.value)}
            </p>
          </div>

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

          <Field
            label="Valor real (opcional)"
            hint={`Deixe em branco para usar ${formatMoney(occurrence.value)}.`}
            error={valueError}
          >
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                inputMode="decimal"
                autoComplete="off"
                value={value}
                placeholder={occurrence.value.toFixed(2).replace('.', ',')}
                onChange={(event) => {
                  setValue(event.target.value);
                  setValueError(undefined);
                }}
              />
            )}
          </Field>
        </form>
      ) : null}
    </Dialog>
  );
}
