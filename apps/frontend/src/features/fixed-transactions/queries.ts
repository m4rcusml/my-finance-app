import { useQuery } from '@tanstack/react-query';
import { fixedTransactionsApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { ListOccurrencesFilters } from '@/shared/lib/api/fixed-transactions';

export function useFixedTransactionsQuery() {
  return useQuery({
    queryKey: queryKeys.fixedTransactions.all(),
    queryFn: () => fixedTransactionsApi.list(),
  });
}

export function useFixedTransactionQuery(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.fixedTransactions.detail(id),
    queryFn: () => fixedTransactionsApi.getById(id),
    enabled: options?.enabled,
  });
}

export function useFixedTransactionOccurrencesQuery(filters: ListOccurrencesFilters) {
  return useQuery({
    queryKey: queryKeys.fixedTransactions.occurrences(filters),
    queryFn: () => fixedTransactionsApi.listOccurrences(filters),
  });
}
