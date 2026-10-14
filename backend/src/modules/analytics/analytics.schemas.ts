import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination.js';

/** D-161: davr chegaralari. */
export const PERIOD_PRESETS = ['7d', '30d', '90d', 'custom'] as const;
export const MAX_CUSTOM_DAYS = 366;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD formatida bo‘lishi kerak')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && toIso(v) === v, {
    message: 'Mavjud sana emas',
  });

function toIso(v: string): string {
  return new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10);
}

const periodShape = {
  period: z.enum(PERIOD_PRESETS).default('30d'),
  from: isoDate.optional(),
  to: isoDate.optional(),
};

type PeriodShape = { period: (typeof PERIOD_PRESETS)[number]; from?: string; to?: string };

/** custom: from/to majburiy, from ≤ to, ≤ 366 kun; kelajak sanasi — service'da (bugungi sana TZ bo'yicha). */
function refinePeriod(v: PeriodShape, ctx: z.RefinementCtx): void {
  if (v.period !== 'custom') return;
  if (!v.from)
    ctx.addIssue({ code: 'custom', path: ['from'], message: 'custom davr uchun majburiy' });
  if (!v.to) ctx.addIssue({ code: 'custom', path: ['to'], message: 'custom davr uchun majburiy' });
  if (!v.from || !v.to) return;
  const days = (Date.parse(v.to) - Date.parse(v.from)) / 86_400_000 + 1;
  if (days < 1) ctx.addIssue({ code: 'custom', path: ['to'], message: 'to ≥ from bo‘lishi kerak' });
  else if (days > MAX_CUSTOM_DAYS)
    ctx.addIssue({ code: 'custom', path: ['to'], message: `Ko‘pi bilan ${MAX_CUSTOM_DAYS} kun` });
}

export const periodQuerySchema = z.object(periodShape).superRefine(refinePeriod);
export type PeriodQuery = z.infer<typeof periodQuerySchema>;

/** Team jadvali saralash kalitlari: faqat formulali ko'rsatkichlar (D-163; "reyting" yo'q). */
export const TEAM_SORT_KEYS = [
  'fullName',
  'role',
  'openSamples',
  'assigned',
  'completed',
  'inProgress',
  'rejected',
  'rejectionRate',
  'firstPassRate',
  'resubmissions',
  'avgCompletionHours',
  'overdueCheckpoints',
  'created',
  'passportsUploaded',
  'createdApproved',
  'createdRejected',
  'avgIntakeHours',
  'reviewedApproved',
  'reviewedRejected',
  'avgReviewHours',
  'assignedByMe',
  'finalized',
  'avgFinalizeHours',
] as const;
export type TeamSortKey = (typeof TEAM_SORT_KEYS)[number];

export const teamQuerySchema = paginationQuerySchema
  .extend({
    ...periodShape,
    role: z.enum(['lab_head', 'chemist', 'kontrolyor', 'director']).optional(),
    sort: z.enum(TEAM_SORT_KEYS).default('fullName'),
    order: z.enum(['asc', 'desc']).default('asc'),
  })
  .superRefine(refinePeriod);
export type TeamQuery = z.infer<typeof teamQuerySchema>;

export const userIdParamSchema = z.object({ id: z.string().uuid() });

export const memberSamplesQuerySchema = paginationQuerySchema
  .extend({
    ...periodShape,
    status: z
      .enum(['pending_assignment', 'in_progress', 'stopped', 'submitted', 'approved', 'rejected'])
      .optional(),
    result: z.enum(['approved', 'rejected', 'open']).optional(),
  })
  .superRefine(refinePeriod);
export type MemberSamplesQuery = z.infer<typeof memberSamplesQuerySchema>;
