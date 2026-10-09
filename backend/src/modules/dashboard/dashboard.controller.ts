import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors.js';
import { sendOk } from '../../utils/http.js';
import * as dashboardService from './dashboard.service.js';

export const dashboardController = {
  async get(req: Request, res: Response) {
    if (!req.auth || !req.auth.companyId) throw new UnauthorizedError();
    const data = await dashboardService.getDashboard(req.auth.companyId, {
      id: req.auth.userId,
      role: req.auth.role,
    });
    sendOk(res, data);
  },
};
