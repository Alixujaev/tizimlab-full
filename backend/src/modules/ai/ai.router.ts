import { Router, type Request, type RequestHandler, type Response } from 'express';
import { UnauthorizedError } from '../../utils/errors.js';
import { sendOk } from '../../utils/http.js';
import { extractPeaksBodySchema } from '../peaks/peaks.schemas.js';
import { extractPeaksWithAi } from '../peaks/peaks.service.js';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { requireCompany, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { uploadSingle } from '../files/files.upload.js';
import { createAiController } from './ai.controller.js';
import { extractNdBodySchema } from './ai.schemas.js';
import type { AiRuntime } from './ai.service.js';

/**
 * D-179/D-180 (TZ Addendum 1- va 3-bosqich): AI yordamchi. Natija faqat TAKLIF — inson tekshirib tasdiqlaydi.
 * Ruxsatlar (permissions.ts): `ai:extract_sample` (kontrolyor, lab_head), `ai:extract_reagent`
 * (kontrolyor, lab_head, chemist), `ai:extract_nd` (lab_head, admin).
 */
export function createAiRouter(deps: {
  auth: AuthMiddleware;
  runtime: AiRuntime;
  userLimiter: RequestHandler;
}): Router {
  const router = Router();
  const c = createAiController(deps.runtime);
  const companyAuth = [...deps.auth.requireAuth, requireCompany];
  // multer limiti AI limitidan biroz katta — aniq 413 xabarini servis beradi
  const upload = uploadSingle('file', deps.runtime.maxFileBytes + 1);

  /**
   * @openapi
   * /ai/status:
   *   get: { tags: [AI], summary: "AI holati: { enabled, configured, companyEnabled, dailyLimit, usedToday, maxFileMb }", security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
   * /ai/extract/sample:
   *   post:
   *     tags: [AI]
   *     summary: "Etiketka/CoA (JPEG/PNG/WEBP/PDF) → namuna maydonlari taklifi (saqlanmaydi)"
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: "{ extractionId, status: ok|failed|rejected, imageQuality, errorCode, fields }" }
   *       403: { description: "AI_DISABLED yoki ruxsat yo'q" }
   *       413: { description: PAYLOAD_TOO_LARGE }
   *       415: { description: UNSUPPORTED_MEDIA_TYPE }
   *       429: { description: "AI_DAILY_LIMIT / AI_RATE_LIMITED" }
   *       503: { description: AI_UNAVAILABLE }
   * /ai/extract/reagent:
   *   post: { tags: [AI], summary: "Reaktiv etiketka/CoA → maydonlar + katalogdagi eng yaqin nom taklifi", security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
   * /ai/extract/nd:
   *   post: { tags: [AI], summary: "ND fayli → qoralama talablar (source=ai), body { ndId }", security: [{ bearerAuth: [] }], responses: { 200: { description: "{ extractionId, status, createdIds, skipped }" }, 409: { description: "ND_NOT_DRAFT / ND_FILE_MISSING" } } }
   */
  router.get('/status', ...companyAuth, c.status);
  router.post(
    '/extract/sample',
    ...companyAuth,
    requirePermission('ai', 'extract_sample'),
    deps.userLimiter,
    upload,
    c.extractSample,
  );
  router.post(
    '/extract/reagent',
    ...companyAuth,
    requirePermission('ai', 'extract_reagent'),
    deps.userLimiter,
    upload,
    c.extractReagent,
  );
  router.post(
    '/extract/nd',
    ...companyAuth,
    requirePermission('ai', 'extract_nd'),
    deps.userLimiter,
    validate({ body: extractNdBodySchema }),
    c.extractNd,
  );
  // P19 (D-193): peak faylidan jadval → qoralama `peak_results` (source='ai'), inson tasdiqlaydi
  router.post(
    '/extract/peaks',
    ...companyAuth,
    requirePermission('ai', 'extract_peaks'),
    deps.userLimiter,
    validate({ body: extractPeaksBodySchema }),
    async (req: Request, res: Response) => {
      if (!req.auth?.companyId) throw new UnauthorizedError();
      const body = req.validated.body as { protocolFileId: string };
      sendOk(
        res,
        await extractPeaksWithAi(
          deps.runtime,
          {
            userId: req.auth.userId,
            companyId: req.auth.companyId,
            role: req.auth.role,
            ip: req.ip ?? undefined,
            userAgent: req.get('user-agent') ?? undefined,
          },
          body.protocolFileId,
        ),
      );
    },
  );
  return router;
}
