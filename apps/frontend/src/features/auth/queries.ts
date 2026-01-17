import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/shared/lib/api';

export function useGetMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me(),
  })
}