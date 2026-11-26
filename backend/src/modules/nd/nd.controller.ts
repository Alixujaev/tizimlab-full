import type { Request, Response } from 'express';
import { AppError, UnauthorizedError } from '../../utils/errors.js';
import { sendCreated, sendOk, sendPaginated } from '../../utils/http.js';
import type { FileStorage } from '../files/files.storage.js';
import { runFeasibility } from './nd.feasibility.js';
import type {
  CreateNdInput,
  ListNdQuery,
  NdRequirementInput,
  UpdateNdInput,
} from './nd.schemas.js';
import * as service from './nd.service.js';

function actor(req: Request) {
  if (!req.auth?.companyId) throw new UnauthorizedError();
  return { userId: req.auth.userId, companyId: req.auth.companyId };
}
const meta = (req: Request) => ({
  ip: req.ip ?? undefined,
  userAgent: req.get('user-agent') ?? undefined,
});
const id = (req: Request) => req.params.id as string;

export function createNdController(storage: FileStorage | null) {
  const store = () => {
    if (!storage) throw new AppError(503, 'STORAGE_UNAVAILABLE', 'Fayl xotirasi mavjud emas');
    return storage;
  };
  const statusAction =
    (action: 'approve' | 'revise' | 'archive') =>
    async (req: Request, res: Response): Promise<void> => {
      const a = actor(req);
      sendOk(res, await service.changeNdStatus(a.companyId, a.userId, id(req), action, meta(req)));
    };

  return {
    async list(req: Request, res: Response): Promise<void> {
      const r = await service.listNd(actor(req).companyId, req.validated.query as ListNdQuery);
      sendPaginated(res, r.items, r.meta);
    },
    async get(req: Request, res: Response): Promise<void> {
      sendOk(res, await service.getNd(actor(req).companyId, id(req)));
    },
    async create(req: Request, res: Response): Promise<void> {
      const a = actor(req);
      sendCreated(
        res,
        await service.createNd(
          a.companyId,
          a.userId,
          req.validated.body as CreateNdInput,
          meta(req),
        ),
      );
    },
    async update(req: Request, res: Response): Promise<void> {
      const a = actor(req);
      sendOk(
        res,
        await service.updateNd(
          a.companyId,
          a.userId,
          id(req),
          req.validated.body as UpdateNdInput,
          meta(req),
        ),
      );
    },
    async remove(req: Request, res: Response): Promise<void> {
      const a = actor(req);
      await service.deleteNd(a.companyId, a.userId, id(req), meta(req));
      res.status(204).end();
    },
    async addRequirement(req: Request, res: Response): Promise<void> {
      const a = actor(req);
      sendCreated(
        res,
        await service.addRequirement(
          a.companyId,
          a.userId,
          id(req),
          req.validated.body as NdRequirementInput,
          meta(req),
        ),
      );
    },
    async updateRequirement(req: Request, res: Response): Promise<void> {
      const a = actor(req);
      sendOk(
        res,
        await service.updateRequirement(
          a.companyId,
          a.userId,
          id(req),
          req.params.reqId as string,
          req.validated.body as NdRequirementInput,
          meta(req),
        ),
      );
    },
    async deleteRequirement(req: Request, res: Response): Promise<void> {
      const a = actor(req);
      sendOk(
        res,
        await service.deleteRequirement(
          a.companyId,
          a.userId,
          id(req),
          req.params.reqId as string,
          meta(req),
        ),
      );
    },
    approve: statusAction('approve'),
    revise: statusAction('revise'),
    archive: statusAction('archive'),
    async uploadFile(req: Request, res: Response): Promise<void> {
      const a = actor(req);
      const file = req.file
        ? { originalname: req.file.originalname, buffer: req.file.buffer, size: req.file.size }
        : undefined;
      sendOk(
        res,
        await service.uploadNdFile(store(), a.companyId, a.userId, id(req), file, meta(req)),
      );
    },
    async fileUrl(req: Request, res: Response): Promise<void> {
      sendOk(res, await service.getNdFileUrl(store(), actor(req).companyId, id(req)));
    },
    async feasibilityGet(req: Request, res: Response): Promise<void> {
      const { n } = req.validated.query as { n: number };
      sendOk(res, await runFeasibility(actor(req).companyId, id(req), n));
    },
    async feasibilityPost(req: Request, res: Response): Promise<void> {
      const { nAnalyses } = req.validated.body as { nAnalyses: number };
      sendOk(res, await runFeasibility(actor(req).companyId, id(req), nAnalyses));
    },
  };
}
