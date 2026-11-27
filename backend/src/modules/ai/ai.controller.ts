import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors.js';
import { sendOk } from '../../utils/http.js';
import type { ExtractNdBody } from './ai.schemas.js';
import * as service from './ai.service.js';

function actor(req: Request): service.AiActor {
  if (!req.auth?.companyId) throw new UnauthorizedError();
  return {
    userId: req.auth.userId,
    companyId: req.auth.companyId,
    ip: req.ip ?? undefined,
    userAgent: req.get('user-agent') ?? undefined,
  };
}

export function createAiController(rt: service.AiRuntime) {
  return {
    async status(req: Request, res: Response): Promise<void> {
      sendOk(res, await service.getAiStatus(rt, req.auth?.companyId ?? null));
    },
    async extractSample(req: Request, res: Response): Promise<void> {
      sendOk(res, await service.extractDocument(rt, actor(req), 'sample', req.file));
    },
    async extractReagent(req: Request, res: Response): Promise<void> {
      sendOk(res, await service.extractDocument(rt, actor(req), 'reagent', req.file));
    },
    async extractNd(req: Request, res: Response): Promise<void> {
      const body = req.validated.body as ExtractNdBody;
      sendOk(res, await service.extractNd(rt, actor(req), body.ndId));
    },
  };
}
