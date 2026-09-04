'use client';

import type { Category, ListCategoriesQuery, PaginatedResponse } from '@finance/contracts';
import { keepPreviousData, type UseQueryResult, useQuery } from '@tanstack/react-query';
import { categoriesApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { useSessionKey } from '@/shared/session/session-provider';

export type CategoriesFilters = ListCategoriesQuery;

export type CategoriesQueryResult = UseQueryResult<PaginatedResponse<Category>>;

export function useCategoriesQuery(filters: CategoriesFilters = {}): CategoriesQueryResult {
  const sessionKey = useSessionKey();

  return useQuery({
    queryKey: queryKeys.categories.list(sessionKey, filters),
    queryFn: () => categoriesApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export const ACTIVE_CATEGORIES_FILTERS: CategoriesFilters = {
  limit: 100,
  includeArchived: false,
};

export function useActiveCategoriesQuery() {
  const sessionKey = useSessionKey();
  const query = useQuery({
    queryKey: [...queryKeys.categories.all(sessionKey), 'active-options'],
    queryFn: async () => {
      const categories: Category[] = [];
      let page = 1;
      let hasNext = true;
      while (hasNext) {
        const response = await categoriesApi.list({ ...ACTIVE_CATEGORIES_FILTERS, page });
        categories.push(...response.data);
        hasNext = response.meta.hasNextPage;
        page += 1;
      }
      return categories;
    },
  });

  return {
    categories: query.data ?? [],
    query,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
  };
}

export function useCategoryQuery(id: string | null) {
  const sessionKey = useSessionKey();

  return useQuery({
    queryKey: queryKeys.categories.detail(sessionKey, id ?? ''),
    queryFn: () => categoriesApi.get(id as string),
    enabled: Boolean(id),
  });
}
