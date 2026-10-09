import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors.js';
import { sendOk, sendPaginated } from '../../utils/http.js';
import type { ListNotificationsQuery } from './notifications.schemas.js';
import * as notificationsService from './notifications.service.js';

function owner(req: Request): { companyId: string; userId: string } {
  if (!req.auth || !req.auth.companyId) throw new UnauthorizedError();
  return { companyId: req.auth.companyId, userId: req.auth.userId };
}

export const notificationsController = {
  async list(req: Request, res: Response) {
    const { companyId, userId } = owner(req);
    const q = req.validated.query as ListNotificationsQuery;
    const result = await notificationsService.listNotifications(companyId, userId, q);
    sendPaginated(res, result.items, result.meta);
  },

  async unreadCount(req: Request, res: Response) {
    const { companyId, userId } = owner(req);
    sendOk(res, { count: await notificationsService.getUnreadCount(companyId, userId) });
  },

  async markRead(req: Request, res: Response) {
    const { companyId, userId } = owner(req);
    const { id } = req.validated.params as { id: string };
    sendOk(res, await notificationsService.markRead(companyId, userId, id));
  },

  async markAllRead(req: Request, res: Response) {
    const { companyId, userId } = owner(req);
    sendOk(res, await notificationsService.markAllRead(companyId, userId));
  },
};
