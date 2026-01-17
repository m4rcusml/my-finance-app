import { useQuery } from '@tanstack/react-query';
import { categoriesApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';

export function useCategoriesQuery() {
  return useQuery({
    queryKey: queryKeys.categories.all(),
    queryFn: () => categoriesApi.list(),
  });
}

export function useCategoryQuery(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.categories.detail(id),
    queryFn: () => categoriesApi.getById(id),
    enabled: options?.enabled,
  });
}
