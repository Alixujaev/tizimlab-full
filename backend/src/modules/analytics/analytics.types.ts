import type { Role } from '../auth/auth.types.js';
import type { SampleStatus, SampleType } from '../samples/samples.types.js';

/** D-161: hisoblangan davr. `start`/`end` — UTC instantlar, `[start, end)`. */
export interface ResolvedPeriod {
  from: string;
  to: string;
  days: number;
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  bucket: 'day' | 'week';
}

export interface PeriodDto {
  from: string;
  to: string;
  days: number;
  bucket: 'day' | 'week';
  previousFrom: string;
  previousTo: string;
}

/** Ko'rinish doirasi (D-159): company > team > self. */
export type AnalyticsScope = 'company' | 'team' | 'self';

export interface Viewer {
  userId: string;
  companyId: string;
  role: Role;
  scope: AnalyticsScope;
}

export type MetricUnit = 'count' | 'percent' | 'hours';

/** `previous` — oldingi davr qiymati; snapshot ko'rsatkichlarda `null`. `null` qiymat = "ma'lumot yo'q". */
export interface KpiDto {
  key: string;
  unit: MetricUnit;
  value: number | null;
  previous: number | null;
  snapshot: boolean;
}

export interface TrendPoint {
  date: string;
  value: number;
}

export interface NamedCount {
  key: string;
  label: string | null;
  value: number;
}

export interface ActivityItem {
  kind: 'tracking' | 'signature';
  action: string;
  at: string;
  sampleId: string | null;
  substanceName: string | null;
  reason: string | null;
}

export interface AnalyticsUserDto {
  id: string;
  fullName: string;
  role: Role;
  isActive: boolean;
}

export interface UserAnalyticsDto {
  user: AnalyticsUserDto;
  period: PeriodDto;
  kpis: KpiDto[];
  trend: { key: string; points: TrendPoint[] };
  outcomes: NamedCount[];
  reasons: NamedCount[];
  activity: ActivityItem[];
}

export interface TeamRowDto extends AnalyticsUserDto {
  metrics: Record<string, number | null>;
  openSamples: number;
}

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

export interface OverviewDto {
  period: PeriodDto;
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
