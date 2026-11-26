import { Router } from 'express';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { requireCompany, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import type { FileStorage } from '../files/files.storage.js';
import { uploadSingle } from '../files/files.upload.js';
import { createNdController } from './nd.controller.js';
import {
  createNdSchema,
  feasibilityBodySchema,
  feasibilityQuerySchema,
  listNdQuerySchema,
  ndIdParamSchema,
  ndRequirementParamSchema,
  ndRequirementSchema,
  updateNdSchema,
} from './nd.schemas.js';
import { ND_FILE_MAX_BYTES } from './nd.service.js';

/**
 * D-176 (TZ §3.2, §3.3): normativ hujjatlar va talablari, moslik tekshiruvi.
 * O'qish — `nd:view` (barcha kompaniya rollari), yozish/holat — `nd:write` (lab_head, admin).
 */
export function createNdRouter(deps: {
  auth: AuthMiddleware;
  storage?: FileStorage | null;
}): Router {
  const router = Router();
  const c = createNdController(deps.storage ?? null);
  const companyAuth = [...deps.auth.requireAuth, requireCompany];
  const view = requirePermission('nd', 'view');
  const write = requirePermission('nd', 'write');
  const idParam = validate({ params: ndIdParamSchema });

  /**
   * @openapi
   * /nd:
   *   get: { tags: [ND], summary: "ND ro'yxati (qidiruv, holat)", security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
   *   post: { tags: [ND], summary: "ND yaratish (lab_head, admin)", security: [{ bearerAuth: [] }], responses: { 201: { description: Yaratildi } } }
   * /nd/{id}:
   *   get: { tags: [ND], summary: "ND va talablari", security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
   *   put: { tags: [ND], summary: "Kod/nom/versiya", security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
   *   delete: { tags: [ND], summary: "Qoralama, bog'lanmagan ND ni o'chirish", security: [{ bearerAuth: [] }], responses: { 204: { description: OK } } }
   * /nd/{id}/requirements:
   *   post: { tags: [ND], summary: "Talab qo'shish (faqat draft)", security: [{ bearerAuth: [] }], responses: { 201: { description: OK }, 409: { description: ND_NOT_DRAFT }, 422: { description: UNIT_MISMATCH } } }
   * /nd/{id}/approve:
   *   post: { tags: [ND], summary: "draft → approved", security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
   * /nd/{id}/revise:
   *   post: { tags: [ND], summary: "approved/archived → draft", security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
   * /nd/{id}/archive:
   *   post: { tags: [ND], summary: "→ archived", security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
   * /nd/{id}/file:
   *   post: { tags: [ND], summary: "ND fayli (PDF/JPEG/PNG, R2)", security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
   *   get: { tags: [ND], summary: "Imzolangan yuklab olish havolasi", security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
   * /nd/{id}/feasibility:
   *   get:
   *     tags: [ND]
   *     summary: "Bajarish mumkinmi (?n= tahlillar soni)"
   *     security: [{ bearerAuth: [] }]
   *     responses: { 200: { description: "{ canRun, reasons: [{ type, detail, data }], equipment, reagents }" } }
   *   post: { tags: [ND], summary: "Xuddi shu, body { nAnalyses }", security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
   */
  router.get('/', ...companyAuth, view, validate({ query: listNdQuerySchema }), c.list);
  router.get('/:id', ...companyAuth, view, idParam, c.get);
  router.post('/', ...companyAuth, write, validate({ body: createNdSchema }), c.create);
  router.put(
    '/:id',
    ...companyAuth,
    write,
    validate({ params: ndIdParamSchema, body: updateNdSchema }),
    c.update,
  );
  router.delete('/:id', ...companyAuth, write, idParam, c.remove);

  router.post(
    '/:id/requirements',
    ...companyAuth,
    write,
    validate({ params: ndIdParamSchema, body: ndRequirementSchema }),
    c.addRequirement,
  );
  router.put(
    '/:id/requirements/:reqId',
    ...companyAuth,
    write,
    validate({ params: ndRequirementParamSchema, body: ndRequirementSchema }),
    c.updateRequirement,
  );
  router.delete(
    '/:id/requirements/:reqId',
    ...companyAuth,
    write,
    validate({ params: ndRequirementParamSchema }),
    c.deleteRequirement,
  );

  router.post('/:id/approve', ...companyAuth, write, idParam, c.approve);
  router.post('/:id/revise', ...companyAuth, write, idParam, c.revise);
  router.post('/:id/archive', ...companyAuth, write, idParam, c.archive);

  router.post(
    '/:id/file',
    ...companyAuth,
    write,
    idParam,
    uploadSingle('file', ND_FILE_MAX_BYTES),
    c.uploadFile,
  );
  router.get('/:id/file', ...companyAuth, view, idParam, c.fileUrl);

  router.get(
    '/:id/feasibility',
    ...companyAuth,
    view,
    validate({ params: ndIdParamSchema, query: feasibilityQuerySchema }),
    c.feasibilityGet,
  );
  router.post(
    '/:id/feasibility',
    ...companyAuth,
    view,
    validate({ params: ndIdParamSchema, body: feasibilityBodySchema }),
    c.feasibilityPost,
  );

  return router;
}
