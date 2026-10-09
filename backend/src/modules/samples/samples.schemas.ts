import { z } from 'zod';

export const sampleTypeEnum = z.enum([
  'raw_material',
  'finished_product',
  'reagent',
  'standard_substance',
  'other',
]);

export const sampleStatusEnum = z.enum([
  'pending_assignment',
  'in_progress',
  'stopped',
  'submitted',
  'approved',
  'rejected',
]);

export const createSampleSchema = z.object({
  type: sampleTypeEnum,
  substanceId: z.string().uuid().optional().nullable(),
  substanceName: z
    .string()
    .trim()
    .min(1, 'Modda nomi kiritilishi shart')
    .max(500, 'Modda nomi 500 belgidan oshmasligi kerak'),
  serialNumber: z.string().trim().max(100).optional().nullable(),
  lotNumber: z.string().trim().max(100).optional().nullable(),
  quantity: z.string().trim().max(50).optional().nullable(),
  manufacturer: z.string().trim().max(255).optional().nullable(),
  manufacturedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana formati: YYYY-MM-DD')
    .optional()
    .nullable(),
  analysisStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana formati: YYYY-MM-DD')
    .optional()
    .nullable(),
  analysisEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana formati: YYYY-MM-DD')
    .optional()
    .nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const listSamplesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: sampleStatusEnum.optional(),
  type: sampleTypeEnum.optional(),
  substanceId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
});

export const assignSampleSchema = z.object({
  chemistId: z.string().uuid('Kimyogar ID si to‘g‘ri UUID bo‘lishi kerak'),
});

export const stopSampleSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'To‘xtatish sababi kamida 5 ta belgidan iborat bo‘lishi shart')
    .max(1000, 'Sabab 1000 belgidan oshmasligi kerak'),
});

export const resumeSampleSchema = z.object({
  reason: z.string().trim().max(1000).optional().nullable(),
});

export type CreateSampleInput = z.infer<typeof createSampleSchema>;
export type ListSamplesQuery = z.infer<typeof listSamplesQuerySchema>;
export type AssignSampleInput = z.infer<typeof assignSampleSchema>;
export type StopSampleInput = z.infer<typeof stopSampleSchema>;
export type ResumeSampleInput = z.infer<typeof resumeSampleSchema>;

/** Pasportni ko'rib chiqish: rad etishda sabab majburiy, kamida 5 belgi (Q-17, D-85). */
export const reviewPassportSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    reason: z
      .string()
      .trim()
      .max(1000, 'Sabab 1000 belgidan oshmasligi kerak')
      .optional()
      .nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.decision === 'reject' && (v.reason ?? '').length < 5) {
      ctx.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Rad etish sababi kamida 5 ta belgidan iborat bo‘lishi shart',
      });
    }
  });

export type ReviewPassportInput = z.infer<typeof reviewPassportSchema>;
