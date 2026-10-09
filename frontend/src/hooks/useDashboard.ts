import { useQuery } from '@tanstack/react-query';
import { fetchDashboard } from '@/api/dashboard';

export const dashboardKeys = { all: ['dashboard'] as const };

export function useDashboardQuery() {
  return useQuery({ queryKey: dashboardKeys.all, queryFn: fetchDashboard });
}
