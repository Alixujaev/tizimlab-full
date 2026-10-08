import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors.js';
import { sendCreated, sendOk, sendPaginated } from '../../utils/http.js';
import type {
  AssignSampleInput,
  CreateSampleInput,
  ListSamplesQuery,
  ResumeSampleInput,
  StopSampleInput,
} from './samples.schemas.js';
import * as sampleService from './samples.service.js';

const requestMeta = (req: Request) => ({
  ip: req.ip ?? undefined,
  userAgent: req.get('user-agent') ?? undefined,
});

export const samplesController = {
  async listSamples(req: Request, res: Response): Promise<void> {
    if (!req.auth || !req.auth.companyId) throw new UnauthorizedError();
    const query = (req.validated?.query ?? req.query) as unknown as ListSamplesQuery;
    const result = await sampleService.listSamples(
      req.auth.companyId,
      { id: req.auth.userId, role: req.auth.role, companyId: req.auth.companyId },
      query,
    );
    sendPaginated(res, result.data, result.meta);
  },

  async getSampleById(req: Request, res: Response): Promise<void> {
    if (!req.auth || !req.auth.companyId) throw new UnauthorizedError();
    const sampleId = req.params.id as string;
    const data = await sampleService.getSampleById(
      req.auth.companyId,
      { id: req.auth.userId, role: req.auth.role, companyId: req.auth.companyId },
      sampleId,
    );
    sendOk(res, data);
  },

  async createSample(req: Request, res: Response): Promise<void> {
    if (!req.auth || !req.auth.companyId) throw new UnauthorizedError();
    const input = (req.validated?.body ?? req.body) as CreateSampleInput;
    const data = await sampleService.createSample(
      req.auth.companyId,
      req.auth.userId,
      req.auth.role,
      input,
      requestMeta(req),
    );
    sendCreated(res, data);
  },

  async assignSample(req: Request, res: Response): Promise<void> {
    if (!req.auth || !req.auth.companyId) throw new UnauthorizedError();
    const sampleId = req.params.id as string;
    const input = (req.validated?.body ?? req.body) as AssignSampleInput;
    const data = await sampleService.assignSample(
      req.auth.companyId,
      req.auth.userId,
      req.auth.role,
      sampleId,
      input,
      requestMeta(req),
    );
    sendOk(res, data);
  },

  async stopSample(req: Request, res: Response): Promise<void> {
    if (!req.auth || !req.auth.companyId) throw new UnauthorizedError();
    const sampleId = req.params.id as string;
    const input = (req.validated?.body ?? req.body) as StopSampleInput;
    const data = await sampleService.stopSample(
      req.auth.companyId,
      req.auth.userId,
      sampleId,
      input.reason,
      requestMeta(req),
    );
    sendOk(res, data);
  },

  async resumeSample(req: Request, res: Response): Promise<void> {
    if (!req.auth || !req.auth.companyId) throw new UnauthorizedError();
    const sampleId = req.params.id as string;
    const input = (req.validated?.body ?? req.body ?? {}) as ResumeSampleInput;
    const data = await sampleService.resumeSample(
      req.auth.companyId,
      req.auth.userId,
      sampleId,
      input.reason,
      requestMeta(req),
    );
    sendOk(res, data);
  },
};
