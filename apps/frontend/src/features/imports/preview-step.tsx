'use client';

import {
  buildPaginationMeta,
  type ConfirmImportResponse,
  type ImportPreviewResponse,
  type ImportPreviewRow,
} from '@finance/contracts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useActiveAccountsQuery } from '@/features/accounts/queries';
import { useActiveCreditCardsQuery } from '@/features/credit-cards/queries';
import { errorMessage } from '@/shared/lib/api';
import {
  IMPORT_ORIGIN_LABELS,
  TRANSACTION_TYPE_LABELS,
  formatCivilDate,
  formatMoney,
} from '@/shared/lib/format';
import { ActionButton, Field, Select } from '@/shared/ui/form';
import { Pagination } from '@/shared/ui/pagination';
import { ErrorState, LoadingState } from '@/shared/ui/query-state';
import { useToast } from '@/shared/ui/toast';
import { IMPORT_FILE_TYPE_LABELS, formatTimestamp, isExpired } from './constants';
import { useConfirmImportMutation } from './mutations';

/**
 * Step 2 — review every parsed row, choose the destination, confirm.
 *
 * Rows that cannot be imported (a parse error, or an `externalId` already in
 * the ledger) are shown with their checkbox disabled AND with the reason
 * spelled out in a visible cell, so "why is this greyed out?" never happens.
 */

export function isImportable(row: ImportPreviewRow): boolean {
  return row.errors.length === 0 && !row.duplicate;
}

type DestinationKind = 'account' | 'creditCard';

