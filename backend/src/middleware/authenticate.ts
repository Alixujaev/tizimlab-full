import type { RequestHandler } from 'express';
import { ROLE_PERMISSIONS, type RolePermissionCatalog } from '../config/permissions.js';
import { CompanyRequiredError } from '../modules/auth/auth.errors.js';
import { loadUserGrants } from '../modules/auth/auth.service.js';
import type { AuthConfig, AuthContext, Role } from '../modules/auth/auth.types.js';
import { verifyAccessToken } from '../modules/auth/tokens.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';
import { createSessionTimeout } from './sessionTimeout.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** `authenticate` dan o'tgan foydalanuvchi konteksti (token claim'laridan). */
    auth?: AuthContext;
  }
}

export interface AuthMiddleware {
  authenticate: RequestHandler;
  sessionTimeout: RequestHandler;
  /** Himoyalangan route'lar uchun zanjir: `authenticate` → `sessionTimeout`. */
  requireAuth: RequestHandler[];
}

/** Bearer access token → `req.auth` (DB'ga murojaat yo'q; sessiya holatini `sessionTimeout` tekshiradi). */
export function createAuthMiddleware(cfg: AuthConfig): AuthMiddleware {
  const authenticate: RequestHandler = (req, _res, next) => {
    const header = req.get('authorization');
    const match = header ? /^Bearer\s+(\S+)$/i.exec(header) : null;
    if (!match) throw new UnauthorizedError();
    const claims = verifyAccessToken(match[1]!, cfg.accessSecret);
    req.auth = {
      userId: claims.sub,
      role: claims.role,
      companyId: claims.company_id,
      sessionId: claims.sid,
    };
    next();
  };
  const sessionTimeout = createSessionTimeout(cfg);
  return { authenticate, sessionTimeout, requireAuth: [authenticate, sessionTimeout] };
}

/** Kompaniya kontekstisiz (super_admin) so'rovlarni bloklaydi (spec §2, R-ROLE-04). */
export const requireCompany: RequestHandler = (req, _res, next) => {
  if (!req.auth) throw new UnauthorizedError();
  if (!req.auth.companyId) throw new CompanyRequiredError();
  next();
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) throw new UnauthorizedError();
    if (!roles.includes(req.auth.role)) throw new ForbiddenError(undefined, { requiredRoles: roles });
    next();
  };
}

/**
 * D-32: effektiv ruxsat = rol katalogi ∪ individual grant'lar (`user_permissions`, faqat o'z kompaniyasi).
 * Grant'lar so'rov davomida bir marta yuklanadi va `req.auth.grants` da keshlanadi (R-USER-10).
 */
export function requirePermission(
  resource: string,
  action: string,
  catalog: RolePermissionCatalog = ROLE_PERMISSIONS,
): RequestHandler {
  const key = `${resource}:${action}` as const;
  return async (req, _res, next) => {
    const auth = req.auth;
    if (!auth) throw new UnauthorizedError();
    if ((catalog[auth.role] as readonly string[] | undefined)?.includes(key)) return next();
    auth.grants ??= loadUserGrants(auth.userId, auth.companyId);
    if (!(await auth.grants).has(key)) throw new ForbiddenError(undefined, { resource, action });
    next();
  };
}
