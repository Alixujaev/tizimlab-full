import { apiClient } from '@/api/client';
import type {
  AnalyticsOverviewDto,
  AnalyticsPeriod,
  ApiResponse,
  MemberSampleDto,
  Paginated,
  TeamRowDto,
  UserAnalyticsDto,
} from '@/types';

export interface TeamParams extends AnalyticsPeriod {
  role?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface MemberSamplesParams extends AnalyticsPeriod {
  status?: string;
  result?: string;
  page?: number;
  limit?: number;
}

/** Bo'sh qiymatlarsiz query (custom bo'lmasa from/to yuborilmaydi). */
function toQuery(p: object): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  const custom = (p as AnalyticsPeriod).period === 'custom';
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null || v === '') continue;
    if (!custom && (k === 'from' || k === 'to')) continue;
    out[k] = v as string | number;
  }
  return out;
}

export async function fetchAnalyticsOverview(p: AnalyticsPeriod): Promise<AnalyticsOverviewDto> {
  const { data } = await apiClient.get<ApiResponse<AnalyticsOverviewDto>>('/analytics/overview', {
    params: toQuery(p),
  });
  return data.data;
}

export async function fetchAnalyticsTeam(p: TeamParams): Promise<Paginated<TeamRowDto>> {
  const { data } = await apiClient.get<Paginated<TeamRowDto>>('/analytics/team', {
    params: toQuery(p),
  });
  return data;
}

export async function fetchMyAnalytics(p: AnalyticsPeriod): Promise<UserAnalyticsDto> {
  const { data } = await apiClient.get<ApiResponse<UserAnalyticsDto>>('/analytics/me', {
    params: toQuery(p),
  });
  return data.data;
}

export async function fetchUserAnalytics(
  id: string,
  p: AnalyticsPeriod,
): Promise<UserAnalyticsDto> {
  const { data } = await apiClient.get<ApiResponse<UserAnalyticsDto>>(`/analytics/users/${id}`, {
    params: toQuery(p),
  });
  return data.data;
}

export async function fetchMemberSamples(
  id: string,
  p: MemberSamplesParams,
): Promise<Paginated<MemberSampleDto>> {
  const { data } = await apiClient.get<Paginated<MemberSampleDto>>(
    `/analytics/users/${id}/samples`,
    { params: toQuery(p) },
  );
  return data;
}
