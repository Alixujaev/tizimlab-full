import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors.js';
import { sendCreated, sendOk, sendPaginated } from '../../utils/http.js';
import type {
  CreateEquipmentInput,
  ListEquipmentQuery,
  UpdateEquipmentInput,
} from './equipment.schemas.js';
import * as service from './equipment.service.js';

function actor(req: Request) {
  if (!req.auth?.companyId) throw new UnauthorizedError();
  return { userId: req.auth.userId, companyId: req.auth.companyId };
}

const meta = (req: Request) => ({
  ip: req.ip ?? undefined,
  userAgent: req.get('user-agent') ?? undefined,
});

export const equipmentController = {
  async list(req: Request, res: Response): Promise<void> {
    const r = await service.listEquipment(
      actor(req).companyId,
      req.validated.query as ListEquipmentQuery,
    );
    sendPaginated(res, r.items, r.meta);
  },
  async categories(req: Request, res: Response): Promise<void> {
    sendOk(res, await service.listCategories(actor(req).companyId));
  },
  async get(req: Request, res: Response): Promise<void> {
    sendOk(res, await service.getEquipment(actor(req).companyId, req.params.id as string));
  },
  async create(req: Request, res: Response): Promise<void> {
    const a = actor(req);
    sendCreated(
      res,
      await service.createEquipment(
        a.companyId,
        a.userId,
        req.validated.body as CreateEquipmentInput,
        meta(req),
      ),
    );
  },
  async update(req: Request, res: Response): Promise<void> {
    const a = actor(req);
    sendOk(
      res,
      await service.updateEquipment(
        a.companyId,
        a.userId,
        req.params.id as string,
        req.validated.body as UpdateEquipmentInput,
        meta(req),
      ),
    );
  },
  async remove(req: Request, res: Response): Promise<void> {
    const a = actor(req);
    await service.deleteEquipment(a.companyId, a.userId, req.params.id as string, meta(req));
    res.status(204).end();
  },
};
