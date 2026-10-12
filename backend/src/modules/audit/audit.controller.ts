import type { Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../utils/errors.js';
import { sendOk, sendPaginated } from '../../utils/http.js';
import type { ListAuditLogsQuery } from './audit.schemas.js';
import { getAuditLogById, listAuditLogs } from './audit.service.js';

export const auditController = {
  async listAudit(req: Request, res: Response): Promise<void> {
    const user = req.auth;
    if (!user) throw new UnauthorizedError();

    const query = (req.validated?.query ?? req.query) as ListAuditLogsQuery;
    const isSuperAdmin = user.role === 'super_admin';

    // super_admin butun tizimni ko'radi (yoki companyId bo'yicha filtrlaydi);
    // Kompaniya admini faqat o'z kompaniyasini ko'radi (tenant cheklovi)
    const companyIdConstraint = isSuperAdmin ? null : (user.companyId ?? null);

    const result = await listAuditLogs({
      ...query,
      companyIdConstraint,
    });

    sendPaginated(res, result.items, result.meta);
  },

  async getAuditById(req: Request, res: Response): Promise<void> {
    const user = req.auth;
    if (!user) throw new UnauthorizedError();

    const isSuperAdmin = user.role === 'super_admin';
    const companyIdConstraint = isSuperAdmin ? null : (user.companyId ?? null);

    const log = await getAuditLogById(req.params.id as string, companyIdConstraint);
    sendOk(res, log);
  },

  async listActivity(req: Request, res: Response): Promise<void> {
    const user = req.auth;
    if (!user) throw new UnauthorizedError();

    // R-AUDIT-05: super_admin /activity ga kira olmaydi (faqat kompaniya rollari)
    if (user.role === 'super_admin') {
      throw new ForbiddenError('Super admin uchun faoliyat jurnali mavjud emas, /logs dan foydalaning');
    }

    if (!user.companyId) {
      throw new ForbiddenError('Kompaniya biriktirilmagan');
    }

    const query = (req.validated?.query ?? req.query) as ListAuditLogsQuery;

    // Faoliyat jurnali qat'iy o'z kompaniyasi bilan cheklanadi (R-AUDIT-04)
    const result = await listAuditLogs({
      ...query,
      companyIdConstraint: user.companyId,
    });

    sendPaginated(res, result.items, result.meta);
  },

  async getActivityById(req: Request, res: Response): Promise<void> {
    const user = req.auth;
    if (!user) throw new UnauthorizedError();

    if (user.role === 'super_admin') {
      throw new ForbiddenError('Super admin uchun faoliyat jurnali mavjud emas');
    }

    if (!user.companyId) {
      throw new ForbiddenError('Kompaniya biriktirilmagan');
    }

    const log = await getAuditLogById(req.params.id as string, user.companyId);
    sendOk(res, log);
  },
};
