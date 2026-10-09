import { Router } from 'express';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { requireCompany } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { notificationsController } from './notifications.controller.js';
import {
  listNotificationsQuerySchema,
  notificationIdParamSchema,
} from './notifications.schemas.js';

export interface NotificationsRouterDeps {
  auth: AuthMiddleware;
}

/**
 * @openapi
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         type: { type: string }
 *         title: { type: string }
 *         message: { type: string }
 *         referenceId: { type: string, format: uuid, nullable: true }
 *         isRead: { type: boolean }
 *         createdAt: { type: string, format: date-time }
 */

/** Har foydalanuvchi faqat o'z xabarnomalarini ko'radi — rol cheklovi yo'q, filtr `user_id` bo'yicha. */
export function createNotificationsRouter(deps: NotificationsRouterDeps): Router {
  const router = Router();
  const base = [...deps.auth.requireAuth, requireCompany];

  /**
   * @openapi
   * /api/v1/notifications:
   *   get:
   *     tags: [Notifications]
   *     summary: O'z xabarnomalari (yangilari birinchi; `unread=true` — faqat o'qilmaganlar)
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: Muvaffaqiyatli }
   */
  router.get(
    '/',
    ...base,
    validate({ query: listNotificationsQuerySchema }),
    notificationsController.list,
  );

  /**
   * @openapi
   * /api/v1/notifications/unread-count:
   *   get:
   *     tags: [Notifications]
   *     summary: O'qilmagan xabarnomalar soni (bell ikonasi uchun)
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: Muvaffaqiyatli }
   */
  router.get('/unread-count', ...base, notificationsController.unreadCount);

  /**
   * @openapi
   * /api/v1/notifications/read-all:
   *   post:
   *     tags: [Notifications]
   *     summary: Barcha xabarnomalarni o'qilgan deb belgilash
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: Muvaffaqiyatli }
   */
  router.post('/read-all', ...base, notificationsController.markAllRead);

  /**
   * @openapi
   * /api/v1/notifications/{id}/read:
   *   post:
   *     tags: [Notifications]
   *     summary: Bitta xabarnomani o'qilgan deb belgilash
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: Muvaffaqiyatli }
   *       404: { description: Topilmadi (yoki boshqa foydalanuvchiniki) }
   */
  router.post(
    '/:id/read',
    ...base,
    validate({ params: notificationIdParamSchema }),
    notificationsController.markRead,
  );

  return router;
}
