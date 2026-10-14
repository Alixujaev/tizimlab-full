import { Router } from 'express';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { requireCompany, requirePermission, requireRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { analyticsController } from './analytics.controller.js';
import {
  memberSamplesQuerySchema,
  periodQuerySchema,
  teamQuerySchema,
  userIdParamSchema,
} from './analytics.schemas.js';
import { ANALYTICS_ROLES } from './analytics.scope.js';

export interface AnalyticsRouterDeps {
  auth: AuthMiddleware;
}

/**
 * P13 xodimlar analitikasi (D-159..D-165). admin va super_admin — 403 (individual grant bilan ham:
 * `requireRole` grant'dan oldin turadi). Ierarxiya (kim kimni ko'radi) — service'da (D-160).
 */
export function createAnalyticsRouter(deps: AnalyticsRouterDeps): Router {
  const router = Router();
  const base = [...deps.auth.requireAuth, requireCompany, requireRole(...ANALYTICS_ROLES)];

  /**
   * @openapi
   * /api/v1/analytics/overview:
   *   get:
   *     tags: [Analytics]
   *     summary: Kompaniya KPI, voronka, trend, rad sabablari, kechikayotgan namunalar (analytics:company)
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: query, name: period, schema: { type: string, enum: [7d, 30d, 90d, custom] } }
   *       - { in: query, name: from, schema: { type: string, format: date } }
   *       - { in: query, name: to, schema: { type: string, format: date } }
   *     responses:
   *       200: { description: Muvaffaqiyatli }
   *       400: { description: Davr noto'g'ri }
   *       403: { description: Ruxsat yo'q }
   */
  router.get(
    '/overview',
    ...base,
    requirePermission('analytics', 'company'),
    validate({ query: periodQuerySchema }),
    analyticsController.overview,
  );

  /**
   * @openapi
   * /api/v1/analytics/team:
   *   get:
   *     tags: [Analytics]
   *     summary: Xodimlar jadvali (director — lab_head/chemist/kontrolyor; lab_head — chemist/kontrolyor)
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: query, name: period, schema: { type: string, enum: [7d, 30d, 90d, custom] } }
   *       - { in: query, name: role, schema: { type: string } }
   *       - { in: query, name: sort, schema: { type: string } }
   *       - { in: query, name: order, schema: { type: string, enum: [asc, desc] } }
   *       - { in: query, name: page, schema: { type: integer } }
   *       - { in: query, name: limit, schema: { type: integer } }
   *     responses:
   *       200: { description: Muvaffaqiyatli }
   *       403: { description: Ruxsat yo'q }
   */
  router.get(
    '/team',
    ...base,
    requirePermission('analytics', 'team'),
    validate({ query: teamQuerySchema }),
    analyticsController.team,
  );

  /**
   * @openapi
   * /api/v1/analytics/me:
   *   get:
   *     tags: [Analytics]
   *     summary: O'z ko'rsatkichlari (analytics:view)
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: Muvaffaqiyatli }
   *       403: { description: admin / super_admin }
   */
  router.get(
    '/me',
    ...base,
    requirePermission('analytics', 'view'),
    validate({ query: periodQuerySchema }),
    analyticsController.me,
  );

  /**
   * @openapi
   * /api/v1/analytics/users/{id}:
   *   get:
   *     tags: [Analytics]
   *     summary: Bitta xodim KPI, trend, natijalar, sabablar, faoliyat (ierarxiya bo'yicha)
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
   *     responses:
   *       200: { description: Muvaffaqiyatli }
   *       403: { description: Doiradan tashqari xodim }
   *       404: { description: Xodim topilmadi (boshqa kompaniya) }
   */
  router.get(
    '/users/:id',
    ...base,
    requirePermission('analytics', 'view'),
    validate({ params: userIdParamSchema, query: periodQuerySchema }),
    analyticsController.user,
  );

  /**
   * @openapi
   * /api/v1/analytics/users/{id}/samples:
   *   get:
   *     tags: [Analytics]
   *     summary: Xodim ishlagan namunalar (sahifalash, status/natija filtri)
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
   *       - { in: query, name: status, schema: { type: string } }
   *       - { in: query, name: result, schema: { type: string, enum: [approved, rejected, open] } }
   *     responses:
   *       200: { description: Muvaffaqiyatli }
   *       403: { description: Doiradan tashqari xodim }
   *       404: { description: Xodim topilmadi }
   */
  router.get(
    '/users/:id/samples',
    ...base,
    requirePermission('analytics', 'view'),
    validate({ params: userIdParamSchema, query: memberSamplesQuerySchema }),
    analyticsController.userSamples,
  );

  return router;
}
