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
