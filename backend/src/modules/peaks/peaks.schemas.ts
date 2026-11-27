import { z } from 'zod';

const num = (max: number) => z.coerce.number().finite().min(0).max(max);

/** D-193: bitta peak qatori (qo'lda kiritish / tahrirlash). RT majburiy, qolgani ixtiyoriy. */
export const peakResultSchema = z
  .object({
    peakName: z.string().trim().max(120).nullable().optional(),
    retentionTime: z.coerce.number().finite().positive('RT musbat bo‘lishi shart').max(100_000),
    area: num(1e13).nullable().optional(),
    height: num(1e13).nullable().optional(),
    areaPercent: num(100).nullable().optional(),
    tailing: z.coerce.number().finite().positive().max(100).nullable().optional(),
    plates: num(1e9).nullable().optional(),
    resolution: num(1000).nullable().optional(),
  })
  .strict();
export type PeakResultInput = z.infer<typeof peakResultSchema>;

export const peakFileParamSchema = z.object({ fileId: z.string().uuid('Fayl ID si noto‘g‘ri') });
export const peakResultParamSchema = z.object({ id: z.string().uuid('ID noto‘g‘ri') });

export const extractPeaksBodySchema = z.object({
  protocolFileId: z.string().uuid('Peak fayli ID si noto‘g‘ri'),
});

// ---- AI peak jadvali javobi (qat'iy) ----
const nullableNum = z.string().max(40).nullable();
export const aiPeakRowSchema = z
  .object({
    peak_name: z.string().max(120).nullable(),
    retention_time: z.string().max(40),
    area: nullableNum,
    height: nullableNum,
    area_percent: nullableNum,
    tailing: nullableNum,
    plates: nullableNum,
    resolution: nullableNum,
    confidence: z.enum(['high', 'medium', 'low']),
  })
  .strict();
export const aiPeaksResultSchema = z
  .object({
    image_quality: z.enum(['good', 'poor', 'unreadable']),
    peaks: z.array(aiPeakRowSchema).max(100),
  })
  .strict();

const ns = { type: ['string', 'null'] } as const;
export const AI_PEAKS_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    image_quality: { type: 'string', enum: ['good', 'poor', 'unreadable'] },
    peaks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          peak_name: ns,
          retention_time: { type: 'string' },
          area: ns,
          height: ns,
          area_percent: ns,
          tailing: ns,
          plates: ns,
          resolution: ns,
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: [
          'peak_name',
          'retention_time',
          'area',
          'height',
          'area_percent',
          'tailing',
          'plates',
          'resolution',
          'confidence',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['image_quality', 'peaks'],
  additionalProperties: false,
};
