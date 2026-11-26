import { z } from 'zod';

export const consumptionIdParamSchema = z.object({ id: z.string().uuid() });
export const protocolConsumptionsParamSchema = z.object({ protocolId: z.string().uuid() });

/** D-177: tuzatish — yangi umumiy miqdor (sarf birligida, 0 — hammasi qaytariladi) va majburiy sabab. */
export const correctConsumptionSchema = z.object({
  quantity: z.coerce.number().min(0, 'Miqdor manfiy bo‘lishi mumkin emas').max(1_000_000),
  reason: z
    .string()
    .trim()
    .min(5, 'Tuzatish sababi kamida 5 ta belgidan iborat bo‘lishi shart')
    .max(1000),
});

export type CorrectConsumptionInput = z.infer<typeof correctConsumptionSchema>;
