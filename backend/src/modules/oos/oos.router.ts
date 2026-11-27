import { Router, type Request, type RequestHandler, type Response } from 'express';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { requireCompany, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { UnauthorizedError } from '../../utils/errors.js';
import { sendCreated, sendOk, sendPaginated } from '../../utils/http.js';
import { uploadSingle } from '../files/files.upload.js';
import * as chat from './oos.chat.js';
import {
  chatMessageSchema,
  createOosSchema,
  createSessionSchema,
  listOosQuerySchema,
  listSessionsQuerySchema,
  oosIdParamSchema,
  oosNoteSchema,
  oosStatusSchema,
  sessionIdParamSchema,
  type ChatMessageInput,
  type CreateOosInput,
  type ListOosQuery,
  type OosStatusInput,
} from './oos.schemas.js';
import * as service from './oos.service.js';

function actor(req: Request) {
  if (!req.auth?.companyId) throw new UnauthorizedError();
  return { companyId: req.auth.companyId, user: { id: req.auth.userId, role: req.auth.role } };
}
const meta = (req: Request) => ({ ip: req.ip ?? undefined, userAgent: req.get('user-agent') ?? undefined });

/**
 * D-194..D-196 (TZ §3.4): OOS holatlari va AI Copilot chat.
 * Ruxsatlar: `oos:view` (chemist, lab_head, director, admin), `oos:write` (chemist, lab_head, admin — ochish,
 * izoh, tergov, chat), `oos:close` (lab_head). Kontrolyor — yo'q. Director — faqat o'qish.
 * @openapi
 * /oos:
 *   get: { tags: [OOS], summary: "OOS ro'yxati (status, search, sampleId)", security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
 *   post: { tags: [OOS], summary: "OOS ochish (inson)", security: [{ bearerAuth: [] }], responses: { 201: { description: OK } } }
 * /oos/{id}:
 *   get: { tags: [OOS], summary: "OOS detali, jurnal, peak fayllari", security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
 * /oos/{id}/notes:
 *   post: { tags: [OOS], summary: "Jurnal izohi", security: [{ bearerAuth: [] }], responses: { 201: { description: OK } } }
 * /oos/{id}/status:
 *   post: { tags: [OOS], summary: "investigating | closed (faqat lab_head, rootCause + closureNote)", security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
 * /oos/chat/sessions:
 *   get: { tags: [OOS], summary: "Chat sessiyalari", security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
 *   post: { tags: [OOS], summary: "Sessiya (caseId yoki erkin)", security: [{ bearerAuth: [] }], responses: { 201: { description: OK } } }
 * /oos/chat/sessions/{id}:
 *   get: { tags: [OOS], summary: "Xabarlar va ilovalar", security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
 * /oos/chat/sessions/{id}/attachments:
 *   post: { tags: [OOS], summary: "Ilova (PDF/DOCX/JPEG/PNG/WEBP)", security: [{ bearerAuth: [] }], responses: { 201: { description: OK } } }
 * /oos/chat/sessions/{id}/messages:
 *   post:
 *     tags: [OOS]
 *     summary: "Savol → retrieval (company) + peak solishtirish + LLM; javob manbalar bilan"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ userMessage, assistantMessage }" }
 *       403: { description: AI_DISABLED }
 *       429: { description: "OOS_CHAT_DAILY_LIMIT / AI_RATE_LIMITED" }
 *       503: { description: AI_UNAVAILABLE }
 */
export function createOosRouter(deps: {
  auth: AuthMiddleware;
  chat: chat.ChatRuntime;
  chatLimiter: RequestHandler;
}): Router {
  const router = Router();
  const companyAuth = [...deps.auth.requireAuth, requireCompany];
  const view = requirePermission('oos', 'view');
  const write = requirePermission('oos', 'write');
  const idParam = validate({ params: oosIdParamSchema });
  const sessionParam = validate({ params: sessionIdParamSchema });

  // ---- chat (':id' marshrutlaridan oldin) ----
  router.get(
    '/chat/sessions',
    ...companyAuth,
    view,
    validate({ query: listSessionsQuerySchema }),
    async (req: Request, res: Response) => {
      const a = actor(req);
      const q = req.validated.query as { caseId?: string };
      sendOk(res, await chat.listSessions(a.companyId, a.user, q.caseId));
    },
  );
  router.post(
    '/chat/sessions',
    ...companyAuth,
    write,
    validate({ body: createSessionSchema }),
    async (req: Request, res: Response) => {
      const a = actor(req);
      sendCreated(res, await chat.createSession(a.companyId, a.user, req.validated.body as { caseId?: string | null; title?: string }));
    },
  );
  router.get('/chat/sessions/:id', ...companyAuth, view, sessionParam, async (req: Request, res: Response) => {
    const a = actor(req);
    sendOk(res, await chat.getSession(a.companyId, a.user, req.params.id as string));
  });
  router.post(
    '/chat/sessions/:id/attachments',
    ...companyAuth,
    write,
    sessionParam,
    uploadSingle('file', deps.chat.ai.maxFileBytes + 1),
    async (req: Request, res: Response) => {
      const a = actor(req);
      sendCreated(
        res,
        await chat.uploadAttachment(deps.chat, a.companyId, a.user, req.params.id as string, req.file, meta(req)),
      );
    },
  );
  router.post(
    '/chat/sessions/:id/messages',
    ...companyAuth,
    write,
    deps.chatLimiter,
    validate({ params: sessionIdParamSchema, body: chatMessageSchema }),
    async (req: Request, res: Response) => {
      const a = actor(req);
      sendOk(
        res,
        await chat.sendMessage(deps.chat, a.companyId, a.user, req.params.id as string, req.validated.body as ChatMessageInput, meta(req)),
      );
    },
  );

  // ---- OOS holatlari ----
  router.get('/', ...companyAuth, view, validate({ query: listOosQuerySchema }), async (req: Request, res: Response) => {
    const a = actor(req);
    const r = await service.listCases(a.companyId, a.user, req.validated.query as ListOosQuery);
    sendPaginated(res, r.data, r.meta);
  });
  router.post('/', ...companyAuth, write, validate({ body: createOosSchema }), async (req: Request, res: Response) => {
    const a = actor(req);
    sendCreated(res, await service.createCase(a.companyId, a.user, req.validated.body as CreateOosInput, meta(req)));
  });
  router.get('/:id', ...companyAuth, view, idParam, async (req: Request, res: Response) => {
    const a = actor(req);
    sendOk(res, await service.getCase(a.companyId, a.user, req.params.id as string));
  });
  router.post(
    '/:id/notes',
    ...companyAuth,
    write,
    validate({ params: oosIdParamSchema, body: oosNoteSchema }),
    async (req: Request, res: Response) => {
      const a = actor(req);
      sendCreated(res, await service.addNote(a.companyId, a.user, req.params.id as string, (req.validated.body as { text: string }).text));
    },
  );
  router.post(
    '/:id/status',
    ...companyAuth,
    write,
    validate({ params: oosIdParamSchema, body: oosStatusSchema }),
    async (req: Request, res: Response) => {
      const a = actor(req);
      sendOk(
        res,
        await service.changeStatus(a.companyId, a.user, req.params.id as string, req.validated.body as OosStatusInput, meta(req)),
      );
    },
  );
  return router;
}
