import { Router } from 'express';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { auditController } from './audit.controller.js';
import { auditLogIdParamSchema, listAuditLogsQuerySchema } from './audit.schemas.js';

export interface AuditRouterDeps {
  auth: AuthMiddleware;
}

export function createAuditRouter(deps: AuditRouterDeps): Router {
  const router = Router();
  // /audit: super_admin (global) yoki admin (kompaniya) rollari
  const accessAuth = [...deps.auth.requireAuth, requireRole('super_admin', 'admin')];

  router.get(
    '/',
    ...accessAuth,
    validate({ query: listAuditLogsQuerySchema }),
    auditController.listAudit,
  );

  router.get(
    '/:id',
    ...accessAuth,
    validate({ params: auditLogIdParamSchema }),
    auditController.getAuditById,
  );

  return router;
}
