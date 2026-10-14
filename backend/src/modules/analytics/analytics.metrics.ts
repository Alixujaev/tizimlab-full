import type { Role } from '../auth/auth.types.js';
import type { MetricUnit } from './analytics.types.js';

/**
 * D-163: xodim ko'rsatkichlari. Formulalar `docs/spec/19-analytics.md` da; SQL — analytics.service.ts.
 * `snapshot` — davrga bog'liq emas (joriy holat), oldingi davr bilan taqqoslanmaydi.
 */
export interface MetricDef {
  key: string;
  unit: MetricUnit;
  snapshot?: boolean;
}

export const ROLE_KPIS: Partial<Record<Role, readonly MetricDef[]>> = {
  chemist: [
    { key: 'assigned', unit: 'count' },
    { key: 'completed', unit: 'count' },
    { key: 'inProgress', unit: 'count', snapshot: true },
    { key: 'rejected', unit: 'count' },
    { key: 'rejectionRate', unit: 'percent' },
    { key: 'firstPassRate', unit: 'percent' },
    { key: 'resubmissions', unit: 'count' },
    { key: 'avgCompletionHours', unit: 'hours' },
    { key: 'overdueCheckpoints', unit: 'count', snapshot: true },
  ],
  kontrolyor: [
    { key: 'created', unit: 'count' },
    { key: 'passportsUploaded', unit: 'count' },
    { key: 'createdApproved', unit: 'count' },
    { key: 'createdRejected', unit: 'count' },
    { key: 'avgIntakeHours', unit: 'hours' },
  ],
  lab_head: [
    { key: 'reviewedApproved', unit: 'count' },
    { key: 'reviewedRejected', unit: 'count' },
    { key: 'avgReviewHours', unit: 'hours' },
    { key: 'assignedByMe', unit: 'count' },
    { key: 'queueApprovals', unit: 'count', snapshot: true },
    { key: 'queueAssignments', unit: 'count', snapshot: true },
  ],
  director: [
    { key: 'finalized', unit: 'count' },
    { key: 'avgFinalizeHours', unit: 'hours' },
  ],
};

/** Kompaniya KPI (overview). */
export const COMPANY_KPIS: readonly MetricDef[] = [
  { key: 'samplesCreated', unit: 'count' },
  { key: 'samplesApproved', unit: 'count' },
  { key: 'protocolsFinalized', unit: 'count' },
  { key: 'rejectionRate', unit: 'percent' },
  { key: 'firstPassRate', unit: 'percent' },
  { key: 'avgTatHours', unit: 'hours' },
  { key: 'openSamples', unit: 'count', snapshot: true },
  { key: 'lateSamples', unit: 'count', snapshot: true },
];

/** Foiz: maxraj 0 → null ("ma'lumot yo'q"); 1 xona. */
export function percent(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/** Soat: null saqlanadi; 1 xona. */
export function hours(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  return Math.round(Number(v) * 10) / 10;
}