export function PreviewStep({
  preview,
  onBack,
  onConfirmed,
}: {
  preview: ImportPreviewResponse;
  onBack: () => void;
  onConfirmed: (result: ConfirmImportResponse) => void;
}) {
  const toast = useToast();
  const confirmImport = useConfirmImportMutation();

  const accounts = useActiveAccountsQuery();
  const creditCards = useActiveCreditCardsQuery();

  const importableRowNumbers = useMemo(
    () => preview.rows.filter(isImportable).map((row) => row.rowNumber),
    [preview.rows],
  );

  const [selected, setSelected] = useState<Set<number>>(() => new Set(importableRowNumbers));
  const [kind, setKind] = useState<DestinationKind>('account');
  const [accountId, setAccountId] = useState('');
  const [creditCardId, setCreditCardId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Re-render on a timer so the "expira em" notice becomes an expiry notice
  // on its own, instead of the user discovering it through a failed confirm.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const expired = isExpired(preview.expiresAt, now);

  const totalPages = Math.max(1, Math.ceil(preview.rows.length / limit));
  const safePage = Math.min(page, totalPages);
  const meta = buildPaginationMeta(preview.rows.length, safePage, limit);
  const visibleRows = preview.rows.slice((safePage - 1) * limit, safePage * limit);

  const allImportableSelected =
    importableRowNumbers.length > 0 && importableRowNumbers.every((n) => selected.has(n));
  const someSelected = selected.size > 0 && !allImportableSelected;

  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  function toggleRow(rowNumber: number) {
    setFormError(null);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }

  function toggleAll() {
    setFormError(null);
    setSelected(allImportableSelected ? new Set<number>() : new Set(importableRowNumbers));
  }

  const destinationId = kind === 'account' ? accountId : creditCardId;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (expired) {
      setFormError('Esta pré-visualização expirou. Volte e envie o arquivo novamente.');
      return;
    }
    if (!destinationId) {
      setFormError(
        kind === 'account'
          ? 'Escolha a conta que vai receber os lançamentos.'
          : 'Escolha o cartão que vai receber os lançamentos.',
      );
      return;
    }
    if (selected.size === 0) {
      setFormError('Selecione ao menos uma linha para importar.');
      return;
    }

    // Rule: the destination that is NOT used is sent as an explicit `null`,
    // never omitted — the server re-validates "exactly one of the two".
    const body =
      kind === 'account'
        ? { accountId: destinationId, creditCardId: null, rowNumbers: sortedRowNumbers(selected) }
        : { accountId: null, creditCardId: destinationId, rowNumbers: sortedRowNumbers(selected) };

    confirmImport.mutate(
      { batchId: preview.batchId, body },
      {
        onSuccess: (result) => {
          toast.success(
            'Importação concluída',
            `${result.imported} lançamento(s) importado(s).`,
          );
          onConfirmed(result);
        },
        onError: (error) => {
          const message = errorMessage(error);
          setFormError(message);
          toast.error('Não foi possível importar', message);
        },
      },
    );
  }

  const noDestinations =
    !accounts.isPending &&
    !accounts.isError &&
    !creditCards.isPending &&
    !creditCards.isError &&
    accounts.accounts.length === 0 &&
    creditCards.creditCards.length === 0;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <section aria-labelledby="import-preview-heading" className="rounded-2xl border border-border bg-layer01 p-4 sm:p-6">
        <h2 id="import-preview-heading" className="text-md font-semibold text-foreground">
          2. Pré-visualização
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="text-foreground">{preview.fileName}</span> ·{' '}
          {IMPORT_FILE_TYPE_LABELS[preview.fileType] ?? preview.fileType} ·{' '}
          {IMPORT_ORIGIN_LABELS[preview.origin] ?? preview.origin}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCell label="Linhas no arquivo" value={preview.totalRows} />
          <SummaryCell label="Válidas" value={preview.validRows} tone="success" />
          <SummaryCell label="Duplicadas" value={preview.duplicateRows} tone="warning" />
          <SummaryCell label="Inválidas" value={preview.invalidRows} tone="danger" />
        </dl>

        <p
          className={`mt-4 rounded-lg border p-3 text-sm ${
            expired ? 'border-danger/60 text-danger-text' : 'border-border text-muted-foreground'
          }`}
          role={expired ? 'alert' : undefined}
        >
          {expired ? (
            <>Esta pré-visualização expirou em {formatTimestamp(preview.expiresAt)}. Envie o arquivo novamente.</>
          ) : (
            <>
              Esta pré-visualização vale até <strong className="text-foreground">{formatTimestamp(preview.expiresAt)}</strong>.
              Depois disso será preciso enviar o arquivo de novo.
            </>
          )}
        </p>
      </section>

      <fieldset className="rounded-2xl border border-border bg-layer01 p-4 sm:p-6">
        <legend className="px-1 text-md font-semibold text-foreground">Destino dos lançamentos</legend>
        <p className="mt-1 text-sm text-muted-foreground">
          Todos os lançamentos selecionados vão para uma única conta ou um único cartão.
        </p>

        <div className="mt-4 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="radio"
              name="destination-kind"
              value="account"
              checked={kind === 'account'}
              onChange={() => {
                setKind('account');
                setFormError(null);
              }}
              className="size-4 accent-[color:var(--color-primary)]"
            />
            Conta
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="radio"
              name="destination-kind"
              value="creditCard"
              checked={kind === 'creditCard'}
              onChange={() => {
                setKind('creditCard');
                setFormError(null);
              }}
              className="size-4 accent-[color:var(--color-primary)]"
            />
            Cartão de crédito
          </label>
        </div>

        <div className="mt-4 max-w-md">
          {kind === 'account' ? (
            <DestinationSelect
              label="Conta de destino"
              isPending={accounts.isPending}
              isError={accounts.isError}
              error={accounts.error}
              onRetry={() => accounts.query.refetch()}
              emptyMessage="Você ainda não tem contas ativas. Cadastre uma em Contas."
              options={accounts.accounts.map((a) => ({ id: a.id, label: `${a.name} — ${a.institution}` }))}
              value={accountId}
              onChange={(value) => {
                setAccountId(value);
                setFormError(null);
              }}
            />
          ) : (
            <DestinationSelect
              label="Cartão de destino"
              isPending={creditCards.isPending}
              isError={creditCards.isError}
              error={creditCards.error}
              onRetry={() => creditCards.query.refetch()}
              emptyMessage="Você ainda não tem cartões ativos. Cadastre um em Cartões."
              options={creditCards.creditCards.map((c) => ({ id: c.id, label: `${c.name} — ${c.institution}` }))}
              value={creditCardId}
              onChange={(value) => {
                setCreditCardId(value);
                setFormError(null);
              }}
            />
          )}
        </div>

        {noDestinations ? (
          <p role="alert" className="mt-3 text-sm text-warning-text">
            Cadastre ao menos uma conta ou um cartão antes de importar.
          </p>
        ) : null}
      </fieldset>

      <section aria-labelledby="import-rows-heading" className="rounded-2xl border border-border bg-layer01 p-4 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 id="import-rows-heading" className="text-sm font-semibold text-foreground">
            Linhas do arquivo
          </h3>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            <strong className="text-foreground">{selected.size}</strong> de {importableRowNumbers.length} linha(s)
            importável(is) selecionada(s)
          </p>
        </div>

        <label className="mt-3 flex w-fit items-center gap-2 text-sm text-foreground">
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allImportableSelected}
            onChange={toggleAll}
            disabled={importableRowNumbers.length === 0}
            className="size-4 accent-[color:var(--color-primary)]"
          />
          Selecionar todas as linhas importáveis (ou nenhuma)
        </label>

        {preview.rows.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border-strong p-6 text-center text-sm text-muted-foreground">
            O arquivo não tem nenhuma linha de lançamento.
          </p>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[46rem] border-collapse text-sm">
                <caption className="sr-only">
                  Linhas lidas do arquivo {preview.fileName}, com a situação de cada uma e a seleção para importar.
                </caption>
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th scope="col" className="w-10 px-2 py-2 font-medium">
                      <span className="sr-only">Importar</span>
                    </th>
                    <th scope="col" className="px-2 py-2 font-medium">Linha</th>
                    <th scope="col" className="px-2 py-2 font-medium">Data</th>
                    <th scope="col" className="px-2 py-2 font-medium">Descrição</th>
                    <th scope="col" className="px-2 py-2 font-medium">Tipo</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">Valor</th>
                    <th scope="col" className="px-2 py-2 font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <PreviewRow
                      key={row.rowNumber}
                      row={row}
                      checked={selected.has(row.rowNumber)}
                      onToggle={() => toggleRow(row.rowNumber)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <Pagination
                meta={meta}
                itemLabel="linhas"
                onPageChange={setPage}
                onLimitChange={(next) => {
                  setLimit(next);
                  setPage(1);
                }}
              />
            </div>
          </>
        )}
      </section>

      {formError ? (
        <p role="alert" className="rounded-lg border border-danger/60 bg-layer01 p-3 text-sm text-danger-text">
          {formError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <ActionButton
          type="submit"
          loading={confirmImport.isPending}
          disabled={confirmImport.isPending || expired}
        >
          {confirmImport.isPending ? 'Importando…' : `Importar ${selected.size} linha(s)`}
        </ActionButton>
        <ActionButton type="button" variant="secondary" onClick={onBack} disabled={confirmImport.isPending}>
          Voltar e trocar o arquivo
        </ActionButton>
      </div>
    </form>
  );
}

function sortedRowNumbers(selected: Set<number>): number[] {
  return Array.from(selected).sort((a, b) => a - b);
}

const TONES = {
  neutral: 'text-foreground',
  success: 'text-success-text',
  warning: 'text-warning-text',
  danger: 'text-danger-text',
} as const;

function SummaryCell({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className="rounded-xl border border-border bg-layer02 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-1 text-md font-semibold ${TONES[tone]}`}>{value}</dd>
    </div>
  );
}

function rowSituation(row: ImportPreviewRow): { text: string; tone: keyof typeof TONES } {
  if (row.errors.length > 0) return { text: row.errors.join(' · '), tone: 'danger' };
  if (row.duplicate) {
    return {
      text: 'Duplicada — já existe um lançamento importado com este mesmo identificador.',
      tone: 'warning',
    };
  }
  return { text: 'Pronta para importar', tone: 'success' };
}

function PreviewRow({
  row,
  checked,
  onToggle,
}: {
  row: ImportPreviewRow;
  checked: boolean;
  onToggle: () => void;
}) {
  const disabled = !isImportable(row);
  const situation = rowSituation(row);
  const description = row.description?.trim() || 'Sem descrição';

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-2 py-2 align-top">
        <input
          type="checkbox"
          checked={checked && !disabled}
          disabled={disabled}
          onChange={onToggle}
          // A `<Field>` would force a visible label block into a table cell;
          // `aria-label` gives the control the same real accessible name.
          aria-label={`Importar linha ${row.rowNumber}: ${description}, ${formatCivilDate(row.date)}`}
          className="size-4 accent-[color:var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40"
        />
      </td>
      <th scope="row" className="px-2 py-2 text-left align-top font-normal text-muted-foreground">
        {row.rowNumber}
      </th>
      <td className="whitespace-nowrap px-2 py-2 align-top text-foreground">{formatCivilDate(row.date)}</td>
      <td className="max-w-[18rem] px-2 py-2 align-top text-foreground">{description}</td>
      <td className="px-2 py-2 align-top text-muted-foreground">
        {row.type ? TRANSACTION_TYPE_LABELS[row.type] ?? row.type : '—'}
      </td>
      <td
        className={`whitespace-nowrap px-2 py-2 text-right align-top ${
          row.type === 'expense' ? 'text-danger-text' : 'text-success-text'
        }`}
      >
        {row.value === null ? '—' : formatMoney(row.value)}
      </td>
      <td className={`px-2 py-2 align-top text-xs ${TONES[situation.tone]}`}>{situation.text}</td>
    </tr>
  );
}

function DestinationSelect({
  label,
  options,
  value,
  onChange,
  isPending,
  isError,
  error,
  onRetry,
  emptyMessage,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  emptyMessage: string;
}) {
  if (isPending) return <LoadingState label={`Carregando ${label.toLowerCase()}…`} />;
  if (isError) return <ErrorState error={error} onRetry={onRetry} title={`Não foi possível carregar ${label.toLowerCase()}`} />;

  return (
    <Field label={label} required hint={options.length === 0 ? emptyMessage : undefined}>
      {({ id, describedBy }) => (
        <Select
          id={id}
          aria-describedby={describedBy}
          value={value}
          disabled={options.length === 0}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Selecione…</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}
