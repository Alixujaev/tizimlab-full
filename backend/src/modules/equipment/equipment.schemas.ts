import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination.js';

export const equipmentStatusEnum = z.enum(['active', 'maintenance', 'out_of_service']);

const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana formati: YYYY-MM-DD')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Sana mavjud emas');

const optText = (max: number) => z.string().trim().max(max).nullable().optional();

export const createEquipmentSchema = z.object({
  name: z.string().trim().min(1, 'Apparat nomi kiritilishi shart').max(255),
  category: z.string().trim().min(1, 'Kategoriya (turi) kiritilishi shart').max(120),
  model: optText(255),
  serialNumber: optText(120),
  location: optText(255),
  status: equipmentStatusEnum.default('active'),
  calibrationDue: isoDay.nullable().optional(),
  notes: optText(2000),
});

export const updateEquipmentSchema = createEquipmentSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Kamida bitta maydon o‘zgartirilishi kerak');

export const listEquipmentQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  category: z.string().trim().max(120).optional(),
  status: equipmentStatusEnum.optional(),
  /** Kalibrlash muddati bugundan N kun ichida (yoki o'tgan) */
  calibrationDueWithinDays: z.coerce.number().int().min(0).max(365).optional(),
});

export const equipmentIdParamSchema = z.object({ id: z.string().uuid() });

export type CreateEquipmentInput = z.infer<typeof createEquipmentSchema>;
export type UpdateEquipmentInput = z.infer<typeof updateEquipmentSchema>;
export type ListEquipmentQuery = z.infer<typeof listEquipmentQuerySchema>;
