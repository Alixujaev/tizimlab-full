import { Router } from 'express';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { requireCompany, requirePermission, requireRole } from '../../middleware/authenticate.js';
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
  listReagentItemsQuerySchema,
  listReagentsQuerySchema,
  listTransactionsQuerySchema,
  reviewReagentSchema,
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

  // D-174: reaktiv katalogi (ND talablari uchun) — '/:id' dan oldin
  router.get(
    '/items',
    ...companyAuth,
    requirePermission('reagents', 'view'),
    validate({ query: listReagentItemsQuerySchema }),
    controller.listItems,
  );

  router.get(
    '/:id',
    ...companyAuth,
    requirePermission('reagents', 'view'),
    validate({ params: idParamSchema }),
    controller.getById,
  );

  // D-178: yaratish — kontrolyor ham (TZ §3.2); tahrirlash/o'chirish/tranzaksiya — reagents:write
  router.post(
    '/',
    ...companyAuth,
    requirePermission('reagents', 'create'),
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

  /**
   * @openapi
   * /reagents/{id}/approve:
   *   post:
   *     tags: [Reagents]
   *     summary: Reaktivni tasdiqlash (faqat chemist yoki lab_head; o'zi kiritganini emas) — D-169
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200: { description: Tasdiqlandi }
   *       403: { description: Rol yoki o'zi kiritgan reaktiv }
   *       409: { description: Qaror allaqachon qabul qilingan }
   * /reagents/{id}/reject:
   *   post:
   *     tags: [Reagents]
   *     summary: Reaktivni rad etish, sabab ≥5 belgi (faqat chemist yoki lab_head) — D-169
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [reason]
   *             properties:
   *               reason: { type: string, minLength: 5 }
   *     responses:
   *       200: { description: Rad etildi }
   */
  // "Faqat chemist yoki lab_head" (D-169): individual grant bilan ham boshqa rol tasdiqlay olmaydi.
  router.post(
    '/:id/approve',
    ...companyAuth,
    requireRole('chemist', 'lab_head'),
    requirePermission('reagents', 'approve'),
    validate({ params: idParamSchema }),
    controller.approve,
  );

  router.post(
    '/:id/reject',
    ...companyAuth,
    requireRole('chemist', 'lab_head'),
    requirePermission('reagents', 'approve'),
    validate({ params: idParamSchema, body: reviewReagentSchema }),
    controller.reject,
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
