import { Router } from 'express';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { requireCompany, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { adminController } from './admin.controller.js';
import {
  createUserSchema,
  listUsersQuerySchema,
  resetUserPasswordSchema,
  setUserPermissionsSchema,
  updateUserSchema,
} from './admin.schemas.js';

export interface AdminRouterDeps {
  auth: AuthMiddleware;
}

export function createAdminRouter(deps: AdminRouterDeps): Router {
  const router = Router();
  const companyAuth = [...deps.auth.requireAuth, requireCompany];

  router.get(
    '/users',
    ...companyAuth,
    requirePermission('users', 'view'),
    validate({ query: listUsersQuerySchema }),
    adminController.listUsers,
  );

  router.get(
    '/users/stats',
    ...companyAuth,
    requirePermission('users', 'view'),
    adminController.getUserStats,
  );

  router.get(
    '/permissions/catalog',
    ...companyAuth,
    requirePermission('users', 'view'),
    adminController.getPermissionsCatalog,
  );

  router.get(
    '/users/:id',
    ...companyAuth,
    requirePermission('users', 'view'),
    adminController.getUserById,
  );

  router.post(
    '/users',
    ...companyAuth,
    requirePermission('users', 'manage'),
    validate({ body: createUserSchema }),
    adminController.createUser,
  );

  router.patch(
    '/users/:id',
    ...companyAuth,
    requirePermission('users', 'manage'),
    validate({ body: updateUserSchema }),
    adminController.updateUser,
  );

  router.post(
    '/users/:id/reset-password',
    ...companyAuth,
    requirePermission('users', 'manage'),
    validate({ body: resetUserPasswordSchema }),
    adminController.resetUserPassword,
  );

  router.get(
    '/users/:id/permissions',
    ...companyAuth,
    requirePermission('users', 'view'),
    adminController.getUserPermissions,
  );

  router.put(
    '/users/:id/permissions',
    ...companyAuth,
    requirePermission('permissions', 'manage'),
    validate({ body: setUserPermissionsSchema }),
    adminController.setUserPermissions,
  );

  router.get(
    '/users/:id/logs',
    ...companyAuth,
    requirePermission('activity', 'view'),
    adminController.getUserLogs,
  );

  return router;
}
