import { Router } from 'express';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { companiesController } from './companies.controller.js';
import {
  createCompanySchema,
  listCompaniesQuerySchema,
  updateCompanySchema,
} from './companies.schemas.js';

export interface CompaniesRouterDeps {
  auth: AuthMiddleware;
}

export function createCompaniesRouter(deps: CompaniesRouterDeps): Router {
  const router = Router();
  const superAdminOnly = [...deps.auth.requireAuth, requireRole('super_admin')];

  router.get(
    '/',
    ...superAdminOnly,
    validate({ query: listCompaniesQuerySchema }),
    companiesController.list,
  );

  router.post(
    '/',
    ...superAdminOnly,
    validate({ body: createCompanySchema }),
    companiesController.create,
  );

  router.get('/:id', ...superAdminOnly, companiesController.getById);

  router.patch(
    '/:id',
    ...superAdminOnly,
    validate({ body: updateCompanySchema }),
    companiesController.update,
  );

  router.post('/:id/activate', ...superAdminOnly, companiesController.activate);

  router.post('/:id/deactivate', ...superAdminOnly, companiesController.deactivate);

  return router;
}
