'use client';

import {
  BACKUP_SCHEMA_VERSION,
  type BackupFile,
  type RestoreMode,
  type RestoreResponse,
  type RestoreResultCounts,
} from '@finance/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { backupApi, errorDetails, errorMessage } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { useSessionKey } from '@/shared/session/session-provider';
import { PageHeader } from '@/shared/ui/app-shell';
import { ConfirmDialog } from '@/shared/ui/dialog';
import { ActionButton, Field, Select } from '@/shared/ui/form';
import { useToast } from '@/shared/ui/toast';

const COLLECTIONS: Array<{ key: keyof RestoreResultCounts; label: string }> = [
  { key: 'accounts', label: 'Contas' },
  { key: 'creditCards', label: 'Cartões' },
  { key: 'categories', label: 'Categorias' },
  { key: 'transactions', label: 'Transações' },
  { key: 'fixedTransactions', label: 'Modelos recorrentes' },
  { key: 'fixedTransactionOccurrences', label: 'Ocorrências recorrentes' },
  { key: 'marketAssets', label: 'Ativos cadastrados' },
  { key: 'investments', label: 'Investimentos' },
  { key: 'goals', label: 'Metas' },
  { key: 'importedFiles', label: 'Arquivos importados' },
];

const BACKUP_COLLECTION_KEYS = COLLECTIONS.map(({ key }) => key);

