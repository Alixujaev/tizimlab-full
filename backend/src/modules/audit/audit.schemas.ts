import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination.js';

export const listAuditLogsQuerySchema = paginationQuerySchema.extend({
  userId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  action: z.string().max(20).optional(),
  tableName: z.string().max(100).optional(),
  resource: z.string().max(100).optional(),
  recordId: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'YYYY-MM-DD formatida bo‘lishi kerak').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'YYYY-MM-DD formatida bo‘lishi kerak').optional(),
  search: z.string().max(100).optional(),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;

export interface ListAuditLogsOptions extends ListAuditLogsQuery {
  companyIdConstraint?: string | null;
}

export const auditLogIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type AuditLogIdParam = z.infer<typeof auditLogIdParamSchema>;
