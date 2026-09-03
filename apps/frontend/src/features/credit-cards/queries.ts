'use client';

import type { CreditCard, PaginatedResponse } from '@finance/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { creditCardsApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { useSessionKey } from '@/shared/session/session-provider';

/**
 * Credit-card reads.
 *
 * The list endpoint answers with `PaginatedResponse<CreditCard>`: `.data` is the
 * array, `.meta` drives `<Pagination>`. Each card carries `cycleUsedAmount` and
 * `currentCycle` computed for the **open cycle only** — V1 has no invoice
 * payment, so that number is "gastos do ciclo atual", never a debt.
 */

export interface CreditCardsFilters {
  page?: number;
  limit?: number;
  includeArchived?: boolean;
}

export type CreditCardsQueryResult = UseQueryResult<PaginatedResponse<CreditCard>>;

export function useCreditCardsQuery(filters: CreditCardsFilters = {}): CreditCardsQueryResult {
  const s = useSessionKey();
  return useQuery({
    queryKey: queryKeys.creditCards.list(s, filters),
    queryFn: () => creditCardsApi.list(filters),
  });
}

/** The filters selectors need: one page big enough for everything, actives only. */
export const ACTIVE_CREDIT_CARDS_FILTERS: CreditCardsFilters = { limit: 100, includeArchived: false };

export interface ActiveCreditCardsResult {
  /** Already unwrapped from the envelope — safe to `.map()` over. */
  creditCards: CreditCard[];
  query: CreditCardsQueryResult;
  isPending: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * For `<select>`s and pickers elsewhere in the app: a plain array of active
 * cards, plus the query object so the caller can still render loading and error
 * states honestly.
 */
export function useActiveCreditCardsQuery(): ActiveCreditCardsResult {
  const query = useCreditCardsQuery(ACTIVE_CREDIT_CARDS_FILTERS);
  return {
    creditCards: query.data?.data ?? [],
    query,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
  };
}

export function useCreditCardQuery(id: string | null) {
  const s = useSessionKey();
  return useQuery({
    queryKey: queryKeys.creditCards.detail(s, id ?? ''),
    queryFn: () => creditCardsApi.get(id as string),
    enabled: Boolean(id),
  });
}
