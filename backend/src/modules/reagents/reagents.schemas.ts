import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination.js';
import { aiReviewRefSchema } from '../ai/ai.schemas.js';

const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana formati: YYYY-MM-DD')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Sana mavjud emas');

/** P18 (D-183): lot maydonlari — yaratish va tahrirlashda bir xil. */
const lotFields = {
  lotNumber: z.string().trim().max(100).nullable().optional(),
  manufacturer: z.string().trim().max(255).nullable().optional(),
  manufacturedAt: isoDay.nullable().optional(),
  arrivalDate: isoDay.nullable().optional(),
};

const expiryAfterManufacture = (
  v: { expiresAt?: string | null; manufacturedAt?: string | null },
  ctx: z.RefinementCtx,
) => {
  if (v.expiresAt && v.manufacturedAt && v.expiresAt < v.manufacturedAt) {
    ctx.addIssue({
      code: 'custom',
      path: ['expiresAt'],
      message: 'Yaroqlilik muddati ishlab chiqarilgan sanadan oldin bo‘lishi mumkin emas',
    });
  }
};

export const reagentTransactionTypeEnum = z.enum(['in', 'out', 'adjustment', 'disposal']);
export const reagentDocTypeEnum = z.enum(['passport', 'analysis']);

export const createReagentSchema = z.object({
  name: z.string().trim().min(1, 'Reaktiv nomi kiritilishi shart').max(255),
  casNumber: z.string().trim().max(50).nullable().optional(),
  unit: z.string().trim().min(1, 'O‘lchov birligi kiritilishi shart').max(30),
  quantity: z.coerce.number().min(0, 'Miqdor manfiy bo‘lishi mumkin emas').default(0),
  lowStockThreshold: z.coerce.number().min(0, 'Minimal chegara manfiy bo‘lishi mumkin emas').default(0),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Yaroqlilik muddati YYYY-MM-DD formatida bo‘lishi shart').nullable().optional(),
  supplier: z.string().trim().max(255).nullable().optional(),
  storageConditions: z.string().trim().max(255).nullable().optional(),
  isHazardous: z.boolean().default(false),
  /** D-174: katalog elementi (berilmasa nom bo'yicha topiladi yoki yaratiladi) */
  reagentItemId: z.string().uuid().nullable().optional(),
  ...lotFields,
  /** P18 (D-181): AI taklifidan to'ldirilgan bo'lsa */
  ai: aiReviewRefSchema.optional(),
}).superRefine(expiryAfterManufacture);

export const updateReagentSchema = z.object({
  name: z.string().trim().min(1, 'Reaktiv nomi kiritilishi shart').max(255).optional(),
  casNumber: z.string().trim().max(50).nullable().optional(),
  unit: z.string().trim().min(1, 'O‘lchov birligi kiritilishi shart').max(30).optional(),
  lowStockThreshold: z.coerce.number().min(0, 'Minimal chegara manfiy bo‘lishi mumkin emas').optional(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Yaroqlilik muddati YYYY-MM-DD formatida bo‘lishi shart').nullable().optional(),
  supplier: z.string().trim().max(255).nullable().optional(),
  storageConditions: z.string().trim().max(255).nullable().optional(),
  isHazardous: z.boolean().optional(),
  ...lotFields,
}).superRefine(expiryAfterManufacture);

export const createTransactionSchema = z.object({
  type: reagentTransactionTypeEnum,
  quantity: z.coerce.number().positive('Miqdor musbat bo‘lishi shart'),
  note: z.string().trim().max(1000).nullable().optional(),
  protocolId: z.string().uuid('Yaroqsiz protokol identifikatori').nullable().optional(),
  analysisPurpose: z.string().trim().max(500).nullable().optional(),
  recordedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana formati YYYY-MM-DD bo‘lishi shart').optional(),
});

export const listReagentsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  isLowStock: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  isExpired: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  isHazardous: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  /** D-169 */
  approvalStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
  /** D-170: muddati bugundan N kun ichida tugaydiganlar (muddati o'tganlar kirmaydi). */
  expiringWithinDays: z.coerce.number().int().min(1).max(365).optional(),
});

export const listTransactionsQuerySchema = paginationQuerySchema.extend({
  type: reagentTransactionTypeEnum.optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  protocolId: z.string().uuid().optional(),
});

export const listExpensesQuerySchema = paginationQuerySchema.extend({
  reagentId: z.string().uuid().optional(),
  protocolId: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const uploadDocumentSchema = z.object({
  docType: reagentDocTypeEnum,
});

export const idParamSchema = z.object({
  id: z.string().uuid('Yaroqsiz reaktiv identifikatori'),
});

export const docIdParamSchema = z.object({
  id: z.string().uuid('Yaroqsiz reaktiv identifikatori'),
  docId: z.string().uuid('Yaroqsiz hujjat identifikatori'),
});

export type CreateReagentInput = z.infer<typeof createReagentSchema>;
export type UpdateReagentInput = z.infer<typeof updateReagentSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type ListReagentsQuery = z.infer<typeof listReagentsQuerySchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

/** D-169: rad etishda sabab majburiy (≥5 belgi), tasdiqlashda e'tiborsiz. */
export const reviewReagentSchema = z.object({
  reason: z.string().trim().min(5, 'Rad etish sababi kamida 5 ta belgidan iborat bo‘lishi shart').max(1000),
});

export type ReviewReagentInput = { reason?: string | null };

/** D-174: reaktiv katalogi qidiruvi (ND talablari formasi uchun) */
export const listReagentItemsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListReagentItemsQuery = z.infer<typeof listReagentItemsQuerySchema>;
