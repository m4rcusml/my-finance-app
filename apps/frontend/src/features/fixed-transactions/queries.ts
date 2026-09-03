'use client';

import type {
  FixedTransaction,
  ListFixedTransactionsQuery,
  ListOccurrencesQuery,
  OccurrenceWithTemplate,
  PaginatedResponse,
} from '@finance/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { fixedTransactionsApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { useSessionKey } from '@/shared/session/session-provider';

/**
 * Read hooks for recurring templates and their occurrences.
 *
 * Both endpoints answer with `PaginatedResponse<T>`, so these hooks hand the
 * whole envelope back — `.data` plus `.meta`. Callers must go through
 * `<PaginatedBoundary>` rather than mapping over the response object.
 *
 * Every filter that changes the response is part of the query key, `page` and
 * `limit` included; otherwise page 2 would be served from page 1's cache entry.
 */

export function useFixedTransactionsQuery(
  filters: ListFixedTransactionsQuery = {},
): UseQueryResult<PaginatedResponse<FixedTransaction>> {
  const session = useSessionKey();
  const query: ListFixedTransactionsQuery = {
    page: filters.page,
    limit: filters.limit,
    isActive: filters.isActive,
    type: filters.type,
  };

  return useQuery({
    queryKey: queryKeys.fixedTransactions.list(session, query),
    queryFn: () => fixedTransactionsApi.list(query),
  });
}

export function useOccurrencesQuery(
  filters: ListOccurrencesQuery = {},
): UseQueryResult<PaginatedResponse<OccurrenceWithTemplate>> {
  const session = useSessionKey();
  const query: ListOccurrencesQuery = {
    year: filters.year,
    month: filters.month,
    status: filters.status,
    fixedTransactionId: filters.fixedTransactionId,
    page: filters.page,
    limit: filters.limit,
  };

  return useQuery({
    queryKey: queryKeys.fixedTransactions.occurrences(session, query),
    queryFn: () => fixedTransactionsApi.occurrences(query),
  });
}
