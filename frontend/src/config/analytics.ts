import type { Role } from '@/types';

/**
 * D-159: analitika ko'rinishi rollar bo'yicha. admin va super_admin — yo'q
 * (frontend ularga so'rov ham yubormaydi; backend 403).
 */
export const ANALYTICS_ROLES = [
  'kontrolyor',
  'chemist',
  'lab_head',
  'director',
] as const satisfies readonly Role[];
/** Xodimlar jadvali va xodim kartasi (/team, /team/:id). */
export const TEAM_ANALYTICS_ROLES = ['lab_head', 'director'] as const satisfies readonly Role[];
/** Kompaniya darajasidagi overview. */
export const COMPANY_ANALYTICS_ROLES = ['director'] as const satisfies readonly Role[];

export const hasRole = (roles: readonly Role[], role: Role | undefined): boolean =>
  !!role && roles.includes(role);

/** Qaysi tomonga o'zgarish yaxshi (▲▼ rangi uchun; `none` — neytral). */
export const METRIC_BETTER: Record<string, 'up' | 'down' | 'none'> = {
  assigned: 'none',
  completed: 'up',
  inProgress: 'none',
  rejected: 'down',
  rejectionRate: 'down',
  firstPassRate: 'up',
  resubmissions: 'down',
  avgCompletionHours: 'down',
  overdueCheckpoints: 'down',
  created: 'none',
  passportsUploaded: 'none',
  createdApproved: 'up',
  createdRejected: 'down',
  avgIntakeHours: 'down',
  reviewedApproved: 'none',
  reviewedRejected: 'none',
  avgReviewHours: 'down',
  assignedByMe: 'none',
  queueApprovals: 'down',
  queueAssignments: 'down',
  finalized: 'up',
  avgFinalizeHours: 'down',
  samplesCreated: 'none',
  samplesApproved: 'up',
  protocolsFinalized: 'up',
  avgTatHours: 'down',
  openSamples: 'none',
  lateSamples: 'down',
};

/** Rol bo'yicha xodim ko'rsatkichlari (backend `ROLE_KPIS` bilan bir xil tartib) — jadval ustunlari. */
export const ROLE_METRIC_KEYS: Partial<Record<Role, readonly string[]>> = {
  chemist: [
    'assigned',
    'completed',
    'inProgress',
    'rejected',
    'rejectionRate',
    'firstPassRate',
    'resubmissions',
    'avgCompletionHours',
    'overdueCheckpoints',
  ],
  kontrolyor: [
    'created',
    'passportsUploaded',
    'createdApproved',
    'createdRejected',
    'avgIntakeHours',
  ],
  lab_head: [
    'reviewedApproved',
    'reviewedRejected',
    'avgReviewHours',
    'assignedByMe',
    'queueApprovals',
    'queueAssignments',
  ],
  director: ['finalized', 'avgFinalizeHours'],
};

export const PERCENT_METRICS = new Set(['rejectionRate', 'firstPassRate']);
export const HOUR_METRICS = new Set([
  'avgCompletionHours',
  'avgIntakeHours',
  'avgReviewHours',
  'avgFinalizeHours',
  'avgTatHours',
]);
