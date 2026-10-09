import { Router } from 'express';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { requireCompany, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import type { FileStorage } from '../files/files.storage.js';
import { uploadSingle } from '../files/files.upload.js';
import { PASSPORT_MAX_BYTES } from '../files/files.validation.js';
import { createPassportController, samplesController } from './samples.controller.js';
import {
  assignSampleSchema,
  createSampleSchema,
  listSamplesQuerySchema,
  resumeSampleSchema,
  reviewPassportSchema,
  stopSampleSchema,
} from './samples.schemas.js';

export interface SamplesRouterDeps {
  auth: AuthMiddleware;
  /** R2 adapteri; `null` — sozlanmagan (fayl endpointlari 503, D-121). */
  storage?: FileStorage | null;
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

  const passport = createPassportController(deps.storage ?? null);

  /**
   * @openapi
   * /samples/{id}/passport:
   *   post:
   *     tags: [Samples]
   *     summary: Namuna pasportini yuklash (reagent/standard — tasdiqlash yo'li; raw/finished — qo'shimcha hujjat)
   *     description: >
   *       lab_head/admin yuklasa reagent/standard_substance pasporti va namuna darhol `approved`;
   *       kontrolyor/chemist — `pending`. Fayl 20MB gacha, PDF/DOC/DOCX/JPEG/PNG (magic bytes tekshiriladi).
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
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required: [file]
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *     responses:
   *       201:
   *         description: Pasport yuklandi
   *       409:
   *         description: Pasport mavjud yoki namuna holati mos emas
   *       413:
   *         description: Fayl juda katta
   *       415:
   *         description: Fayl turi qo'llab-quvvatlanmaydi
   *       422:
   *         description: Bo'sh fayl yoki bu turdagi namunaga pasport biriktirilmaydi
   *       503:
   *         description: Fayl xotirasi sozlanmagan
   */
  router.post(
    '/:id/passport',
    ...companyAuth,
    requirePermission('samples', 'view'),
    uploadSingle('file', PASSPORT_MAX_BYTES),
    passport.upload,
  );

  /**
   * @openapi
   * /samples/{id}/passport/review:
   *   post:
   *     tags: [Samples]
   *     summary: Kutilayotgan pasportni tasdiqlash yoki rad etish (lab_head/admin, o'zinikini emas)
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
   *             required: [decision]
   *             properties:
   *               decision:
   *                 type: string
   *                 enum: [approve, reject]
   *               reason:
   *                 type: string
   *                 minLength: 5
   *     responses:
   *       200:
   *         description: Pasport ko'rib chiqildi
   */
  router.post(
    '/:id/passport/review',
    ...companyAuth,
    requirePermission('samples', 'view'),
    validate({ body: reviewPassportSchema }),
    passport.review,
  );

  /**
   * @openapi
   * /samples/{id}/passport/download:
   *   get:
   *     tags: [Samples]
   *     summary: Pasport faylining 5 daqiqalik imzolangan URL'i
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
   *         description: "{ url, expiresIn }"
   *       404:
   *         description: Namuna yoki pasport topilmadi
   */
  router.get(
    '/:id/passport/download',
    ...companyAuth,
    requirePermission('samples', 'view'),
    passport.download,
  );

  /**
   * @openapi
   * /samples/{id}/passport:
   *   delete:
   *     tags: [Samples]
   *     summary: Pasportni o'chirish (egasi — tasdiqlanmagan bo'lsa; lab_head/admin — har doim)
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
   *         description: Pasport o'chirildi (namuna statusi o'zgarmaydi)
   */
  router.delete(
    '/:id/passport',
    ...companyAuth,
    requirePermission('samples', 'view'),
    passport.remove,
  );

  return router;
}
