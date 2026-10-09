import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination.js';
import { sampleTypeEnum } from '../samples/samples.schemas.js';

/** API sanasi — ISO `YYYY-MM-DD` (D-110); UI'da DD.MM.YYYY ga o'giriladi. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana formati: YYYY-MM-DD')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Sana mavjud emas');

const text = z.string().trim().max(200).optional();

export const registryListQuerySchema = paginationQuerySchema
  .extend({
    type: sampleTypeEnum.optional(),
    substanceName: text,
    serialNumber: text,
    lotNumber: text,
    approvedFrom: isoDate.optional(),
    approvedTo: isoDate.optional(),
    unfinalizedOnly: z.coerce.boolean().optional(),
  })
  .refine((q) => !q.approvedFrom || !q.approvedTo || q.approvedFrom <= q.approvedTo, {
    path: ['approvedTo'],
    message: 'Sana oralig‘i noto‘g‘ri: «dan» sanasi «gacha» sanasidan keyin',
  });

export type RegistryListQuery = z.infer<typeof registryListQuerySchema>;
