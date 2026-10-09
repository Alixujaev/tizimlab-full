import { Router } from 'express';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { requireCompany, requirePermission, requireRole } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import type { FileStorage } from '../files/files.storage.js';
import { createRegistryController } from './registry.controller.js';
import { registryListQuerySchema } from './registry.schemas.js';

export interface RegistryRouterDeps {
  auth: AuthMiddleware;
  storage?: FileStorage | null;
}

/**
 * @openapi
 * tags:
 *   name: Registry
 *   description: Reyestr — tasdiqlangan namunalar arxivi
 */
export function createRegistryRouter(deps: RegistryRouterDeps): Router {
  const router = Router();
  const companyAuth = [
    ...deps.auth.requireAuth,
    requireCompany,
    requirePermission('registry', 'view'),
  ];
  const controller = createRegistryController(deps.storage ?? null);

  /**
   * @openapi
   * /registry:
   *   get:
   *     tags: [Registry]
   *     summary: Kompaniyaning tasdiqlangan namunalari (barcha kompaniya rollari)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - { in: query, name: page, schema: { type: integer, default: 1 } }
   *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *           enum: [raw_material, finished_product, reagent, standard_substance, other]
   *       - { in: query, name: substanceName, schema: { type: string } }
   *       - { in: query, name: serialNumber, schema: { type: string } }
   *       - { in: query, name: lotNumber, schema: { type: string } }
   *       - { in: query, name: approvedFrom, schema: { type: string, format: date } }
   *       - { in: query, name: approvedTo, schema: { type: string, format: date } }
   *     responses:
   *       200:
   *         description: Reyestr ro'yxati
   */
  router.get('/', ...companyAuth, validate({ query: registryListQuerySchema }), controller.list);

  /**
   * @openapi
   * /registry/{id}:
   *   get:
   *     tags: [Registry]
   *     summary: Reyestrdagi namuna tafsilotlari va tracking tarixi
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
   *     responses:
   *       200:
   *         description: Namuna tafsilotlari
   *       404:
   *         description: Topilmadi
   */
  router.get('/:id', ...companyAuth, controller.getById);

  /**
   * @openapi
   * /registry/{id}/download:
   *   get:
   *     tags: [Registry]
   *     summary: Pasport (pasport orqali tasdiqlangan) yoki final protokol (finished_product) faylining imzolangan URL'i
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
   *     responses:
   *       200:
   *         description: "{ url, expiresIn }"
   *       404:
   *         description: Fayl yo'q
   */
  router.get('/:id/download', ...companyAuth, controller.download);

  /**
   * @openapi
   * /registry/{id}:
   *   delete:
   *     tags: [Registry]
   *     summary: Namunani reyestrdan o'chirish (soft-delete; lab_head, admin)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
   *     responses:
   *       204:
   *         description: O'chirildi
   */
  router.delete('/:id', ...companyAuth, requireRole('lab_head', 'admin'), controller.remove);

  return router;
}
