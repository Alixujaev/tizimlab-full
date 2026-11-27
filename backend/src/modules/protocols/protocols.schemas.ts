import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination.js';

export const rejectProtocolSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Rad etish sababi kamida 5 ta belgidan iborat bo‘lishi shart'),
});

export const protocolIdParamSchema = z.object({
  id: z.string().uuid('Protokol identifikatori noto‘g‘ri formatda'),
});

export const sampleIdParamSchema = z.object({
  sampleId: z.string().uuid('Namuna identifikatori noto‘g‘ri formatda'),
});

export const protocolFileIdParamSchema = z.object({
  id: z.string().uuid('Protokol identifikatori noto‘g‘ri formatda'),
  fileId: z.string().uuid('Fayl identifikatori noto‘g‘ri formatda'),
});

export const exportProtocolQuerySchema = z.object({
  lang: z.enum(['uz', 'ru', 'en'], {
    message: 'Til faqat uz, ru yoki en bo‘lishi mumkin',
  }).default('uz'),
});

/** D-173: yuborishda xona (sensor) va ixtiyoriy tahlil sanasi — harorat snapshot'i uchun. */
export const submitProtocolSchema = z
  .object({
    sensorConfigId: z.string().uuid('Xona (sensor) ID si to‘g‘ri UUID bo‘lishi kerak').nullable().optional(),
    analysisDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana formati: YYYY-MM-DD')
      .refine((v) => {
        const d = new Date(`${v}T00:00:00Z`);
        return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
      }, 'Sana mavjud emas')
      .nullable()
      .optional(),
    /** D-177: tahlil bajarilgan ND (tasdiqlangan) va tahlillar soni — avto-sarf uchun */
    ndId: z.string().uuid('ND ID si to‘g‘ri UUID bo‘lishi kerak').nullable().optional(),
    nAnalyses: z.coerce.number().int().min(1).max(100).optional(),
    /** P18 (D-184): apparat (P17 ro'yxati); null — "noma'lum" (oqim bloklanmaydi) */
    equipmentId: z.string().uuid('Apparat ID si to‘g‘ri UUID bo‘lishi kerak').nullable().optional(),
  })
  .default({});

const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana formati: YYYY-MM-DD')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Sana mavjud emas');

/** P18 (D-187): global protokollar ro'yxati filtrlari. `equipmentId=unknown` — apparatsiz protokollar. */
export const protocolListQuerySchema = paginationQuerySchema
  .extend({
    substanceName: z.string().trim().max(200).optional(),
    series: z.string().trim().max(100).optional(),
    dateFrom: isoDay.optional(),
    dateTo: isoDay.optional(),
    chemistId: z.string().uuid('Kimyogar ID si to‘g‘ri UUID bo‘lishi kerak').optional(),
    equipmentId: z.union([z.literal('unknown'), z.string().uuid('Apparat ID si noto‘g‘ri')]).optional(),
    status: z.enum(['draft', 'submitted', 'approved', 'rejected', 'finalized']).optional(),
    hasPeaks: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
  })
  .refine((q) => !q.dateFrom || !q.dateTo || q.dateFrom <= q.dateTo, {
    path: ['dateTo'],
    message: 'Sana oralig‘i noto‘g‘ri: «dan» sanasi «gacha» sanasidan keyin',
  });
export type ProtocolListQuery = z.infer<typeof protocolListQuerySchema>;

/** P18 (D-188): yuborishdan oldin harorat taklifi (xona va sana o'zgartirilishi mumkin). */
export const temperatureSuggestionQuerySchema = z.object({
  sensorConfigId: z.string().uuid('Xona (sensor) ID si noto‘g‘ri').optional(),
  analysisDate: isoDay.optional(),
});
export type TemperatureSuggestionQuery = z.infer<typeof temperatureSuggestionQuerySchema>;
