import { Router } from 'express';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { requireCompany, requireRole } from '../../middleware/authenticate.js';
import { dashboardController } from './dashboard.controller.js';

export interface DashboardRouterDeps {
  auth: AuthMiddleware;
}

export function createDashboardRouter(deps: DashboardRouterDeps): Router {
  const router = Router();

  /**
   * @openapi
   * /api/v1/dashboard:
   *   get:
   *     tags: [Dashboard]
   *     summary: Rol bo'yicha dashboard statistikasi (D-33; `view` — chemist/inspector/lab_head/director)
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: Muvaffaqiyatli }
   *       403: { description: super_admin uchun yopiq }
   */
  router.get(
    '/',
    ...deps.auth.requireAuth,
    requireCompany,
    requireRole('kontrolyor', 'chemist', 'lab_head', 'director', 'admin'),
    dashboardController.get,
  );

  return router;
}
