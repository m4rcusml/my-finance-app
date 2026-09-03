'use client';

import { useState } from 'react';
import { IMPORT_ORIGIN_LABELS, IMPORT_STATUS_LABELS } from '@/shared/lib/format';
import { Pagination } from '@/shared/ui/pagination';
import { PaginatedBoundary } from '@/shared/ui/query-state';
import { IMPORT_FILE_TYPE_LABELS, formatTimestamp } from './constants';
import { useImportHistoryQuery } from './queries';

/**
 * Every file this account has already imported.
 *
 * The response is a `PaginatedResponse<ImportedFile>`, so `<PaginatedBoundary>`
 * unwraps `.data`/`.meta` and keeps "falhou ao carregar" from ever being
 * rendered as "nenhuma importação".
 */

const STATUS_TONE: Record<string, string> = {
  completed: 'text-success-text',
  pending: 'text-warning-text',
  processing: 'text-warning-text',
  failed: 'text-danger-text',
  expired: 'text-muted-foreground',
};

export function ImportHistory() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const query = useImportHistoryQuery({ page, limit });

  return (
    <section aria-labelledby="import-history-heading" className="mt-8">
      <h2 id="import-history-heading" className="mb-3 text-md font-semibold text-foreground">
        Histórico de importações
      </h2>

      <PaginatedBoundary
        query={query}
        loadingLabel="Carregando histórico…"
        emptyTitle="Nenhuma importação ainda"
        emptyMessage="Assim que você confirmar a primeira importação, o arquivo aparece aqui."
      >
        {(files, meta) => (
          <div className="rounded-2xl border border-border bg-layer01 p-4 sm:p-6">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[38rem] border-collapse text-sm">
                <caption className="sr-only">Arquivos já importados, do mais recente para o mais antigo.</caption>
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th scope="col" className="px-2 py-2 font-medium">Arquivo</th>
                    <th scope="col" className="px-2 py-2 font-medium">Origem</th>
                    <th scope="col" className="px-2 py-2 font-medium">Formato</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">Registros</th>
                    <th scope="col" className="px-2 py-2 font-medium">Situação</th>
                    <th scope="col" className="px-2 py-2 font-medium">Importado em</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.id} className="border-b border-border last:border-0">
                      <th scope="row" className="max-w-[16rem] truncate px-2 py-2 text-left font-normal text-foreground">
                        {file.fileName}
                      </th>
                      <td className="px-2 py-2 text-muted-foreground">
                        {IMPORT_ORIGIN_LABELS[file.origin] ?? file.origin}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {IMPORT_FILE_TYPE_LABELS[file.fileType] ?? file.fileType}
                      </td>
                      <td className="px-2 py-2 text-right text-foreground">{file.totalRecords}</td>
                      <td className={`px-2 py-2 ${STATUS_TONE[file.status] ?? 'text-muted-foreground'}`}>
                        {IMPORT_STATUS_LABELS[file.status] ?? file.status}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">
                        {formatTimestamp(file.importedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <Pagination
                meta={meta}
                itemLabel="importações"
                onPageChange={setPage}
                onLimitChange={(next) => {
                  setLimit(next);
                  setPage(1);
                }}
              />
            </div>
          </div>
        )}
      </PaginatedBoundary>
    </section>
  );
}
