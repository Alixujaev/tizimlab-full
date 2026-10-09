import { Router } from 'express';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { requireCompany, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import type { FileStorage } from '../files/files.storage.js';
import { uploadSingle } from '../files/files.upload.js';
import { PASSPORT_MAX_BYTES } from '../files/files.validation.js';
import { createProtocolsController } from './protocols.controller.js';
import {
  protocolIdParamSchema,
  rejectProtocolSchema,
  sampleIdParamSchema,
} from './protocols.schemas.js';

export interface ProtocolsRouterDeps {
  auth: AuthMiddleware;
  storage?: FileStorage | null;
}

export function createProtocolsRouter(deps: ProtocolsRouterDeps): Router {
  const router = Router();
  const companyAuth = [...deps.auth.requireAuth, requireCompany];
  const controller = createProtocolsController(deps.storage ?? null);

  // Namuna bo'yicha protokollar ro'yxati
  router.get(
    '/sample/:sampleId',
    ...companyAuth,
    validate({ params: sampleIdParamSchema }),
    controller.getProtocolsBySample,
  );

  // finished_product uchun oraliq (in_process) protokol yaratish
  router.post(
    '/sample/:sampleId/in-process',
    ...companyAuth,
    validate({ params: sampleIdParamSchema }),
    controller.createInProcess,
  );

  // Protokol tafsilotlari
  router.get(
    '/:id',
    ...companyAuth,
    validate({ params: protocolIdParamSchema }),
    controller.getProtocol,
  );

  // Asosiy faylni yuklash / almashtirish (draft/rejected da, protocols:upload ruxsati bilan)
  router.post(
    '/:id/file',
    ...companyAuth,
    requirePermission('protocols', 'upload'),
    validate({ params: protocolIdParamSchema }),
    uploadSingle('file', PASSPORT_MAX_BYTES),
    controller.uploadFile,
  );

  // Asosiy faylni o'chirish (draft/rejected da)
  router.delete(
    '/:id/file',
    ...companyAuth,
    requirePermission('protocols', 'upload'),
    validate({ params: protocolIdParamSchema }),
    controller.deleteFile,
  );

  // Asosiy faylni yuklab olish (imzolangan URL)
  router.get(
    '/:id/file',
    ...companyAuth,
    validate({ params: protocolIdParamSchema }),
    controller.downloadFile,
  );

  // Protokolni yuborish (faqat biriktirilgan kimyogar)
  router.post(
    '/:id/submit',
    ...companyAuth,
    validate({ params: protocolIdParamSchema }),
    controller.submitProtocol,
  );

  // Protokolni tasdiqlash (faqat lab_head)
  router.post(
    '/:id/approve',
    ...companyAuth,
    requirePermission('protocols', 'approve'),
    validate({ params: protocolIdParamSchema }),
    controller.approveProtocol,
  );

  // Protokolni rad etish (faqat lab_head, sabab kamida 5 belgi)
  router.post(
    '/:id/reject',
    ...companyAuth,
    requirePermission('protocols', 'approve'),
    validate({ params: protocolIdParamSchema }),
    validate({ body: rejectProtocolSchema }),
    controller.rejectProtocol,
  );

  // Protokolni yakunlash (faqat director)
  router.post(
    '/:id/finalize',
    ...companyAuth,
    requirePermission('protocols', 'finalize'),
    validate({ params: protocolIdParamSchema }),
    controller.finalizeProtocol,
  );

  return router;
}
