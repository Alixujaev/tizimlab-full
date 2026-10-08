import { Router } from 'express';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { requireCompany, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { substancesController } from './substances.controller.js';
import {
  createSubstanceSchema,
  listSubstancesQuerySchema,
  updateSubstanceSchema,
} from './substances.schemas.js';

export interface SubstancesRouterDeps {
  auth: AuthMiddleware;
}

/**
 * @openapi
 * components:
 *   schemas:
 *     SubstanceParameter:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         substanceId: { type: string, format: uuid }
 *         parameterName: { type: string }
 *         unit: { type: string, nullable: true }
 *         specMin: { type: number, nullable: true }
 *         specMax: { type: number, nullable: true }
 *         method: { type: string, nullable: true }
 *         sortOrder: { type: integer }
 *         createdAt: { type: string, format: date-time }
 *     Substance:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         nameUz: { type: string }
 *         nameRu: { type: string, nullable: true }
 *         nameEn: { type: string, nullable: true }
 *         pharmacopoeia: { type: string, enum: [EP, BP, UzDSt, USP, OTHER] }
 *         casNumber: { type: string, nullable: true }
 *         description: { type: string, nullable: true }
 *         isActive: { type: boolean }
 *         createdBy: { type: string, format: uuid }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *         companyId: { type: string, format: uuid }
 *         parametersCount: { type: integer }
 *     SubstanceDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/Substance'
 *         - type: object
 *           properties:
 *             parameters:
 *               type: array
 *               items: { $ref: '#/components/schemas/SubstanceParameter' }
 */

export function createSubstancesRouter(deps: SubstancesRouterDeps): Router {
  const router = Router();
  const baseMiddleware = [...deps.auth.requireAuth, requireCompany];

  /**
   * @openapi
   * /api/v1/substances:
   *   get:
   *     tags: [Substances]
   *     summary: Moddalar ro'yxati (qidiruv va filtrlar bilan)
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: Muvaffaqiyatli }
   */
  router.get(
    '/',
    ...baseMiddleware,
    requirePermission('substances', 'view'),
    validate({ query: listSubstancesQuerySchema }),
    substancesController.list,
  );

  /**
   * @openapi
   * /api/v1/substances/{id}:
   *   get:
   *     tags: [Substances]
   *     summary: Modda tafsiloti (barcha parametrlari bilan)
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: Muvaffaqiyatli }
   *       404: { description: Topilmadi }
   */
  router.get(
    '/:id',
    ...baseMiddleware,
    requirePermission('substances', 'view'),
    substancesController.getById,
  );

  /**
   * @openapi
   * /api/v1/substances:
   *   post:
   *     tags: [Substances]
   *     summary: Yangi modda yaratish (parametrlari bilan bir tranzaksiyada)
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       201: { description: Yaratildi }
   *       400: { description: Validatsiya xatosi }
   *       403: { description: Ruxsat yo'q }
   */
  router.post(
    '/',
    ...baseMiddleware,
    requirePermission('substances', 'write'),
    validate({ body: createSubstanceSchema }),
    substancesController.create,
  );

  /**
   * @openapi
   * /api/v1/substances/{id}:
   *   put:
   *     tags: [Substances]
   *     summary: Modda va uning parametrlarini tahrirlash
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: Yangilandi }
   *       400: { description: Validatsiya xatosi }
   *       403: { description: Ruxsat yo'q }
   *       404: { description: Topilmadi }
   */
  router.put(
    '/:id',
    ...baseMiddleware,
    requirePermission('substances', 'write'),
    validate({ body: updateSubstanceSchema }),
    substancesController.update,
  );

  /**
   * @openapi
   * /api/v1/substances/{id}:
   *   delete:
   *     tags: [Substances]
   *     summary: Moddani o'chirish (faqat admin, namuna bog'lanmagan bo'lsa)
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       204: { description: O'chirildi }
   *       403: { description: Ruxsat yo'q (lab_head va boshqalar) }
   *       404: { description: Topilmadi }
   *       409: { description: Namuna bog'langan }
   */
  router.delete(
    '/:id',
    ...baseMiddleware,
    requirePermission('substances', 'delete'),
    substancesController.delete,
  );

  return router;
}
