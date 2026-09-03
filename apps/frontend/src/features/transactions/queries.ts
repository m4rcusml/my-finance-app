'use client';

import type { ListTransactionsQuery, PaginatedResponse, TransactionWithRelations } from '@finance/contracts';
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { transactionsApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { useSessionKey } from '@/shared/session/session-provider';

/**
 * Transaction reads.
 *
 * Two invariants this file exists to keep:
 *  - the endpoints return `PaginatedResponse<TransactionWithRelations>`, so the
 *    hooks are typed as such and callers must go through `.data` / `.meta`.
 *    Typing these as bare arrays is what made every list screen throw;
 *  - EVERY filter that changes the server response is in the query key,
 *    `page` and `limit` included, so a filtered page can never serve another
 *    filter's rows out of the cache.
 */

export type TransactionFilters = ListTransactionsQuery;

export type TransactionListResult = PaginatedResponse<TransactionWithRelations>;

export function useTransactionsQuery(
  filters: TransactionFilters = {},
): UseQueryResult<TransactionListResult> {
  const s = useSessionKey();

  return useQuery({
    queryKey: queryKeys.transactions.list(s, filters),
    queryFn: () => transactionsApi.list(filters),
    // Paging keeps the previous page on screen instead of flashing the loading
    // state. It never hides an error: a failed fetch still flips status to
    // `error`, which `<PaginatedBoundary>` renders as an error, not as empty.
    placeholderData: keepPreviousData,
  });
}

export function useUncategorizedQuery(
  filters: TransactionFilters = {},
): UseQueryResult<TransactionListResult> {
  const s = useSessionKey();

  return useQuery({
    queryKey: queryKeys.transactions.uncategorized(s, filters),
    queryFn: () => transactionsApi.uncategorized(filters),
    placeholderData: keepPreviousData,
  });
}
