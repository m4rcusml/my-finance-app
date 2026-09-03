'use client';

import { IMPORT_ORIGINS, type ImportOrigin, type ImportPreviewResponse } from '@finance/contracts';
import { useRef, useState } from 'react';
import { errorMessage } from '@/shared/lib/api';
import { IMPORT_ORIGIN_LABELS } from '@/shared/lib/format';
import { ActionButton, Field, Select, controlClassName } from '@/shared/ui/form';
import { useToast } from '@/shared/ui/toast';
import { ACCEPTED_IMPORT_EXTENSIONS, MAX_IMPORT_BYTES, formatBytes } from './constants';
import { usePreviewImportMutation } from './mutations';

/**
 * Step 1 — pick the file and say where it came from.
 *
 * Nothing is written yet: this only asks the server to parse and dedupe the
 * file and hand back a preview batch. The size ceiling is stated up front
 * rather than discovered as a 413 after a slow upload.
 */
export function UploadStep({ onAnalyzed }: { onAnalyzed: (preview: ImportPreviewResponse) => void }) {
  const toast = useToast();
  const preview = usePreviewImportMutation();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [origin, setOrigin] = useState<ImportOrigin>('inter');
  const [fileError, setFileError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setFormError(null);
    const picked = event.target.files?.[0] ?? null;
    if (!picked) {
      setFile(null);
      setFileError(undefined);
      return;
    }
    if (picked.size > MAX_IMPORT_BYTES) {
      setFile(null);
      setFileError(`O arquivo tem ${formatBytes(picked.size)}. O limite é ${formatBytes(MAX_IMPORT_BYTES)}.`);
      return;
    }
    if (picked.size === 0) {
      setFile(null);
      setFileError('O arquivo está vazio.');
      return;
    }
    setFile(picked);
    setFileError(undefined);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!file) {
      setFileError('Escolha um arquivo CSV, OFX ou XLSX.');
      inputRef.current?.focus();
      return;
    }

    preview.mutate(
      { file, origin },
      {
        onSuccess: (result) => {
          toast.success('Arquivo analisado', `${result.totalRows} linha(s) lida(s) de ${result.fileName}.`);
          onAnalyzed(result);
        },
        onError: (error) => {
          // The form stays exactly as it is, with the reason visible in it.
          const message = errorMessage(error);
          setFormError(message);
          toast.error('Não foi possível analisar o arquivo', message);
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-2xl border border-border bg-layer01 p-4 sm:p-6">
      <h2 className="text-md font-semibold text-foreground">1. Enviar arquivo</h2>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Envie o extrato exportado pelo seu banco. Nada é gravado nesta etapa — você vê tudo antes de confirmar.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field
          label="Arquivo"
          required
          error={fileError}
          hint={`Formatos aceitos: CSV, OFX ou XLSX. Tamanho máximo: ${formatBytes(MAX_IMPORT_BYTES)}.`}
        >
          {({ id, describedBy, invalid }) => (
            <input
              ref={inputRef}
              id={id}
              name="file"
              type="file"
              accept={ACCEPTED_IMPORT_EXTENSIONS}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              onChange={handleFileChange}
              className={controlClassName(invalid, 'file:mr-3 file:rounded-md file:border-0 file:bg-layer03 file:px-3 file:py-1 file:text-sm file:font-medium file:text-foreground')}
            />
          )}
        </Field>

        <Field label="Origem" required hint="Define como as colunas do arquivo são interpretadas.">
          {({ id, describedBy }) => (
            <Select
              id={id}
              name="origin"
              aria-describedby={describedBy}
              value={origin}
              onChange={(event) => setOrigin(event.target.value as ImportOrigin)}
            >
              {IMPORT_ORIGINS.map((value) => (
                <option key={value} value={value}>
                  {IMPORT_ORIGIN_LABELS[value] ?? value}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {file ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Selecionado: <strong className="text-foreground">{file.name}</strong> ({formatBytes(file.size)})
        </p>
      ) : null}

      {formError ? (
        <p role="alert" className="mt-4 rounded-lg border border-danger/60 bg-layer02 p-3 text-sm text-danger-text">
          {formError}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <ActionButton type="submit" loading={preview.isPending} disabled={preview.isPending}>
          {preview.isPending ? 'Analisando…' : 'Analisar arquivo'}
        </ActionButton>
      </div>
    </form>
  );
}
