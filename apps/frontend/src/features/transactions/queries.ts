import { useQuery } from '@tanstack/react-query';
import { transactionsApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { ListTransactionsFilters } from '@/shared/lib/api/transactions';

export function useTransactionsQuery(filters: ListTransactionsFilters = {}) {
  return useQuery({
    queryKey: queryKeys.transactions.list(filters),
    queryFn: () => transactionsApi.list(filters),
  });
}

export function useUncategorizedTransactionsQuery(filters: ListTransactionsFilters = {}) {
  return useQuery({
    queryKey: queryKeys.transactions.uncategorized(filters),
    queryFn: () => transactionsApi.listUncategorized(filters),
  });
}

export function useTransactionQuery(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.transactions.detail(id),
    queryFn: () => transactionsApi.getById(id),
    enabled: options?.enabled,
  });
}
