import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors.js';
import { sendCreated, sendOk, sendPaginated } from '../../utils/http.js';
import type { RequestMeta } from '../auth/auth.types.js';
import type {
  CreateCompanyInput,
  ListCompaniesQuery,
  UpdateCompanyInput,
} from './companies.schemas.js';
import * as companiesService from './companies.service.js';

const requestMeta = (req: Request): RequestMeta => ({
  ip: req.ip ?? null,
  userAgent: req.get('user-agent') ?? null,
});

export const companiesController = {
  async list(req: Request, res: Response) {
    const query = req.validated.query as ListCompaniesQuery;
    const result = await companiesService.listCompanies(query);
    sendPaginated(res, result.items, result.meta);
  },

  async getById(req: Request, res: Response) {
    const id = req.params.id as string;
    const company = await companiesService.getCompany(id);
    sendOk(res, company);
  },

  async create(req: Request, res: Response) {
    if (!req.auth) throw new UnauthorizedError();
    const body = req.validated.body as CreateCompanyInput;
    const result = await companiesService.createCompany(body, requestMeta(req), req.auth.userId);
    sendCreated(res, result);
  },

  async update(req: Request, res: Response) {
    if (!req.auth) throw new UnauthorizedError();
    const id = req.params.id as string;
    const body = req.validated.body as UpdateCompanyInput;
    const updated = await companiesService.updateCompany(id, body, requestMeta(req), req.auth.userId);
    sendOk(res, updated);
  },

  async activate(req: Request, res: Response) {
    if (!req.auth) throw new UnauthorizedError();
    const id = req.params.id as string;
    const result = await companiesService.activateCompany(id, requestMeta(req), req.auth.userId);
    sendOk(res, result);
  },

  async deactivate(req: Request, res: Response) {
    if (!req.auth) throw new UnauthorizedError();
    const id = req.params.id as string;
    const result = await companiesService.deactivateCompany(id, requestMeta(req), req.auth.userId);
    sendOk(res, result);
  },
};
