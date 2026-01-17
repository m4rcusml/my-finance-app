import { useQuery } from '@tanstack/react-query';
import { accountsApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';

export function useAccountsQuery() {
  return useQuery({
    queryKey: queryKeys.accounts.all(),
    queryFn: () => accountsApi.list(),
  });
}

export function useAccountQuery(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.accounts.detail(id),
    queryFn: () => accountsApi.getById(id),
    enabled: options?.enabled,
  });
}
