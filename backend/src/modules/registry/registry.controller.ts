import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors.js';
import { sendOk, sendPaginated } from '../../utils/http.js';
import type { FileStorage } from '../files/files.storage.js';
import type { RegistryListQuery } from './registry.schemas.js';
import * as registryService from './registry.service.js';

const companyOf = (req: Request): string => {
  if (!req.auth || !req.auth.companyId) throw new UnauthorizedError();
  return req.auth.companyId;
};

export function createRegistryController(storage: FileStorage | null) {
  return {
    async list(req: Request, res: Response): Promise<void> {
      const params = (req.validated?.query ?? req.query) as unknown as RegistryListQuery;
      const result = await registryService.listRegistry(companyOf(req), params);
      sendPaginated(res, result.data, result.meta);
    },

    async getById(req: Request, res: Response): Promise<void> {
      sendOk(res, await registryService.getRegistryItem(companyOf(req), req.params.id as string));
    },

    async download(req: Request, res: Response): Promise<void> {
      sendOk(
        res,
        await registryService.getRegistryDownload(storage, companyOf(req), req.params.id as string),
      );
    },

    async remove(req: Request, res: Response): Promise<void> {
      const companyId = companyOf(req);
      await registryService.deleteRegistryItem(
        companyId,
        req.auth!.userId,
        req.params.id as string,
        {
          ip: req.ip ?? undefined,
          userAgent: req.get('user-agent') ?? undefined,
        },
      );
      res.status(204).end();
    },
  };
}
