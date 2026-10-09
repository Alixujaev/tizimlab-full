import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors.js';
import { sendCreated, sendOk } from '../../utils/http.js';
import type { FileStorage } from '../files/files.storage.js';
import * as protocolsService from './protocols.service.js';
import type { RejectProtocolInput, RequestMeta, UserContext } from './protocols.types.js';

function getMeta(req: Request): RequestMeta {
  return {
    ip: req.ip ?? undefined,
    userAgent: req.get('user-agent') ?? undefined,
  };
}

function getActor(req: Request): UserContext & { companyId: string } {
  if (!req.auth || !req.auth.companyId) throw new UnauthorizedError();
  return {
    id: req.auth.userId,
    role: req.auth.role,
    companyId: req.auth.companyId,
  };
}

export function createProtocolsController(storage: FileStorage | null) {
  return {
    async getProtocol(req: Request, res: Response): Promise<void> {
      const actor = getActor(req);
      const protocol = await protocolsService.getProtocolById(
        actor.companyId,
        actor,
        req.params.id as string,
      );
      sendOk(res, protocol);
    },

    async getProtocolsBySample(req: Request, res: Response): Promise<void> {
      const actor = getActor(req);
      const sampleId = (req.params.sampleId || req.params.id) as string;
      const protocols = await protocolsService.getProtocolsBySampleId(
        actor.companyId,
        actor,
        sampleId,
      );
      sendOk(res, protocols);
    },

    async createInProcess(req: Request, res: Response): Promise<void> {
      const actor = getActor(req);
      const sampleId = (req.params.sampleId || req.params.id) as string;
      const protocol = await protocolsService.createInProcessProtocol(
        actor.companyId,
        actor,
        sampleId,
        getMeta(req),
      );
      sendCreated(res, protocol);
    },

    async uploadFile(req: Request, res: Response): Promise<void> {
      const actor = getActor(req);
      const file = req.file
        ? {
            originalname: req.file.originalname,
            buffer: req.file.buffer,
            size: req.file.size,
          }
        : undefined;

      const protocol = await protocolsService.uploadMainFile(
        storage,
        actor.companyId,
        actor,
        req.params.id as string,
        file,
        getMeta(req),
      );
      sendOk(res, protocol);
    },

    async deleteFile(req: Request, res: Response): Promise<void> {
      const actor = getActor(req);
      const protocol = await protocolsService.deleteMainFile(
        storage,
        actor.companyId,
        actor,
        req.params.id as string,
        getMeta(req),
      );
      sendOk(res, protocol);
    },

    async downloadFile(req: Request, res: Response): Promise<void> {
      const actor = getActor(req);
      const fileInfo = await protocolsService.getMainFileDownloadUrl(
        storage,
        actor.companyId,
        actor,
        req.params.id as string,
      );
      sendOk(res, fileInfo);
    },

    async submitProtocol(req: Request, res: Response): Promise<void> {
      const actor = getActor(req);
      const protocol = await protocolsService.submitProtocol(
        actor.companyId,
        actor,
        req.params.id as string,
        getMeta(req),
      );
      sendOk(res, protocol);
    },

    async approveProtocol(req: Request, res: Response): Promise<void> {
      const actor = getActor(req);
      const protocol = await protocolsService.approveProtocol(
        actor.companyId,
        actor,
        req.params.id as string,
        getMeta(req),
      );
      sendOk(res, protocol);
    },

    async rejectProtocol(req: Request, res: Response): Promise<void> {
      const actor = getActor(req);
      const body = (req.validated?.body ?? req.body) as RejectProtocolInput;
      const protocol = await protocolsService.rejectProtocol(
        actor.companyId,
        actor,
        req.params.id as string,
        body,
        getMeta(req),
      );
      sendOk(res, protocol);
    },

    async finalizeProtocol(req: Request, res: Response): Promise<void> {
      const actor = getActor(req);
      const protocol = await protocolsService.finalizeProtocol(
        actor.companyId,
        actor,
        req.params.id as string,
        getMeta(req),
      );
      sendOk(res, protocol);
    },
  };
}
