import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination.js';

export const pharmacopoeiaEnum = z.enum(['EP', 'BP', 'UzDSt', 'USP', 'OTHER']);

export const parameterInputSchema = z
  .object({
    parameterName: z.string().trim().min(1, 'Parametr nomi kiritilishi shart').max(255),
    unit: z.string().trim().max(50).nullable().optional(),
    specMin: z.number().nullable().optional(),
    specMax: z.number().nullable().optional(),
    method: z.string().trim().max(255).nullable().optional(),
    sortOrder: z.number().int().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.specMin !== undefined && val.specMin !== null && val.specMax !== undefined && val.specMax !== null) {
      if (val.specMin > val.specMax) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['specMin'],
          message: 'Minimal qiymat maksimal qiymatdan katta bo‘lishi mumkin emas',
        });
      }
    }
  });

function validateUniqueParameters(
  parameters: Array<{ parameterName: string }> | undefined,
  ctx: z.RefinementCtx,
) {
  if (!parameters || parameters.length === 0) return;
  const seen = new Set<string>();
  for (let i = 0; i < parameters.length; i++) {
    const norm = parameters[i]!.parameterName.trim().toLowerCase();
    if (seen.has(norm)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['parameters', i, 'parameterName'],
        message: 'Takror parametr nomi kiritilgan',
      });
    }
    seen.add(norm);
  }
}

export const createSubstanceSchema = z
  .object({
    nameUz: z.string().trim().min(1, 'Modda nomi (o‘zbekcha) kiritilishi shart').max(255),
    nameRu: z.string().trim().max(255).nullable().optional(),
    nameEn: z.string().trim().max(255).nullable().optional(),
    pharmacopoeia: pharmacopoeiaEnum,
    casNumber: z.string().trim().max(50).nullable().optional(),
    description: z.string().trim().nullable().optional(),
    parameters: z.array(parameterInputSchema).optional(),
  })
  .superRefine((val, ctx) => {
    validateUniqueParameters(val.parameters, ctx);
  });

export const updateSubstanceSchema = z
  .object({
    nameUz: z.string().trim().min(1, 'Modda nomi (o‘zbekcha) kiritilishi shart').max(255).optional(),
    nameRu: z.string().trim().max(255).nullable().optional(),
    nameEn: z.string().trim().max(255).nullable().optional(),
    pharmacopoeia: pharmacopoeiaEnum.optional(),
    casNumber: z.string().trim().max(50).nullable().optional(),
    description: z.string().trim().nullable().optional(),
    isActive: z.boolean().optional(),
    parameters: z.array(parameterInputSchema).optional(),
  })
  .superRefine((val, ctx) => {
    validateUniqueParameters(val.parameters, ctx);
  });

export const listSubstancesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  pharmacopoeia: pharmacopoeiaEnum.optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export type ParameterInput = z.infer<typeof parameterInputSchema>;
export type CreateSubstanceInput = z.infer<typeof createSubstanceSchema>;
export type UpdateSubstanceInput = z.infer<typeof updateSubstanceSchema>;
export type ListSubstancesQuery = z.infer<typeof listSubstancesQuerySchema>;
