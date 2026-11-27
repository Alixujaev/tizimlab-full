import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { query } from '../../config/database.js';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { requireCompany, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { NotFoundError, UnauthorizedError } from '../../utils/errors.js';
import { sendOk } from '../../utils/http.js';
import { writeAudit } from '../audit/audit.service.js';
import type { EmbeddingProvider } from './rag.embedding.js';
import { enqueueAllApproved } from './rag.indexer.js';

/**
 * D-191: indekslash holati va qayta indekslash (lab_head, admin — `rag:manage`). Faqat o'z kompaniyasi.
 * @openapi
 * /rag/status:
 *   get: { tags: [RAG], summary: "Indekslash holati: navbat, bo'laklar, xatolar, qidiruv rejimi", security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
 * /rag/reindex:
 *   post: { tags: [RAG], summary: "Barcha tasdiqlangan manbalarni navbatga (backfill)", security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
 * /rag/jobs/{id}/retry:
 *   post: { tags: [RAG], summary: "Xato bo'lgan jobni qayta navbatga", security: [{ bearerAuth: [] }], responses: { 200: { description: OK } } }
 */
export function createRagRouter(deps: { auth: AuthMiddleware; embedding: EmbeddingProvider | null }): Router {
  const router = Router();
  const guard = [...deps.auth.requireAuth, requireCompany, requirePermission('rag', 'manage')];
  const company = (req: Request) => {
    if (!req.auth?.companyId) throw new UnauthorizedError();
    return req.auth.companyId;
  };

  router.get('/status', ...guard, async (req: Request, res: Response) => {
    const companyId = company(req);
    const jobs = await query<{ status: string; source_type: string; n: string }>(
      `SELECT status, source_type, count(*)::text AS n FROM rag_index_jobs WHERE company_id = $1 GROUP BY 1, 2`,
      [companyId],
    );
    const chunks = await query<{ source_type: string; n: string; vec: string }>(
      `SELECT source_type, count(*)::text AS n, count(embedding)::text AS vec
         FROM doc_chunks WHERE company_id = $1 GROUP BY 1`,
      [companyId],
    );
    const failed = await query<{ id: string; source_type: string; source_id: string; last_error: string | null; attempts: number; updated_at: Date }>(
      `SELECT id, source_type, source_id, last_error, attempts, updated_at FROM rag_index_jobs
        WHERE company_id = $1 AND status = 'failed' ORDER BY updated_at DESC LIMIT 50`,
      [companyId],
    );
    sendOk(res, {
      searchMode: deps.embedding ? 'hybrid' : 'fts_only',
      embeddingModel: deps.embedding?.model ?? null,
      jobs: jobs.rows.map((j) => ({ status: j.status, sourceType: j.source_type, count: Number(j.n) })),
      chunks: chunks.rows.map((c) => ({ sourceType: c.source_type, count: Number(c.n), withEmbedding: Number(c.vec) })),
      failed: failed.rows.map((f) => ({
        id: f.id,
        sourceType: f.source_type,
        sourceId: f.source_id,
        lastError: f.last_error,
        attempts: f.attempts,
        updatedAt: new Date(f.updated_at).toISOString(),
      })),
    });
  });

  router.post('/reindex', ...guard, async (req: Request, res: Response) => {
    const companyId = company(req);
    const queued = await enqueueAllApproved(companyId);
    await writeAudit(undefined, {
      userId: req.auth!.userId,
      companyId,
      action: 'rag_reindex',
      tableName: 'rag_index_jobs',
      recordId: null,
      newValues: { queued },
    });
    sendOk(res, { queued });
  });

  router.post(
    '/jobs/:id/retry',
    ...guard,
    validate({ params: z.object({ id: z.string().uuid() }) }),
    async (req: Request, res: Response) => {
      const { rows } = await query(
        `UPDATE rag_index_jobs SET status = 'pending', attempts = 0, run_after = now(), last_error = NULL
          WHERE id = $1 AND company_id = $2 RETURNING id`,
        [req.params.id, company(req)],
      );
      if (!rows.length) throw new NotFoundError('Job topilmadi');
      sendOk(res, { id: req.params.id, status: 'pending' });
    },
  );
  return router;
}
