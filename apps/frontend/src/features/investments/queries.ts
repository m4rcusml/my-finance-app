'use client';

import type {
  InvestmentType,
  InvestmentWithAsset,
  MarketAsset,
  PaginatedResponse,
  PortfolioSummary,
} from '@finance/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { investmentsApi, marketAssetsApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { useSessionKey } from '@/shared/session/session-provider';

/**
 * Investment queries.
 *
 * Every list endpoint answers with `PaginatedResponse<T>`, so these hooks are
 * typed as such and the screens read `.data` / `.meta` — never array methods on
 * the envelope itself. Every filter that changes the response (`page`, `limit`
 * and `type`) is part of the query key, under the session scope.
 */

export interface InvestmentFilters {
  page: number;
  limit: number;
  /** `undefined` means "todos os tipos". */
  type?: InvestmentType;
}

export function useInvestmentsQuery(
  filters: InvestmentFilters,
): UseQueryResult<PaginatedResponse<InvestmentWithAsset>> {
  const s = useSessionKey();
  const query = { page: filters.page, limit: filters.limit, type: filters.type };

  return useQuery({
    queryKey: queryKeys.investments.list(s, query),
    queryFn: () => investmentsApi.list(query),
  });
}

/**
 * Cost basis only. The API has no market prices in V1, so there is no current
 * value, no profit and no return — the UI must not invent any.
 */
export function usePortfolioSummaryQuery(): UseQueryResult<PortfolioSummary> {
  const s = useSessionKey();

  return useQuery({
    queryKey: queryKeys.investments.summary(s),
    queryFn: () => investmentsApi.summary(),
  });
}

export interface MarketAssetFilters {
  page: number;
  limit: number;
}

/** Feeds the "ativo" selector; a single generous page is enough for V1. */
export function useMarketAssetsQuery(
  filters: MarketAssetFilters = { page: 1, limit: 100 },
): UseQueryResult<PaginatedResponse<MarketAsset>> {
  const s = useSessionKey();
  const query = { page: filters.page, limit: filters.limit };

  return useQuery({
    queryKey: queryKeys.marketAssets.list(s, query),
    queryFn: () => marketAssetsApi.list(query),
  });
}
