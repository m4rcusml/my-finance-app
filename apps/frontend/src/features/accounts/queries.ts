'use client';

import type { Account, PaginatedResponse } from '@finance/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { accountsApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { useSessionKey } from '@/shared/session/session-provider';

/**
 * Account reads.
 *
 * Every list endpoint answers with `PaginatedResponse<Account>`, so the query
 * data is the ENVELOPE — `.data` is the array, `.meta` drives `<Pagination>`.
 * Nothing here ever calls an array method on the response itself.
 */

export interface AccountsFilters {
  page?: number;
  limit?: number;
  includeArchived?: boolean;
}

export type AccountsQueryResult = UseQueryResult<PaginatedResponse<Account>>;

export function useAccountsQuery(filters: AccountsFilters = {}): AccountsQueryResult {
  const s = useSessionKey();
  // Every filter that changes the response — page and limit included — is in the key.
  return useQuery({
    queryKey: queryKeys.accounts.list(s, filters),
    queryFn: () => accountsApi.list(filters),
  });
}

/** The filters selectors need: one page big enough for everything, actives only. */
export const ACTIVE_ACCOUNTS_FILTERS: AccountsFilters = { limit: 100, includeArchived: false };

export interface ActiveAccountsResult {
  /** Already unwrapped from the envelope — safe to `.map()` over. */
  accounts: Account[];
  query: AccountsQueryResult;
  isPending: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * For `<select>`s and pickers elsewhere in the app: a plain array of active
 * accounts, plus the query object so the caller can still render loading and
 * error states honestly.
 */
export function useActiveAccountsQuery(): ActiveAccountsResult {
  const query = useAccountsQuery(ACTIVE_ACCOUNTS_FILTERS);
  return {
    accounts: query.data?.data ?? [],
    query,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
  };
}

export function useAccountQuery(id: string | null) {
  const s = useSessionKey();
  return useQuery({
    queryKey: queryKeys.accounts.detail(s, id ?? ''),
    queryFn: () => accountsApi.get(id as string),
    enabled: Boolean(id),
  });
}
