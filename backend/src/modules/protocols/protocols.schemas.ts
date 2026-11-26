import { z } from 'zod';

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
  })
  .default({});
