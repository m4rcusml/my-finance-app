'use client';

import type { Account, Category, Goal, PaginatedResponse } from '@finance/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { accountsApi, categoriesApi, goalsApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { useSessionKey } from '@/shared/session/session-provider';

/**
 * Goal queries.
 *
 * `goalsApi.list` answers with `PaginatedResponse<Goal>`; the screens read
 * `.data` and `.meta` off the envelope. `page` and `limit` are part of the
 * session-scoped query key, so page 2 can never be served from page 1's cache.
 */

export interface GoalFilters {
  page: number;
  limit: number;
}

export function useGoalsQuery(filters: GoalFilters): UseQueryResult<PaginatedResponse<Goal>> {
  const s = useSessionKey();
  const query = { page: filters.page, limit: filters.limit };

  return useQuery({
    queryKey: queryKeys.goals.list(s, query),
    queryFn: () => goalsApi.list(query),
  });
}

const OPTIONS_PAGE = { page: 1, limit: 100 };

/**
 * Reference-only selectors for the goal form. A goal's related category and
 * account are labels the user attaches for their own orientation — V1 never
 * derives progress from them — so a failure to load these must not block saving
 * the goal, and the form degrades to "sem categoria" / "sem conta".
 */
export function useGoalCategoryOptionsQuery(): UseQueryResult<PaginatedResponse<Category>> {
  const s = useSessionKey();

  return useQuery({
    queryKey: queryKeys.categories.list(s, OPTIONS_PAGE),
    queryFn: () => categoriesApi.list(OPTIONS_PAGE),
  });
}

export function useGoalAccountOptionsQuery(): UseQueryResult<PaginatedResponse<Account>> {
  const s = useSessionKey();

  return useQuery({
    queryKey: queryKeys.accounts.list(s, OPTIONS_PAGE),
    queryFn: () => accountsApi.list(OPTIONS_PAGE),
  });
}
