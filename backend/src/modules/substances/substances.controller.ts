import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors.js';
import { sendCreated, sendOk, sendPaginated } from '../../utils/http.js';
import type { RequestMeta } from '../auth/auth.types.js';
import type {
  CreateSubstanceInput,
  ListSubstancesQuery,
  UpdateSubstanceInput,
} from './substances.schemas.js';
import * as substancesService from './substances.service.js';

const requestMeta = (req: Request): RequestMeta => ({
  ip: req.ip ?? null,
  userAgent: req.get('user-agent') ?? null,
});

export const substancesController = {
  async list(req: Request, res: Response) {
    if (!req.auth || !req.auth.companyId) throw new UnauthorizedError();
    const query = req.validated.query as ListSubstancesQuery;
    const result = await substancesService.listSubstances(req.auth.companyId, query);
    sendPaginated(res, result.items, result.meta);
  },

  async getById(req: Request, res: Response) {
    if (!req.auth || !req.auth.companyId) throw new UnauthorizedError();
    const id = req.params.id as string;
    const substance = await substancesService.getSubstanceById(req.auth.companyId, id);
    sendOk(res, substance);
  },

  async create(req: Request, res: Response) {
    if (!req.auth || !req.auth.companyId) throw new UnauthorizedError();
    const body = req.validated.body as CreateSubstanceInput;
    const created = await substancesService.createSubstance(
      req.auth.companyId,
      req.auth.userId,
      body,
      requestMeta(req),
    );
    sendCreated(res, created);
  },

  async update(req: Request, res: Response) {
    if (!req.auth || !req.auth.companyId) throw new UnauthorizedError();
    const id = req.params.id as string;
    const body = req.validated.body as UpdateSubstanceInput;
    const updated = await substancesService.updateSubstance(
      req.auth.companyId,
      req.auth.userId,
      id,
      body,
      requestMeta(req),
    );
    sendOk(res, updated);
  },

  async delete(req: Request, res: Response) {
    if (!req.auth || !req.auth.companyId) throw new UnauthorizedError();
    const id = req.params.id as string;
    await substancesService.deleteSubstance(
      req.auth.companyId,
      req.auth.userId,
      id,
      requestMeta(req),
    );
    res.status(204).send();
  },
};
