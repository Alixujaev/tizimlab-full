import { Router } from 'express';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { requireCompany, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import type { FileStorage } from '../files/files.storage.js';
import { uploadSingle } from '../files/files.upload.js';
import { PASSPORT_MAX_BYTES } from '../files/files.validation.js';
import { createProtocolsController } from './protocols.controller.js';
import {
  protocolFileIdParamSchema,
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

  // DOCX eksport (D-84, D-125)
  router.get(
    '/:id/export',
    ...companyAuth,
    validate({ params: protocolIdParamSchema }),
    controller.exportProtocolDocx,
  );

  // Protokol pasporti (D-123, R-PROTO-31)
  router.post(
    '/:id/passport',
    ...companyAuth,
    validate({ params: protocolIdParamSchema }),
    uploadSingle('file', PASSPORT_MAX_BYTES),
    controller.uploadPassport,
  );

  router.get(
    '/:id/passport',
    ...companyAuth,
    validate({ params: protocolIdParamSchema }),
    controller.getPassportDownload,
  );

  router.delete(
    '/:id/passport',
    ...companyAuth,
    validate({ params: protocolIdParamSchema }),
    controller.deletePassport,
  );

  // Qo'shimcha fayllar (D-49, D-76, D-124)
  router.post(
    '/:id/files',
    ...companyAuth,
    validate({ params: protocolIdParamSchema }),
    uploadSingle('file', PASSPORT_MAX_BYTES),
    controller.uploadProtocolFile,
  );

  router.get(
    '/:id/files',
    ...companyAuth,
    validate({ params: protocolIdParamSchema }),
    controller.listProtocolFiles,
  );

  router.get(
    '/:id/files/:fileId',
    ...companyAuth,
    validate({ params: protocolFileIdParamSchema }),
    controller.getProtocolFileDownload,
  );

  router.delete(
    '/:id/files/:fileId',
    ...companyAuth,
    validate({ params: protocolFileIdParamSchema }),
    controller.deleteProtocolFile,
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