export function BackupClient({ embedded = false }: { embedded?: boolean }) {
  const toast = useToast();
  const sessionKey = useSessionKey();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<RestoreMode>('merge');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [backup, setBackup] = useState<BackupFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<RestoreResponse | null>(null);

  const exportMutation = useMutation({
    mutationFn: () => backupApi.export(),
    onSuccess: (data) => {
      const content = JSON.stringify(data, null, 2);
      const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `finance-backup-${data.exportedAt.slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Backup exportado. Guarde o arquivo em um local seguro.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const restoreMutation = useMutation({
    mutationFn: ({ restoreMode, data }: { restoreMode: RestoreMode; data: BackupFile }) =>
      backupApi.restore(restoreMode, data),
    onSuccess: async (data) => {
      setResult(data);
      setConfirmOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.scope(sessionKey) });
      toast.success(data.mode === 'replace' ? 'Backup restaurado por substituição.' : 'Backup mesclado.');
    },
    onError: (error) => {
      setConfirmOpen(false);
      toast.error(errorMessage(error));
    },
  });

  async function selectFile(file: File | undefined) {
    setBackup(null);
    setResult(null);
    setFileError(null);
    setSelectedFileName(file?.name ?? null);
    if (!file) return;

    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isBackupFileShape(parsed)) {
        throw new Error(`O arquivo não tem o formato de backup V${BACKUP_SCHEMA_VERSION} esperado pelo aplicativo.`);
      }
      setBackup(parsed);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Não foi possível ler o arquivo JSON.');
    }
  }

  function requestRestore() {
    if (!backup) {
      setFileError('Selecione primeiro um arquivo de backup válido.');
      fileInputRef.current?.focus();
      return;
    }
    setConfirmOpen(true);
  }

  function confirmRestore() {
    if (!backup) return;
    restoreMutation.mutate({ restoreMode: mode, data: backup });
  }

  const mutationError = restoreMutation.error;

  return (
    <div className="flex flex-col gap-6">
      {embedded ? (
        <div>
          <h2 className="text-lg font-semibold">Backup dos seus dados</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Baixe todo o seu grafo financeiro em JSON ou restaure uma cópia local.
          </p>
        </div>
      ) : (
        <PageHeader
          title="Backup"
          description="Baixe todo o seu grafo financeiro em JSON e restaure-o nesta conta quando precisar."
        />
      )}

      <section aria-labelledby="exportar-backup" className="rounded-xl border border-border bg-layer01 p-4 sm:p-6">
        <h2 id="exportar-backup" className="font-semibold text-foreground">
          Exportar dados
        </h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          O arquivo inclui contas, cartões, categorias, transações, recorrências e ocorrências, investimentos, metas e
          histórico de importações. Senha, tokens e outras credenciais nunca fazem parte do backup.
        </p>
        {exportMutation.isError ? (
          <ErrorBox error={exportMutation.error} onRetry={() => exportMutation.mutate()} />
        ) : null}
        <ActionButton
          className="mt-4"
          onClick={() => exportMutation.mutate()}
          loading={exportMutation.isPending}
          disabled={exportMutation.isPending}
        >
          Baixar backup JSON
        </ActionButton>
      </section>

      <section aria-labelledby="restaurar-backup" className="rounded-xl border border-border bg-layer01 p-4 sm:p-6">
        <h2 id="restaurar-backup" className="font-semibold text-foreground">
          Restaurar dados
        </h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          O servidor valida o arquivo inteiro e aplica a restauração em uma única transação. Se qualquer linha for
          inválida, nada é alterado.
        </p>

        <div className="mt-5 grid max-w-2xl gap-4 sm:grid-cols-2">
          <Field label="Arquivo JSON" required error={fileError ?? undefined}>
            {({ id, describedBy, invalid }) => (
              <input
                ref={fileInputRef}
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                type="file"
                accept="application/json,.json"
                onChange={(event) => void selectFile(event.currentTarget.files?.[0])}
                disabled={restoreMutation.isPending}
                className="block w-full rounded-lg border border-border-strong bg-layer02 px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-layer03 file:px-3 file:py-1 file:text-sm file:text-foreground"
              />
            )}
          </Field>

          <Field
            label="Modo de restauração"
            hint={
              mode === 'replace'
                ? 'Substitui todos os seus dados financeiros atuais pelos dados do arquivo.'
                : 'Mantém os dados atuais e adiciona somente registros ainda inexistentes.'
            }
            required
          >
            {({ id, describedBy }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={mode}
                onChange={(event) => setMode(event.target.value as RestoreMode)}
                disabled={restoreMutation.isPending}
              >
                <option value="merge">Mesclar sem duplicar</option>
                <option value="replace">Substituir tudo</option>
              </Select>
            )}
          </Field>
        </div>

        {backup ? (
          <div className="mt-4 rounded-lg border border-success/50 bg-layer02 p-3 text-sm">
            <p className="font-medium text-foreground">Arquivo pronto para validação no servidor</p>
            <p className="mt-1 text-muted-foreground">
              {selectedFileName} · exportado em {formatExportTimestamp(backup.exportedAt)} · versão{' '}
              {backup.schemaVersion}
            </p>
          </div>
        ) : null}

        {mutationError ? <ErrorBox error={mutationError} onRetry={requestRestore} /> : null}

        <ActionButton
          variant={mode === 'replace' ? 'danger' : 'primary'}
          className="mt-4"
          onClick={requestRestore}
          loading={restoreMutation.isPending}
          disabled={restoreMutation.isPending}
        >
          {mode === 'replace' ? 'Substituir pelos dados do arquivo' : 'Mesclar dados do arquivo'}
        </ActionButton>
      </section>

      {result ? <RestoreReport result={result} /> : null}

      <ConfirmDialog
        open={confirmOpen}
        title={mode === 'replace' ? 'Substituir todos os dados financeiros?' : 'Mesclar o backup?'}
        message={
          mode === 'replace'
            ? `O conteúdo financeiro atual desta conta será removido e substituído por “${selectedFileName ?? 'o arquivo selecionado'}”. A operação é atômica, mas não pode ser desfeita sem outro backup.`
            : `Os dados de “${selectedFileName ?? 'o arquivo selecionado'}” serão combinados com os atuais. Chaves naturais existentes não serão duplicadas.`
        }
        confirmLabel={mode === 'replace' ? 'Sim, substituir tudo' : 'Mesclar backup'}
        destructive={mode === 'replace'}
        busy={restoreMutation.isPending}
        onConfirm={confirmRestore}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function isBackupFileShape(value: unknown): value is BackupFile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion !== BACKUP_SCHEMA_VERSION) return false;
  if (!candidate.user || typeof candidate.user !== 'object' || Array.isArray(candidate.user)) return false;
  return BACKUP_COLLECTION_KEYS.every((key) => Array.isArray(candidate[key]));
}

function formatExportTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function ErrorBox({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const details = errorDetails(error);
  return (
    <div role="alert" className="mt-4 rounded-lg border border-danger/60 bg-layer02 p-3">
      <p className="text-sm font-medium text-danger-text">{errorMessage(error)}</p>
      {details.length > 0 ? (
        <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 text-sm font-medium text-foreground underline underline-offset-2"
      >
        Tentar novamente
      </button>
    </div>
  );
}

function RestoreReport({ result }: { result: RestoreResponse }) {
  return (
    <section
      aria-labelledby="resultado-restauracao"
      className="rounded-xl border border-success/50 bg-layer01 p-4 sm:p-6"
    >
      <h2 id="resultado-restauracao" className="font-semibold text-foreground">
        Restauração concluída
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Modo {result.mode === 'replace' ? 'substituir' : 'mesclar'} · formato V{result.schemaVersion}
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-sm">
          <caption className="sr-only">Quantidade de registros criados e removidos por coleção.</caption>
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th scope="col" className="py-2 pr-4 font-medium">
                Coleção
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                Criados
              </th>
              <th scope="col" className="py-2 pl-4 text-right font-medium">
                Removidos
              </th>
            </tr>
          </thead>
          <tbody>
            {COLLECTIONS.map(({ key, label }) => (
              <tr key={key} className="border-b border-border/60 last:border-0">
                <th scope="row" className="py-2 pr-4 text-left font-normal text-foreground">
                  {label}
                </th>
                <td className="px-4 py-2 text-right tabular-nums text-foreground">{result.created[key]}</td>
                <td className="py-2 pl-4 text-right tabular-nums text-muted-foreground">{result.deleted[key]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
