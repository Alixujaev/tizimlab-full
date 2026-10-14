import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import {
  fetchAnalyticsOverview,
  fetchAnalyticsTeam,
  fetchMemberSamples,
  fetchMyAnalytics,
  fetchUserAnalytics,
  type MemberSamplesParams,
  type TeamParams,
} from '@/api/analytics';
import {
  ANALYTICS_ROLES,
  COMPANY_ANALYTICS_ROLES,
  hasRole,
  TEAM_ANALYTICS_ROLES,
} from '@/config/analytics';
import { useAuthStore } from '@/store/authStore';
import type { AnalyticsPeriod, AnalyticsPeriodPreset } from '@/types';

export const analyticsKeys = {
  all: ['analytics'] as const,
  overview: (p: AnalyticsPeriod) => ['analytics', 'overview', p] as const,
  team: (p: TeamParams) => ['analytics', 'team', p] as const,
  user: (id: string, p: AnalyticsPeriod) => ['analytics', 'user', id, p] as const,
  samples: (id: string, p: MemberSamplesParams) => ['analytics', 'samples', id, p] as const,
};

const PRESETS: readonly AnalyticsPeriodPreset[] = ['7d', '30d', '90d'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Davr URL query'da (`?period=30d` yoki `?period=custom&from=…&to=…`) — havola bilan ulashiladi. */
export function usePeriodParam(): [AnalyticsPeriod, (p: AnalyticsPeriod) => void] {
  const [search, setSearch] = useSearchParams();
  const raw = search.get('period');
  const from = search.get('from');
  const to = search.get('to');
  const period = useMemo<AnalyticsPeriod>(() => {
    if (raw === 'custom' && from && to && ISO.test(from) && ISO.test(to)) {
      return { period: 'custom', from, to };
    }
    const preset = PRESETS.find((p) => p === raw);
    return { period: preset ?? '30d' };
  }, [raw, from, to]);
  const set = useCallback(
    (p: AnalyticsPeriod) =>
      setSearch(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('period', p.period);
          if (p.period === 'custom' && p.from && p.to) {
            next.set('from', p.from);
            next.set('to', p.to);
          } else {
            next.delete('from');
            next.delete('to');
          }
          next.delete('page');
          return next;
        },
        { replace: true },
      ),
    [setSearch],
  );
  return [period, set];
}

const useRole = () => useAuthStore((s) => s.user?.role);

/** Ruxsatsiz rolda so'rov umuman yuborilmaydi (`enabled: false`) — D-159. */
export function useAnalyticsOverview(p: AnalyticsPeriod) {
  const role = useRole();
  return useQuery({
    queryKey: analyticsKeys.overview(p),
    queryFn: () => fetchAnalyticsOverview(p),
    enabled: hasRole(COMPANY_ANALYTICS_ROLES, role),
    placeholderData: keepPreviousData,
  });
}

export function useAnalyticsTeam(p: TeamParams) {
  const role = useRole();
  return useQuery({
    queryKey: analyticsKeys.team(p),
    queryFn: () => fetchAnalyticsTeam(p),
    enabled: hasRole(TEAM_ANALYTICS_ROLES, role),
    placeholderData: keepPreviousData,
  });
}

/** `id = 'me'` — o'z ko'rsatkichlari; boshqa id — faqat jamoa rollari uchun. */
export function useUserAnalytics(id: string, p: AnalyticsPeriod) {
  const role = useRole();
  const me = id === 'me';
  return useQuery({
    queryKey: analyticsKeys.user(id, p),
    queryFn: () => (me ? fetchMyAnalytics(p) : fetchUserAnalytics(id, p)),
    enabled: hasRole(me ? ANALYTICS_ROLES : TEAM_ANALYTICS_ROLES, role),
    placeholderData: keepPreviousData,
  });
}

export function useMemberSamples(id: string | undefined, p: MemberSamplesParams) {
  const role = useRole();
  return useQuery({
    queryKey: analyticsKeys.samples(id ?? '', p),
    queryFn: () => fetchMemberSamples(id!, p),
    enabled: !!id && hasRole(ANALYTICS_ROLES, role),
    placeholderData: keepPreviousData,
  });
}
