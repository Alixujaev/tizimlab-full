import type { Request, Response } from 'express';
import { PERMISSION_CATALOG, ROLE_PERMISSIONS } from '../../config/permissions.js';
import { UnauthorizedError } from '../../utils/errors.js';
import { CompanyRequiredError } from '../auth/auth.errors.js';
import { sendCreated, sendOk, sendPaginated } from '../../utils/http.js';
import type { RequestMeta } from '../auth/auth.types.js';
import type {
  CreateUserInput,
  ListUsersQuery,
  ResetUserPasswordInput,
  SetUserPermissionsInput,
  UpdateUserInput,
} from './admin.schemas.js';
import * as adminService from './admin.service.js';

const requestMeta = (req: Request): RequestMeta => ({
  ip: req.ip ?? null,
  userAgent: req.get('user-agent') ?? null,
});

function getCompanyId(req: Request): string {
  if (!req.auth) throw new UnauthorizedError();
  if (!req.auth.companyId) throw new CompanyRequiredError();
  return req.auth.companyId;
}

export const adminController = {
  async listUsers(req: Request, res: Response) {
    const companyId = getCompanyId(req);
    const query = req.validated.query as ListUsersQuery;
    const result = await adminService.listUsers(companyId, query);
    sendPaginated(res, result.items, result.meta);
  },

  async getUserStats(req: Request, res: Response) {
    const companyId = getCompanyId(req);
    const stats = await adminService.getUserStats(companyId);
    sendOk(res, stats);
  },

  async getUserById(req: Request, res: Response) {
    const companyId = getCompanyId(req);
    const id = req.params.id as string;
    const user = await adminService.getUserById(companyId, id);
    sendOk(res, user);
  },

  async createUser(req: Request, res: Response) {
    const companyId = getCompanyId(req);
    const body = req.validated.body as CreateUserInput;
    const user = await adminService.createUser(
      companyId,
      { userId: req.auth!.userId, role: req.auth!.role },
      body,
      requestMeta(req),
    );
    sendCreated(res, user);
  },

  async updateUser(req: Request, res: Response) {
    const companyId = getCompanyId(req);
    const id = req.params.id as string;
    const body = req.validated.body as UpdateUserInput;
    const updated = await adminService.updateUser(
      companyId,
      { userId: req.auth!.userId, role: req.auth!.role },
      id,
      body,
      requestMeta(req),
    );
    sendOk(res, updated);
  },

  async resetUserPassword(req: Request, res: Response) {
    const companyId = getCompanyId(req);
    const id = req.params.id as string;
    const body = req.validated.body as ResetUserPasswordInput;
    await adminService.resetUserPassword(
      companyId,
      { userId: req.auth!.userId, role: req.auth!.role },
      id,
      body,
      requestMeta(req),
    );
    sendOk(res, { success: true });
  },

  async getPermissionsCatalog(_req: Request, res: Response) {
    sendOk(res, {
      catalog: PERMISSION_CATALOG,
      permissions: PERMISSION_CATALOG,
      roleDefaults: ROLE_PERMISSIONS,
    });
  },

  async getUserPermissions(req: Request, res: Response) {
    const companyId = getCompanyId(req);
    const id = req.params.id as string;
    const result = await adminService.getUserPermissions(companyId, id);
    sendOk(res, result);
  },

  async setUserPermissions(req: Request, res: Response) {
    const companyId = getCompanyId(req);
    const id = req.params.id as string;
    const body = req.validated.body as SetUserPermissionsInput;
    const result = await adminService.setUserPermissions(
      companyId,
      req.auth!.userId,
      id,
      body,
      requestMeta(req),
    );
    sendOk(res, result);
  },

  async getUserLogs(req: Request, res: Response) {
    const companyId = getCompanyId(req);
    const id = req.params.id as string;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const result = await adminService.getUserLogs(companyId, id, { page, limit });
    sendPaginated(res, result.items, result.meta);
  },
};
