'use client';

import type { ConfirmImportResponse } from '@finance/contracts';
import Link from 'next/link';
import { IMPORT_STATUS_LABELS } from '@/shared/lib/format';
import { ActionButton } from '@/shared/ui/form';

/**
 * Step 3 — what actually happened.
 *
 * The three counters always add up to what the user selected, so a row that
 * silently vanished is impossible to miss.
 */
export function ResultStep({
  result,
  onRestart,
}: {
  result: ConfirmImportResponse;
  onRestart: () => void;
}) {
  return (
    <section
      aria-labelledby="import-result-heading"
      className="rounded-2xl border border-border bg-layer01 p-4 sm:p-6"
    >
      <h2 id="import-result-heading" className="text-md font-semibold text-foreground">
        3. Importação concluída
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Situação do lote: {IMPORT_STATUS_LABELS[result.status] ?? result.status}.
      </p>

      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-layer02 p-3">
          <dt className="text-xs text-muted-foreground">Importados</dt>
          <dd className="mt-1 text-md font-semibold text-success-text">{result.imported}</dd>
        </div>
        <div className="rounded-xl border border-border bg-layer02 p-3">
          <dt className="text-xs text-muted-foreground">Ignorados por duplicidade</dt>
          <dd className="mt-1 text-md font-semibold text-warning-text">{result.skippedDuplicates}</dd>
        </div>
        <div className="rounded-xl border border-border bg-layer02 p-3">
          <dt className="text-xs text-muted-foreground">Ignorados por erro na linha</dt>
          <dd className="mt-1 text-md font-semibold text-danger-text">{result.skippedInvalid}</dd>
        </div>
      </dl>

      <p className="mt-4 max-w-prose rounded-lg border border-border bg-layer02 p-3 text-sm text-muted-foreground">
        Cada linha importada guarda um identificador próprio vindo do arquivo. Por isso,{' '}
        <strong className="text-foreground">reimportar o mesmo arquivo não cria duplicatas</strong>: as linhas já
        conhecidas aparecem como duplicadas e são ignoradas.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <ActionButton type="button" onClick={onRestart}>
          Importar outro arquivo
        </ActionButton>
        <Link
          href="/transactions"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-strong bg-layer02 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-layer03"
        >
          Ver meus lançamentos
        </Link>
      </div>
    </section>
  );
}
