import { Router, type Request, type Response } from 'express';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { requireCompany, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { UnauthorizedError } from '../../utils/errors.js';
import { sendCreated, sendOk } from '../../utils/http.js';
import { peakFileParamSchema, peakResultParamSchema, peakResultSchema, type PeakResultInput } from './peaks.schemas.js';
import * as service from './peaks.service.js';

function actor(req: Request) {
  if (!req.auth?.companyId) throw new UnauthorizedError();
  return { companyId: req.auth.companyId, user: { id: req.auth.userId, role: req.auth.role } };
}

/**
 * D-193: peak natijalari (qo'lda / AI qoralama → inson tasdig'i) va deterministik solishtirish.
 * @openapi
 * /peaks/files/{fileId}/results:
 *   get: { tags: [Peaks], summary: "Peak fayli natijalari", security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
 *   post: { tags: [Peaks], summary: "Qo'lda qator (draft)", security: [{ bearerAuth: [] }], responses: { 201: { description: OK } } }
 * /peaks/files/{fileId}/confirm:
 *   post: { tags: [Peaks], summary: "Barcha qoralamalarni tasdiqlash (inson)", security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
 * /peaks/files/{fileId}/comparison:
 *   get: { tags: [Peaks], summary: "Tarixiy tasdiqlangan peaklar bilan solishtirish (RT, yuza, RSD, tailing, N, yangi/yo'qolgan)", security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
 * /peaks/results/{id}:
 *   put: { tags: [Peaks], summary: "Qoralamani tahrirlash", security: [{ bearerAuth: [] }], responses: { 200: { description: OK }, 409: { description: PEAK_CONFIRMED } } }
 *   delete: { tags: [Peaks], summary: "O'chirish", security: [{ bearerAuth: [] }], responses: { 204: { description: OK } } }
 */
export function createPeaksRouter(deps: { auth: AuthMiddleware }): Router {
  const router = Router();
  const companyAuth = [...deps.auth.requireAuth, requireCompany];
  const write = requirePermission('protocols', 'upload');
  const fileParam = validate({ params: peakFileParamSchema });

  router.get('/files/:fileId/results', ...companyAuth, fileParam, async (req: Request, res: Response) => {
    const a = actor(req);
    sendOk(res, await service.listPeakResults(a.companyId, a.user, req.params.fileId as string));
  });
  router.post(
    '/files/:fileId/results',
    ...companyAuth,
    write,
    validate({ params: peakFileParamSchema, body: peakResultSchema }),
    async (req: Request, res: Response) => {
      const a = actor(req);
      sendCreated(
        res,
        await service.addPeakResult(a.companyId, a.user, req.params.fileId as string, req.validated.body as PeakResultInput),
      );
    },
  );
  router.post('/files/:fileId/confirm', ...companyAuth, write, fileParam, async (req: Request, res: Response) => {
    const a = actor(req);
    sendOk(
      res,
      await service.confirmPeakResults(a.companyId, a.user, req.params.fileId as string, {
        ip: req.ip ?? undefined,
        userAgent: req.get('user-agent') ?? undefined,
      }),
    );
  });
  router.get('/files/:fileId/comparison', ...companyAuth, fileParam, async (req: Request, res: Response) => {
    const a = actor(req);
    sendOk(res, await service.compareForPeakFile(a.companyId, req.params.fileId as string, a.user));
  });
  router.put(
    '/results/:id',
    ...companyAuth,
    write,
    validate({ params: peakResultParamSchema, body: peakResultSchema }),
    async (req: Request, res: Response) => {
      const a = actor(req);
      sendOk(
        res,
        await service.updatePeakResult(a.companyId, a.user, req.params.id as string, req.validated.body as PeakResultInput),
      );
    },
  );
  router.delete(
    '/results/:id',
    ...companyAuth,
    write,
    validate({ params: peakResultParamSchema }),
    async (req: Request, res: Response) => {
      const a = actor(req);
      await service.deletePeakResult(a.companyId, a.user, req.params.id as string);
      res.status(204).end();
    },
  );
  return router;
}
