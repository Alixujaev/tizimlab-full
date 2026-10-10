import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors.js';
import type {
  AddParameterInput,
  CompleteCheckpointInput,
  CreateCheckpointInput,
  CreateStudyInput,
  ListCheckpointsQuery,
  ListStudiesQuery,
  RecordResultsInput,
  UpdateCheckpointInput,
} from './stability.schemas.js';
import * as stabilityService from './stability.service.js';

export function createStabilityController() {
  return {
    async listStudies(req: Request, res: Response): Promise<void> {
      const companyId = req.auth?.companyId;
      if (!companyId) throw new UnauthorizedError();
      const result = await stabilityService.listStudies(
        companyId,
        req.query as unknown as ListStudiesQuery,
      );
      res.json(result);
    },

    async getStudyById(req: Request, res: Response): Promise<void> {
      const companyId = req.auth?.companyId;
      if (!companyId) throw new UnauthorizedError();
      const result = await stabilityService.getStudyById(companyId, req.params.id as string);
      res.json(result);
    },

    async getStudyBySampleId(req: Request, res: Response): Promise<void> {
      const companyId = req.auth?.companyId;
      if (!companyId) throw new UnauthorizedError();
      const result = await stabilityService.getStudyBySampleId(
        companyId,
        req.params.sampleId as string,
      );
      if (!result) {
        res.status(404).json({ message: 'Namunaga tegishli faol stabilizatsiya tekshiruvi topilmadi' });
        return;
      }
      res.json(result);
    },

    async createStudy(req: Request, res: Response): Promise<void> {
      const auth = req.auth;
      if (!auth?.companyId || !auth?.userId) throw new UnauthorizedError();
      const result = await stabilityService.createStudy(
        auth.companyId,
        auth.userId,
        req.body as CreateStudyInput,
      );
      res.status(201).json(result);
    },

    async listCheckpoints(req: Request, res: Response): Promise<void> {
      const companyId = req.auth?.companyId;
      if (!companyId) throw new UnauthorizedError();
      const result = await stabilityService.listCheckpoints(
        companyId,
        req.query as unknown as ListCheckpointsQuery,
      );
      res.json(result);
    },

    async getCheckpointById(req: Request, res: Response): Promise<void> {
      const companyId = req.auth?.companyId;
      if (!companyId) throw new UnauthorizedError();
      const result = await stabilityService.getCheckpointById(companyId, req.params.id as string);
      res.json(result);
    },

    async createCheckpoint(req: Request, res: Response): Promise<void> {
      const auth = req.auth;
      if (!auth?.companyId || !auth?.userId) throw new UnauthorizedError();
      const result = await stabilityService.createCheckpoint(
        auth.companyId,
        req.params.id as string,
        auth.userId,
        req.body as CreateCheckpointInput,
      );
      res.status(201).json(result);
    },

    async updateCheckpoint(req: Request, res: Response): Promise<void> {
      const companyId = req.auth?.companyId;
      if (!companyId) throw new UnauthorizedError();
      const result = await stabilityService.updateCheckpoint(
        companyId,
        req.params.id as string,
        req.body as UpdateCheckpointInput,
      );
      res.json(result);
    },

    async deleteCheckpoint(req: Request, res: Response): Promise<void> {
      const companyId = req.auth?.companyId;
      if (!companyId) throw new UnauthorizedError();
      await stabilityService.deleteCheckpoint(companyId, req.params.id as string);
      res.status(204).end();
    },

    async addParameter(req: Request, res: Response): Promise<void> {
      const auth = req.auth;
      if (!auth?.companyId || !auth?.userId) throw new UnauthorizedError();
      const result = await stabilityService.addParameterToCheckpoint(
        auth.companyId,
        req.params.id as string,
        auth.userId,
        req.body as AddParameterInput,
      );
      res.status(201).json(result);
    },

    async removeParameter(req: Request, res: Response): Promise<void> {
      const companyId = req.auth?.companyId;
      if (!companyId) throw new UnauthorizedError();
      await stabilityService.removeParameterFromCheckpoint(
        companyId,
        req.params.id as string,
        req.params.parameter as string,
      );
      res.status(204).end();
    },

    async recordResults(req: Request, res: Response): Promise<void> {
      const auth = req.auth;
      if (!auth?.companyId || !auth?.userId) throw new UnauthorizedError();
      const result = await stabilityService.recordResults(
        auth.companyId,
        req.params.id as string,
        { userId: auth.userId, role: auth.role },
        req.body as RecordResultsInput,
      );
      res.json(result);
    },

    async completeCheckpoint(req: Request, res: Response): Promise<void> {
      const auth = req.auth;
      if (!auth?.companyId || !auth?.userId) throw new UnauthorizedError();
      const body = req.body as CompleteCheckpointInput;
      const result = await stabilityService.completeCheckpoint(
        auth.companyId,
        req.params.id as string,
        { userId: auth.userId, role: auth.role },
        body?.notes,
      );
      res.json(result);
    },
  };
}
