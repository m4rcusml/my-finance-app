'use client';

import type { DashboardOverview, DashboardQuery } from '@finance/contracts';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { dashboardApi } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query/keys';
import { useSessionKey } from '@/shared/session/session-provider';

/**
 * The dashboard overview.
 *
 * Every parameter that changes the response (`period`, `referenceDate`, `from`,
 * `to`) is part of the query key, and the key is scoped by session — so
 * switching the period can never serve the previous window's numbers, and
 * signing in as somebody else can never serve the previous user's.
 *
 * The response is a single object, not a paginated envelope, so it is consumed
 * through `<QueryBoundary>` rather than `<PaginatedBoundary>`.
 */
export function useDashboardQuery(
  params: DashboardQuery = {},
  options: { enabled?: boolean } = {},
): UseQueryResult<DashboardOverview> {
  const sessionKey = useSessionKey();

  return useQuery({
    queryKey: queryKeys.dashboard.overview(sessionKey, params),
    queryFn: () => dashboardApi.overview(params),
    // Disabled while the custom range is incomplete: a half-typed range would
    // otherwise be answered with a 422 the user would read as a crash.
    enabled: options.enabled ?? true,
  });
}
