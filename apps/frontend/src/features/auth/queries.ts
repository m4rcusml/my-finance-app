import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';

export function useGetMe() {
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: () => authApi.me(),
  })
}