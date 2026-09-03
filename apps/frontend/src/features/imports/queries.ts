'use client';

import type { ImportedFile, ImportPreviewResponse, PaginatedResponse } from '@finance/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { importsApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { useSessionKey } from '@/shared/session/session-provider';

/**
 * Import reads.
 *
 * `history` answers with `PaginatedResponse<ImportedFile>`: the query data is
 * the ENVELOPE, so callers read `.data` for the rows and `.meta` for the pager.
 * `page` and `limit` are part of the key, otherwise page 2 would be served
 * from page 1's cache entry.
 */

export interface ImportHistoryFilters {
  page?: number;
  limit?: number;
}

export type ImportHistoryQueryResult = UseQueryResult<PaginatedResponse<ImportedFile>>;

export function useImportHistoryQuery(filters: ImportHistoryFilters = {}): ImportHistoryQueryResult {
  const s = useSessionKey();
  return useQuery({
    queryKey: queryKeys.imports.history(s, filters),
    queryFn: () => importsApi.history(filters),
  });
}

/**
 * Re-reads a persisted preview batch. Used when the user lands back on a batch
 * (the preview lives on the server, not in this tab's memory).
 */
export function useImportBatchQuery(batchId: string | null): UseQueryResult<ImportPreviewResponse> {
  const s = useSessionKey();
  return useQuery({
    queryKey: queryKeys.imports.batch(s, batchId ?? ''),
    queryFn: () => importsApi.batch(batchId as string),
    enabled: Boolean(batchId),
  });
}
