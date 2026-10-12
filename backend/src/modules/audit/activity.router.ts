import { Router } from 'express';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { requireCompany, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { auditController } from './audit.controller.js';
import { auditLogIdParamSchema, listAuditLogsQuerySchema } from './audit.schemas.js';

export interface ActivityRouterDeps {
  auth: AuthMiddleware;
}

export function createActivityRouter(deps: ActivityRouterDeps): Router {
  const router = Router();
  // /activity: faqat kompaniya rollari (lab_head, director, admin) — requireCompany + activity:view
  const companyAuth = [
    ...deps.auth.requireAuth,
    requireCompany,
    requirePermission('activity', 'view'),
  ];

  router.get(
    '/',
    ...companyAuth,
    validate({ query: listAuditLogsQuerySchema }),
    auditController.listActivity,
  );

  router.get(
    '/:id',
    ...companyAuth,
    validate({ params: auditLogIdParamSchema }),
    auditController.getActivityById,
  );

  return router;
}
