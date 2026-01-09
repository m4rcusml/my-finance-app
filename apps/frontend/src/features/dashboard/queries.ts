import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/shared/lib/api/dashboard';

export function useDashboardQuery(referenceDate?: string) {
  return useQuery({
    queryKey: ['dashboard', referenceDate ?? 'current'],
    queryFn: () => dashboardApi.getOverview(referenceDate),
  });
}
