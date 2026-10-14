// P13: xodimlar analitikasi (D-159..D-165) — backend `analytics.types.ts` bilan mos.
import type { Role, SampleStatus, SampleType } from './index';

export type AnalyticsPeriodPreset = '7d' | '30d' | '90d' | 'custom';
export interface AnalyticsPeriod {
  period: AnalyticsPeriodPreset;
  from?: string;
  to?: string;
}

export interface AnalyticsPeriodDto {
  from: string;
  to: string;
  days: number;
  bucket: 'day' | 'week';
  previousFrom: string;
  previousTo: string;
}

export type MetricUnit = 'count' | 'percent' | 'hours';

export interface KpiDto {
  key: string;
  unit: MetricUnit;
  value: number | null;
  previous: number | null;
  snapshot: boolean;
}

export interface NamedCount {
  key: string;
  label: string | null;
  value: number;
}

export interface AnalyticsActivityItem {
  kind: 'tracking' | 'signature';
  action: string;
  at: string;
  sampleId: string | null;
  substanceName: string | null;
  reason: string | null;
}

export interface AnalyticsUser {
  id: string;
  fullName: string;
  role: Role;
  isActive: boolean;
}

export interface UserAnalyticsDto {
  user: AnalyticsUser;
  period: AnalyticsPeriodDto;
  kpis: KpiDto[];
  trend: { key: string; points: { date: string; value: number }[] };
  outcomes: NamedCount[];
  reasons: NamedCount[];
  activity: AnalyticsActivityItem[];
}

export interface TeamRowDto extends AnalyticsUser {
  metrics: Record<string, number | null>;
  openSamples: number;
}

/** Namuna kodi yo'q (D-68, D-84) — namuna modda nomi, tur, lot/seriya bilan ko'rsatiladi. */
export interface MemberSampleDto {
  id: string;
  substanceName: string;
  type: SampleType;
  lotNumber: string | null;
  serialNumber: string | null;
  status: SampleStatus;
  result: 'approved' | 'rejected' | 'open';
  assignedAt: string | null;
  approvedAt: string | null;
  durationHours: number | null;
  analysisEnd: string | null;
  isLate: boolean;
  lastRejectionReason: string | null;
}

export interface LateSampleDto {
  id: string;
  substanceName: string;
  type: SampleType;
  status: SampleStatus;
  analysisEnd: string;
  daysLate: number;
  assigneeId: string | null;
  assigneeName: string | null;
}

export interface AnalyticsOverviewDto {
  period: AnalyticsPeriodDto;
  kpis: KpiDto[];
  trend: { date: string; created: number; approved: number }[];
  funnel: NamedCount[];
  reasons: NamedCount[];
  byType: NamedCount[];
  lateSamples: LateSampleDto[];
  workload: { userId: string; fullName: string; open: number }[];
  temperature: { unresolvedAlerts: number; alertsInPeriod: number };
  stability: { activeStudies: number; overdueCheckpoints: number; dueSoonCheckpoints: number };
}
