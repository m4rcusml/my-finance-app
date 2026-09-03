'use client';

import type { Category, CategoryType, PaginatedResponse } from '@finance/contracts';
import { keepPreviousData, type UseQueryResult, useQuery } from '@tanstack/react-query';
import { categoriesApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { useSessionKey } from '@/shared/session/session-provider';

export interface CategoriesFilters {
  page?: number;
  limit?: number;
  includeArchived?: boolean;
  type?: CategoryType;
}

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
  const query = useCategoriesQuery(ACTIVE_CATEGORIES_FILTERS);

  return {
    categories: query.data?.data ?? [],
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
