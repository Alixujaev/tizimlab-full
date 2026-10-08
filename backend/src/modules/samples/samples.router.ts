import { Router } from 'express';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { requireCompany, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { samplesController } from './samples.controller.js';
import {
  assignSampleSchema,
  createSampleSchema,
  listSamplesQuerySchema,
  resumeSampleSchema,
  stopSampleSchema,
} from './samples.schemas.js';

export interface SamplesRouterDeps {
  auth: AuthMiddleware;
}

/**
 * @openapi
 * tags:
 *   name: Samples
 *   description: Namunalar va ularning hayot tsiklini boshqarish
 */
export function createSamplesRouter(deps: SamplesRouterDeps): Router {
  const router = Router();
  const companyAuth = [...deps.auth.requireAuth, requireCompany];

  /**
   * @openapi
   * /samples:
   *   get:
   *     tags: [Samples]
   *     summary: Namunalar ro'yxatini olish (rolga qarab filtrlangan)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [pending_assignment, in_progress, stopped, submitted, approved, rejected]
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *           enum: [raw_material, finished_product, reagent, standard_substance, other]
   *       - in: query
   *         name: substanceId
   *         schema:
   *           type: string
   *           format: uuid
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Namunalar ro'yxati
   */
  router.get(
    '/',
    ...companyAuth,
    requirePermission('samples', 'view'),
    validate({ query: listSamplesQuerySchema }),
    samplesController.listSamples,
  );

  /**
   * @openapi
   * /samples:
   *   post:
   *     tags: [Samples]
   *     summary: Yangi namuna yaratish (faqat kontrolyor)
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [type, substanceName]
   *             properties:
   *               type:
   *                 type: string
   *                 enum: [raw_material, finished_product, reagent, standard_substance, other]
   *               substanceId:
   *                 type: string
   *                 format: uuid
   *               substanceName:
   *                 type: string
   *               serialNumber:
   *                 type: string
   *               lotNumber:
   *                 type: string
   *               quantity:
   *                 type: string
   *     responses:
   *       201:
   *         description: Namuna yaratildi
   */
  router.post(
    '/',
    ...companyAuth,
    requirePermission('samples', 'create'),
    validate({ body: createSampleSchema }),
    samplesController.createSample,
  );

  /**
   * @openapi
   * /samples/{id}:
   *   get:
   *     tags: [Samples]
   *     summary: Namuna tafsilotlari va tracking tarixini olish
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Namuna ma'lumotlari
   *       404:
   *         description: Namuna topilmadi
   */
  router.get(
    '/:id',
    ...companyAuth,
    requirePermission('samples', 'view'),
    samplesController.getSampleById,
  );

  /**
   * @openapi
   * /samples/{id}/assign:
   *   post:
   *     tags: [Samples]
   *     summary: Namunani kimyogarga biriktirish yoki qayta biriktirish (faqat lab_head)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [chemistId]
   *             properties:
   *               chemistId:
   *                 type: string
   *                 format: uuid
   *     responses:
   *       200:
   *         description: Namuna kimyogarga biriktirildi
   */
  router.post(
    '/:id/assign',
    ...companyAuth,
    requirePermission('samples', 'assign'),
    validate({ body: assignSampleSchema }),
    samplesController.assignSample,
  );

  /**
   * @openapi
   * /samples/{id}/stop:
   *   post:
   *     tags: [Samples]
   *     summary: Tahlilni to'xtatish (faqat biriktirilgan kimyogar)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [reason]
   *             properties:
   *               reason:
   *                 type: string
   *                 minLength: 5
   *     responses:
   *       200:
   *         description: Tahlil to'xtatildi
   */
  router.post(
    '/:id/stop',
    ...companyAuth,
    requirePermission('samples', 'view'),
    validate({ body: stopSampleSchema }),
    samplesController.stopSample,
  );

  /**
   * @openapi
   * /samples/{id}/resume:
   *   post:
   *     tags: [Samples]
   *     summary: Tahlilni davom ettirish (faqat biriktirilgan kimyogar)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               reason:
   *                 type: string
   *     responses:
   *       200:
   *         description: Tahlil davom ettirildi
   */
  router.post(
    '/:id/resume',
    ...companyAuth,
    requirePermission('samples', 'view'),
    validate({ body: resumeSampleSchema }),
    samplesController.resumeSample,
  );

  return router;
}
