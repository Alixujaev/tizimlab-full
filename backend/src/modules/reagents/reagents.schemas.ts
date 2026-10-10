import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination.js';

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
});

export const updateReagentSchema = z.object({
  name: z.string().trim().min(1, 'Reaktiv nomi kiritilishi shart').max(255).optional(),
  casNumber: z.string().trim().max(50).nullable().optional(),
  unit: z.string().trim().min(1, 'O‘lchov birligi kiritilishi shart').max(30).optional(),
  lowStockThreshold: z.coerce.number().min(0, 'Minimal chegara manfiy bo‘lishi mumkin emas').optional(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Yaroqlilik muddati YYYY-MM-DD formatida bo‘lishi shart').nullable().optional(),
  supplier: z.string().trim().max(255).nullable().optional(),
  storageConditions: z.string().trim().max(255).nullable().optional(),
  isHazardous: z.boolean().optional(),
});

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
