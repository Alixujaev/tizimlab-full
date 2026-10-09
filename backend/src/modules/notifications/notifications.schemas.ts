import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination.js';

export const listNotificationsQuerySchema = paginationQuerySchema.extend({
  /** `true` — faqat o'qilmaganlar. */
  unread: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

export const notificationIdParamSchema = z.object({
  id: z.string().uuid('Xabarnoma identifikatori noto‘g‘ri formatda'),
});
