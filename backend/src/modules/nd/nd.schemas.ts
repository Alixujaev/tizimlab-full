import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination.js';

export const ndStatusEnum = z.enum(['draft', 'approved', 'archived']);

export const createNdSchema = z.object({
  code: z.string().trim().min(1, 'ND kodi kiritilishi shart').max(100),
  name: z.string().trim().min(1, 'ND nomi kiritilishi shart').max(500),
  version: z.string().trim().max(50).nullable().optional(),
});

export const updateNdSchema = createNdSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Kamida bitta maydon o‘zgartirilishi kerak');

export const listNdQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  status: ndStatusEnum.optional(),
});

export const ndIdParamSchema = z.object({ id: z.string().uuid() });
export const ndRequirementParamSchema = z.object({
  id: z.string().uuid(),
  reqId: z.string().uuid(),
});

const reqBase = {
  methodName: z.string().trim().max(255).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
};

/**
 * D-176: talab — apparat (kategoriya bo'yicha) yoki reaktiv (katalog elementi + bir tahlil uchun miqdor va birlik).
 * P18 da AI shu shaklni to'ldiradi (`source: 'ai'`), hozir qo'lda.
 */
export const ndRequirementSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('equipment'),
    equipmentCategory: z.string().trim().min(1, 'Apparat kategoriyasi kiritilishi shart').max(120),
    ...reqBase,
  }),
  z.object({
    kind: z.literal('reagent'),
    reagentItemId: z.string().uuid('Reaktiv tanlanishi shart'),
    quantityPerAnalysis: z.coerce
      .number()
      .positive('Miqdor musbat bo‘lishi shart')
      .max(1_000_000)
      .refine((v) => Number.isInteger(Math.round(v * 10_000)), 'Ko‘pi bilan 4 xona kasr'),
    unit: z.string().trim().min(1, 'Birlik kiritilishi shart').max(30),
    ...reqBase,
  }),
]);

export const feasibilityQuerySchema = z.object({
  n: z.coerce.number().int().min(1).max(100).default(1),
});
export const feasibilityBodySchema = z
  .object({ nAnalyses: z.coerce.number().int().min(1).max(100).default(1) })
  .default({ nAnalyses: 1 });

export type CreateNdInput = z.infer<typeof createNdSchema>;
export type UpdateNdInput = z.infer<typeof updateNdSchema>;
export type ListNdQuery = z.infer<typeof listNdQuerySchema>;
export type NdRequirementInput = z.infer<typeof ndRequirementSchema>;
