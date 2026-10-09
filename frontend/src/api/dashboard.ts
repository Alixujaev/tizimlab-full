import { apiClient } from '@/api/client';
import type { ApiResponse, DashboardDto } from '@/types';

export async function fetchDashboard(): Promise<DashboardDto> {
  const { data } = await apiClient.get<ApiResponse<DashboardDto>>('/dashboard');
  return data.data;
}
