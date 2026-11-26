import { Router } from 'express';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { requireCompany, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { equipmentController as c } from './equipment.controller.js';
import {
  createEquipmentSchema,
  equipmentIdParamSchema,
  listEquipmentQuerySchema,
  updateEquipmentSchema,
} from './equipment.schemas.js';

/**
 * D-175 (TZ §3.3): laboratoriya apparatlari. O'qish — `equipment:view` (barcha kompaniya rollari),
 * yozish — `equipment:write` (lab_head, admin).
 */
export function createEquipmentRouter(deps: { auth: AuthMiddleware }): Router {
  const router = Router();
  const companyAuth = [...deps.auth.requireAuth, requireCompany];
  const view = requirePermission('equipment', 'view');
  const write = requirePermission('equipment', 'write');

  /**
   * @openapi
   * /equipment:
   *   get:
   *     tags: [Equipment]
   *     summary: Apparatlar ro'yxati (qidiruv, kategoriya, holat, kalibrlash muddati filtri)
   *     security: [{ bearerAuth: [] }]
   *     responses: { 200: { description: "Ro'yxat" } }
   *   post:
   *     tags: [Equipment]
   *     summary: Apparat qo'shish (lab_head, admin)
   *     security: [{ bearerAuth: [] }]
   *     responses: { 201: { description: Yaratildi }, 403: { description: Ruxsat yo'q } }
   * /equipment/categories:
   *   get:
   *     tags: [Equipment]
   *     summary: Kompaniyadagi apparat kategoriyalari (ND talablari formasi uchun)
   *     security: [{ bearerAuth: [] }]
   *     responses: { 200: { description: Kategoriyalar } }
   * /equipment/{id}:
   *   get: { tags: [Equipment], summary: Apparat, security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
   *   put: { tags: [Equipment], summary: Tahrirlash, security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
   *   delete: { tags: [Equipment], summary: O'chirish, security: [{ bearerAuth: [] }], responses: { 204: { description: O'chirildi } } }
   */
  router.get('/', ...companyAuth, view, validate({ query: listEquipmentQuerySchema }), c.list);
  router.get('/categories', ...companyAuth, view, c.categories);
  router.get('/:id', ...companyAuth, view, validate({ params: equipmentIdParamSchema }), c.get);
  router.post('/', ...companyAuth, write, validate({ body: createEquipmentSchema }), c.create);
  router.put(
    '/:id',
    ...companyAuth,
    write,
    validate({ params: equipmentIdParamSchema, body: updateEquipmentSchema }),
    c.update,
  );
  router.delete(
    '/:id',
    ...companyAuth,
    write,
    validate({ params: equipmentIdParamSchema }),
    c.remove,
  );
  return router;
}
