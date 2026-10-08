import type { RequestHandler } from 'express';
import { touchSession } from '../modules/auth/auth.service.js';
import type { AuthConfig } from '../modules/auth/auth.types.js';
import { UnauthorizedError } from '../utils/errors.js';

/**
 * `authenticate` dan keyin: sessiya hali mavjud, idle/muddat o'tmagan, foydalanuvchi va kompaniya faol
 * (spec §15, D-90, D-34). Aks holda 401 SESSION_EXPIRED. `last_activity` daqiqada ko'pi bilan bir marta yangilanadi.
 */
export function createSessionTimeout(cfg: AuthConfig): RequestHandler {
  return async (req, _res, next) => {
    if (!req.auth) throw new UnauthorizedError();
    await touchSession(
      cfg,
      { sessionId: req.auth.sessionId, userId: req.auth.userId },
      { ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null },
    );
    next();
  };
}
