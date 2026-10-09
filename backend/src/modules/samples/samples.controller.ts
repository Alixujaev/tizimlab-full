import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors.js';
import { sendCreated, sendOk, sendPaginated } from '../../utils/http.js';
import type { FileStorage } from '../files/files.storage.js';
import * as passportService from './samples.passport.service.js';
import type {
  AssignSampleInput,
  CreateSampleInput,
  ListSamplesQuery,
  ResumeSampleInput,
  ReviewPassportInput,
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

const passportContext = (req: Request): passportService.PassportContext => {
  if (!req.auth || !req.auth.companyId) throw new UnauthorizedError();
  return {
    companyId: req.auth.companyId,
    user: { id: req.auth.userId, role: req.auth.role, companyId: req.auth.companyId },
    meta: requestMeta(req),
  };
};

/** Namuna pasporti endpointlari (spec §3) — storage DI orqali (testlarda xotiradagi adapter). */
export function createPassportController(storage: FileStorage | null) {
  return {
    async upload(req: Request, res: Response): Promise<void> {
      const data = await passportService.uploadPassport(
        storage,
        passportContext(req),
        req.params.id as string,
        req.file,
      );
      sendCreated(res, data);
    },

    async review(req: Request, res: Response): Promise<void> {
      const input = (req.validated?.body ?? req.body) as ReviewPassportInput;
      const data = await passportService.reviewPassport(
        passportContext(req),
        req.params.id as string,
        input,
      );
      sendOk(res, data);
    },

    async download(req: Request, res: Response): Promise<void> {
      const data = await passportService.getPassportDownload(
        storage,
        passportContext(req),
        req.params.id as string,
      );
      sendOk(res, data);
    },

    async remove(req: Request, res: Response): Promise<void> {
      const data = await passportService.deletePassport(
        storage,
        passportContext(req),
        req.params.id as string,
      );
      sendOk(res, data);
    },
  };
}
