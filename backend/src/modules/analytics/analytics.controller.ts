import type { Request, Response } from 'express';
import { sendOk, sendPaginated } from '../../utils/http.js';
import type { MemberSamplesQuery, PeriodQuery, TeamQuery } from './analytics.schemas.js';
import { resolveViewer } from './analytics.scope.js';
import * as analyticsService from './analytics.service.js';

const params = (req: Request) => req.validated.params as { id: string };

export const analyticsController = {
  async overview(req: Request, res: Response) {
    const viewer = await resolveViewer(req.auth);
    sendOk(res, await analyticsService.getOverview(viewer, req.validated.query as PeriodQuery));
  },

  async team(req: Request, res: Response) {
    const viewer = await resolveViewer(req.auth);
    const result = await analyticsService.getTeam(viewer, req.validated.query as TeamQuery);
    sendPaginated(res, result.items, result.meta);
  },

  async user(req: Request, res: Response) {
    const viewer = await resolveViewer(req.auth);
    const q = req.validated.query as PeriodQuery;
    sendOk(res, await analyticsService.getUserAnalytics(viewer, params(req).id, q));
  },

  async me(req: Request, res: Response) {
    const viewer = await resolveViewer(req.auth);
    const q = req.validated.query as PeriodQuery;
    sendOk(res, await analyticsService.getUserAnalytics(viewer, viewer.userId, q));
  },

  async userSamples(req: Request, res: Response) {
    const viewer = await resolveViewer(req.auth);
    const q = req.validated.query as MemberSamplesQuery;
    const result = await analyticsService.getMemberSamples(viewer, params(req).id, q);
    sendPaginated(res, result.items, result.meta);
  },
};
