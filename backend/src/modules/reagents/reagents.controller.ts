import type { Request, Response } from 'express';
import { AppError, ForbiddenError, UnauthorizedError } from '../../utils/errors.js';
import { sendCreated, sendOk, sendPaginated } from '../../utils/http.js';
import type { FileStorage } from '../files/files.storage.js';
import type {
  CreateReagentInput,
  CreateTransactionInput,
  ListExpensesQuery,
  ListReagentsQuery,
  ListTransactionsQuery,
  UpdateReagentInput,
} from './reagents.schemas.js';
import * as reagentsService from './reagents.service.js';

function getActor(req: Request) {
  if (!req.auth || !req.auth.companyId) throw new UnauthorizedError();
  return {
    userId: req.auth.userId,
    companyId: req.auth.companyId,
    role: req.auth.role,
  };
}

function getMeta(req: Request) {
  return {
    ip: req.ip ?? undefined,
    userAgent: req.get('user-agent') ?? undefined,
  };
}

function ensureStorage(storage: FileStorage | null): FileStorage {
  if (!storage) {
    throw new AppError(503, 'STORAGE_UNAVAILABLE', 'Fayl xotirasi mavjud emas');
  }
  return storage;
}

export function createReagentsController(storage: FileStorage | null) {
  return {
    async list(req: Request, res: Response): Promise<void> {
      const actor = getActor(req);
      const q = req.validated.query as ListReagentsQuery;
      const result = await reagentsService.listReagents(actor.companyId, q);
      sendPaginated(res, result.items, result.meta);
    },

    async getById(req: Request, res: Response): Promise<void> {
      const actor = getActor(req);
      const reagent = await reagentsService.getReagentById(actor.companyId, req.params.id as string);
      sendOk(res, reagent);
    },

    async create(req: Request, res: Response): Promise<void> {
      const actor = getActor(req);
      const body = req.validated.body as CreateReagentInput;
      const reagent = await reagentsService.createReagent(actor.companyId, actor.userId, body, getMeta(req));
      sendCreated(res, reagent);
    },

    async update(req: Request, res: Response): Promise<void> {
      const actor = getActor(req);
      const body = req.validated.body as UpdateReagentInput;
      const reagent = await reagentsService.updateReagent(
        actor.companyId,
        actor.userId,
        req.params.id as string,
        body,
        getMeta(req),
      );
      sendOk(res, reagent);
    },

    async delete(req: Request, res: Response): Promise<void> {
      const actor = getActor(req);
      // Faqat admin o'chira oladi (R-ROLE-45, R-ROLE-47, D-30, D-51)
      if (actor.role !== 'admin') {
        throw new ForbiddenError('Reaktivni faqat admin o‘chira oladi');
      }
      await reagentsService.deleteReagent(actor.companyId, actor.userId, req.params.id as string, getMeta(req));
      res.status(204).send();
    },

    async createTransaction(req: Request, res: Response): Promise<void> {
      const actor = getActor(req);
      const body = req.validated.body as CreateTransactionInput;
      const tx = await reagentsService.createTransaction(
        actor.companyId,
        actor.userId,
        req.params.id as string,
        body,
        getMeta(req),
      );
      sendCreated(res, tx);
    },

    async listTransactions(req: Request, res: Response): Promise<void> {
      const actor = getActor(req);
      const q = req.validated.query as ListTransactionsQuery;
      const result = await reagentsService.listTransactions(actor.companyId, req.params.id as string, q);
      sendPaginated(res, result.items, result.meta);
    },

    async listExpenses(req: Request, res: Response): Promise<void> {
      const actor = getActor(req);
      const q = req.validated.query as ListExpensesQuery;
      const result = await reagentsService.listExpenses(actor.companyId, q);
      sendPaginated(res, result.items, result.meta);
    },

    async getExpenseCalendar(req: Request, res: Response): Promise<void> {
      const actor = getActor(req);
      const ym = (req.query.month as string) || new Date().toISOString().slice(0, 7);
      const result = await reagentsService.getExpenseCalendar(actor.companyId, ym);
      sendOk(res, result);
    },

    async uploadDocument(req: Request, res: Response): Promise<void> {
      const actor = getActor(req);
      const s = ensureStorage(storage);
      const file = req.file
        ? { originalname: req.file.originalname, buffer: req.file.buffer, size: req.file.size }
        : undefined;
      const docType = (req.body.docType || 'passport') as 'passport' | 'analysis';
      const doc = await reagentsService.uploadReagentDocument(
        s,
        actor.companyId,
        actor.userId,
        req.params.id as string,
        docType,
        file,
        getMeta(req),
      );
      sendCreated(res, doc);
    },

    async listDocuments(req: Request, res: Response): Promise<void> {
      const actor = getActor(req);
      const docs = await reagentsService.listReagentDocuments(actor.companyId, req.params.id as string);
      sendOk(res, docs);
    },

    async getDocumentDownloadUrl(req: Request, res: Response): Promise<void> {
      const actor = getActor(req);
      const s = ensureStorage(storage);
      const link = await reagentsService.getReagentDocumentDownloadUrl(
        s,
        actor.companyId,
        req.params.id as string,
        req.params.docId as string,
      );
      sendOk(res, link);
    },

    async deleteDocument(req: Request, res: Response): Promise<void> {
      const actor = getActor(req);
      const s = ensureStorage(storage);
      await reagentsService.deleteReagentDocument(
        s,
        actor.companyId,
        actor.userId,
        req.params.id as string,
        req.params.docId as string,
        getMeta(req),
      );
      res.status(204).send();
    },
  };
}
