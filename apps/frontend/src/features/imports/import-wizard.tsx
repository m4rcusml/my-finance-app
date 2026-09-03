'use client';

import type { ConfirmImportResponse, ImportPreviewResponse } from '@finance/contracts';
import { useState } from 'react';
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

  const step: ImportStep = result ? 'result' : preview ? 'preview' : 'upload';

  return (
    <div>
      <ImportStepper current={step} />

      {step === 'upload' ? <UploadStep onAnalyzed={setPreview} /> : null}

      {step === 'preview' && preview ? (
        <PreviewStep
          // Keyed by batch so selection state is rebuilt from scratch for a new file.
          key={preview.batchId}
          preview={preview}
          onBack={() => setPreview(null)}
          onConfirmed={setResult}
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
