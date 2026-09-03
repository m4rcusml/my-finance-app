'use client';

import {
  type Account,
  type Category,
  type CreditCard,
  MAX_PAGE_SIZE,
  type PaginatedResponse,
} from '@finance/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { accountsApi, categoriesApi, creditCardsApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { useSessionKey } from '@/shared/session/session-provider';

/**
 * Selector data for the template dialog and label maps for the tables.
 *
 * A `FixedTransaction` carries only `categoryId` / `accountId` / `creditCardId`,
 * so the list needs these to print a human name. They live here, inside this
 * feature, rather than reaching into another feature's folder.
 *
 * They deliberately reuse the shared `queryKeys` for those resources, so the
 * accounts screen and this screen share one cache entry instead of two.
 *
 * V1 limitation: a single page of `MAX_PAGE_SIZE` rows. That is the ceiling the
 * API allows in one request, and it is far above a realistic number of accounts,
 * cards or categories for one person. An id with no match renders as `—`, never
 * as a crash.
 */

const LOOKUP_QUERY = { page: 1, limit: MAX_PAGE_SIZE } as const;

export function useAccountOptionsQuery(): UseQueryResult<PaginatedResponse<Account>> {
  const session = useSessionKey();
  return useQuery({
    queryKey: queryKeys.accounts.list(session, LOOKUP_QUERY),
    queryFn: () => accountsApi.list(LOOKUP_QUERY),
  });
}

export function useCreditCardOptionsQuery(): UseQueryResult<PaginatedResponse<CreditCard>> {
  const session = useSessionKey();
  return useQuery({
    queryKey: queryKeys.creditCards.list(session, LOOKUP_QUERY),
    queryFn: () => creditCardsApi.list(LOOKUP_QUERY),
  });
}

export function useCategoryOptionsQuery(): UseQueryResult<PaginatedResponse<Category>> {
  const session = useSessionKey();
  return useQuery({
    queryKey: queryKeys.categories.list(session, LOOKUP_QUERY),
    queryFn: () => categoriesApi.list(LOOKUP_QUERY),
  });
}

export interface SourceLookups {
  accounts: Account[];
  creditCards: CreditCard[];
  categories: Category[];
  accountNames: Map<string, string>;
  creditCardNames: Map<string, string>;
  categoryNames: Map<string, string>;
  isPending: boolean;
  isError: boolean;
}

/** The three selectors as one bundle, with id -> name maps for the tables. */
export function useSourceLookups(): SourceLookups {
  const accountsQuery = useAccountOptionsQuery();
  const creditCardsQuery = useCreditCardOptionsQuery();
  const categoriesQuery = useCategoryOptionsQuery();

  // Memoised on the query envelope, not recreated per render, so the maps below
  // stay referentially stable while nothing has been refetched.
  const accounts = useMemo(() => accountsQuery.data?.data ?? [], [accountsQuery.data]);
  const creditCards = useMemo(() => creditCardsQuery.data?.data ?? [], [creditCardsQuery.data]);
  const categories = useMemo(() => categoriesQuery.data?.data ?? [], [categoriesQuery.data]);

  const accountNames = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);
  const creditCardNames = useMemo(() => new Map(creditCards.map((card) => [card.id, card.name])), [creditCards]);
  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  return {
    accounts,
    creditCards,
    categories,
    accountNames,
    creditCardNames,
    categoryNames,
    isPending: accountsQuery.isPending || creditCardsQuery.isPending || categoriesQuery.isPending,
    isError: accountsQuery.isError || creditCardsQuery.isError || categoriesQuery.isError,
  };
}
