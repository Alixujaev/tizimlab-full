import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors.js';
import { sendOk } from '../../utils/http.js';
import type { CorrectConsumptionInput } from './consumptions.schemas.js';
import * as service from './consumptions.service.js';

function actor(req: Request) {
  if (!req.auth?.companyId) throw new UnauthorizedError();
  return { id: req.auth.userId, role: req.auth.role, companyId: req.auth.companyId };
}
const meta = (req: Request) => ({
  ip: req.ip ?? undefined,
  userAgent: req.get('user-agent') ?? undefined,
});

export const consumptionsController = {
  async listForProtocol(req: Request, res: Response): Promise<void> {
    sendOk(
      res,
      await service.listProtocolConsumptions(actor(req).companyId, req.params.protocolId as string),
    );
  },
  async confirm(req: Request, res: Response): Promise<void> {
    const a = actor(req);
    sendOk(
      res,
      await service.confirmConsumption(a.companyId, a, req.params.id as string, meta(req)),
    );
  },
  async correct(req: Request, res: Response): Promise<void> {
    const a = actor(req);
    sendOk(
      res,
      await service.correctConsumption(
        a.companyId,
        a,
        req.params.id as string,
        req.validated.body as CorrectConsumptionInput,
        meta(req),
      ),
    );
  },
};
