import { useQuery } from '@tanstack/react-query';
import { accountsApi } from '@/shared/lib/api';

export function useAccountsQuery(accountId?: string) {
  return useQuery({
    queryKey: ['accounts', accountId ?? 'all'],
    queryFn: () => {
      if (accountId) {
        const response = accountsApi.getById(accountId)

        return new Array(1).fill(response);
      }

      return accountsApi.list();
    }
  })
}
