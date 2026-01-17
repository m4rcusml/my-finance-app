import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/shared/lib/api/dashboard';
import { queryKeys } from '@/shared/lib/query/keys';

export function useDashboardQuery(
  referenceDate?: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.dashboard.overview({ referenceDate: referenceDate ?? 'current' }),
    queryFn: () => dashboardApi.getOverview(referenceDate),
    enabled: options?.enabled ?? true,
  });
}
