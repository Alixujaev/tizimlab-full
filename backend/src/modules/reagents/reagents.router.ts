import { Router } from 'express';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { requireCompany, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import type { FileStorage } from '../files/files.storage.js';
import { uploadSingle } from '../files/files.upload.js';
import { createReagentsController } from './reagents.controller.js';
import {
  createReagentSchema,
  createTransactionSchema,
  docIdParamSchema,
  idParamSchema,
  listExpensesQuerySchema,
  listReagentsQuerySchema,
  listTransactionsQuerySchema,
  updateReagentSchema,
} from './reagents.schemas.js';
import { REAGENT_DOC_MAX_BYTES } from './reagents.service.js';

export interface ReagentsRouterDeps {
  auth: AuthMiddleware;
  storage?: FileStorage | null;
}

export function createReagentsRouter(deps: ReagentsRouterDeps): Router {
  const router = Router();
  const companyAuth = [...deps.auth.requireAuth, requireCompany];
  const controller = createReagentsController(deps.storage ?? null);

  // Xarajatlar (umumiy ro'yxat va kalendar)
  router.get(
    '/expenses',
    ...companyAuth,
    requirePermission('reagents', 'view'),
    validate({ query: listExpensesQuerySchema }),
    controller.listExpenses,
  );

  router.get(
    '/expenses/calendar',
    ...companyAuth,
    requirePermission('reagents', 'view'),
    controller.getExpenseCalendar,
  );

  // Reaktivlar CRUD
  router.get(
    '/',
    ...companyAuth,
    requirePermission('reagents', 'view'),
    validate({ query: listReagentsQuerySchema }),
    controller.list,
  );

  router.get(
    '/:id',
    ...companyAuth,
    requirePermission('reagents', 'view'),
    validate({ params: idParamSchema }),
    controller.getById,
  );

  router.post(
    '/',
    ...companyAuth,
    requirePermission('reagents', 'write'),
    validate({ body: createReagentSchema }),
    controller.create,
  );

  router.put(
    '/:id',
    ...companyAuth,
    requirePermission('reagents', 'write'),
    validate({ params: idParamSchema, body: updateReagentSchema }),
    controller.update,
  );

  router.delete(
    '/:id',
    ...companyAuth,
    requirePermission('reagents', 'write'),
    validate({ params: idParamSchema }),
    controller.delete,
  );

  // Tranzaksiyalar
  router.post(
    '/:id/transactions',
    ...companyAuth,
    requirePermission('reagents', 'write'),
    validate({ params: idParamSchema, body: createTransactionSchema }),
    controller.createTransaction,
  );

  router.get(
    '/:id/transactions',
    ...companyAuth,
    requirePermission('reagents', 'view'),
    validate({ params: idParamSchema, query: listTransactionsQuerySchema }),
    controller.listTransactions,
  );

  // Hujjatlar
  router.post(
    '/:id/documents',
    ...companyAuth,
    requirePermission('reagents', 'write'),
    validate({ params: idParamSchema }),
    uploadSingle('file', REAGENT_DOC_MAX_BYTES),
    controller.uploadDocument,
  );

  router.get(
    '/:id/documents',
    ...companyAuth,
    requirePermission('reagents', 'view'),
    validate({ params: idParamSchema }),
    controller.listDocuments,
  );

  router.get(
    '/:id/documents/:docId/download',
    ...companyAuth,
    requirePermission('reagents', 'view'),
    validate({ params: docIdParamSchema }),
    controller.getDocumentDownloadUrl,
  );

  router.delete(
    '/:id/documents/:docId',
    ...companyAuth,
    requirePermission('reagents', 'write'),
    validate({ params: docIdParamSchema }),
    controller.deleteDocument,
  );

  return router;
}

export function createExpensesRouter(deps: ReagentsRouterDeps): Router {
  const router = Router();
  const companyAuth = [...deps.auth.requireAuth, requireCompany];
  const controller = createReagentsController(deps.storage ?? null);

  router.get(
    '/',
    ...companyAuth,
    requirePermission('reagents', 'view'),
    validate({ query: listExpensesQuerySchema }),
    controller.listExpenses,
  );

  return router;
}
