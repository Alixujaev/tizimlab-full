import { Router } from 'express';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { requireCompany, requirePermission, requireRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { consumptionsController as c } from './consumptions.controller.js';
import {
  consumptionIdParamSchema,
  correctConsumptionSchema,
  protocolConsumptionsParamSchema,
} from './consumptions.schemas.js';

/**
 * D-177: ND bo'yicha avto-sarf yozuvlari. Ko'rish — reaktivlarni ko'ra oladigan barcha rollar;
 * tasdiqlash/tuzatish — faqat chemist (o'ziga biriktirilgan tahlil) va lab_head.
 */
export function createConsumptionsRouter(deps: { auth: AuthMiddleware }): Router {
  const router = Router();
  const companyAuth = [...deps.auth.requireAuth, requireCompany];
  const reviewer = requireRole('chemist', 'lab_head');

  /**
   * @openapi
   * /consumptions/protocol/{protocolId}:
   *   get: { tags: [Consumptions], summary: "Protokol (tahlil) bo'yicha avto-sarf va lotlar", security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
   * /consumptions/{id}/confirm:
   *   post: { tags: [Consumptions], summary: "auto → confirmed (chemist/lab_head)", security: [{ bearerAuth: [] }], responses: { 200: { description: OK }, 409: { description: CONSUMPTION_ALREADY_REVIEWED } } }
   * /consumptions/{id}/correct:
   *   post: { tags: [Consumptions], summary: "Miqdorni tuzatish { quantity, reason≥5 } — farq omborga qaytadi yoki qo'shimcha ayiriladi", security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
   */
  router.get(
    '/protocol/:protocolId',
    ...companyAuth,
    requirePermission('reagents', 'view'),
    validate({ params: protocolConsumptionsParamSchema }),
    c.listForProtocol,
  );
  router.post(
    '/:id/confirm',
    ...companyAuth,
    reviewer,
    validate({ params: consumptionIdParamSchema }),
    c.confirm,
  );
  router.post(
    '/:id/correct',
    ...companyAuth,
    reviewer,
    validate({ params: consumptionIdParamSchema, body: correctConsumptionSchema }),
    c.correct,
  );
  return router;
}
