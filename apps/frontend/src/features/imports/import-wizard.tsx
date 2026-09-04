'use client';

import type { ConfirmImportResponse, ImportPreviewResponse } from '@finance/contracts';
import { useEffect, useState } from 'react';
import { useSessionKey } from '@/shared/session/session-provider';
import { ActionButton } from '@/shared/ui/form';
import { QueryBoundary } from '@/shared/ui/query-state';
import { useImportBatchQuery } from './queries';
import { formatTimestamp } from './constants';
import { type ImportStep, ImportStepper } from './import-steps';
import { PreviewStep } from './preview-step';
import { ResultStep } from './result-step';
import { UploadStep } from './upload-step';

/**
 * The whole import flow, as three explicit steps the user walks through.
 *
 * The preview batch lives on the server; this component only remembers which
 * batch is open, so a reload loses nothing but the position in the flow.
 */
export function ImportWizard() {
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [result, setResult] = useState<ConfirmImportResponse | null>(null);
  const sessionKey = useSessionKey();
  const storageKey = `finance:import-preview:${sessionKey}`;
  const [savedBatchId, setSavedBatchId] = useState<string | null>(null);
  const savedBatch = useImportBatchQuery(savedBatchId);

  useEffect(() => {
    setPreview(null);
    setResult(null);
    try {
      setSavedBatchId(sessionStorage.getItem(storageKey));
    } catch {
      setSavedBatchId(null);
    }
  }, [storageKey]);

  function rememberBatch(batch: ImportPreviewResponse) {
    setPreview(batch);
    setSavedBatchId(batch.batchId);
    // Only an opaque pointer is retained; financial rows remain on the server.
    try {
      sessionStorage.setItem(storageKey, batch.batchId);
    } catch {
      /* Storage can be disabled. */
    }
  }

  function finishImport(value: ConfirmImportResponse) {
    setResult(value);
    setSavedBatchId(null);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* Storage can be disabled. */
    }
  }

  const step: ImportStep = result ? 'result' : preview ? 'preview' : 'upload';

  return (
    <div>
      <ImportStepper current={step} />

      {step === 'upload' ? <UploadStep onAnalyzed={rememberBatch} /> : null}

      {step === 'upload' && savedBatchId ? (
        <section className="mt-5 rounded-2xl border border-border bg-layer01 p-5">
          <h2 className="text-md font-semibold">Prévia salva</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            Continue de onde parou, sem reenviar o arquivo neste navegador.
          </p>
          <QueryBoundary query={savedBatch} loadingLabel="Carregando prévia salva…">
            {(batch) => (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-layer02/40 p-4">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold">{batch.fileName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {batch.totalRows} linhas · válida até {formatTimestamp(batch.expiresAt)}
                  </p>
                </div>
                {batch.status === 'pending' && Date.parse(batch.expiresAt) > Date.now() ? (
                  <ActionButton onClick={() => setPreview(batch)}>Retomar prévia</ActionButton>
                ) : (
                  <p className="text-sm text-warning-text">Prévia encerrada ou expirada. Envie o arquivo novamente.</p>
                )}
              </div>
            )}
          </QueryBoundary>
        </section>
      ) : null}

      {step === 'preview' && preview ? (
        <PreviewStep
          // Keyed by batch so selection state is rebuilt from scratch for a new file.
          key={preview.batchId}
          preview={preview}
          onBack={() => setPreview(null)}
          onConfirmed={finishImport}
        />
      ) : null}

      {step === 'result' && result ? (
        <ResultStep
          result={result}
          onRestart={() => {
            setResult(null);
            setPreview(null);
          }}
        />
      ) : null}
    </div>
  );
}
