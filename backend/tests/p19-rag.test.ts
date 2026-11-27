import type express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { query } from '../src/config/database.js';
import { aiRuntime } from '../src/modules/ai/ai.config.js';
import { createMockEmbeddingProvider } from '../src/modules/rag/rag.embedding.js';
import {
  enqueueAllApproved,
  MAX_ATTEMPTS,
  processPendingJobs,
  type RagDeps,
} from '../src/modules/rag/rag.indexer.js';
import { retrieve } from '../src/modules/rag/rag.retrieval.js';
import { testApp } from './helpers/app.js';
import { MockAiClient } from './helpers/ai.js';
import { createCompany, createUser, loginAs, setupAuthDb, type TestCompany, type TestUser } from './helpers/auth.js';
import { describeDb } from './helpers/db.js';
import { MemoryStorage } from './helpers/memoryStorage.js';
import { protocolFlow } from './helpers/p19.js';
import { textPdf } from './helpers/pdf.js';

/**
 * P19 (D-190..D-192) — pgvector, indekslash navbati (faqat tasdiqlangan, idempotent, retry, failed),
 * OCR fallback, gibrid/FTS qidiruv va KOMPANIYALARARO IZOLYATSIYA (majburiy).
 */

describeDb('RAG indekslash va qidiruv', () => {
  let db: Awaited<ReturnType<typeof setupAuthDb>>;
  const storage = new MemoryStorage();
  const ai = new MockAiClient();
  const embedding = createMockEmbeddingProvider();
  let app: express.Express;
  let a: TestCompany;
  let b: TestCompany;
  const users: Record<string, TestUser> = {};
  const tokens: Record<string, string> = {};
  const deps = (): RagDeps => ({ storage, embedding, ai: aiRuntime({ client: ai, storage }) });
  const drain = async (d: RagDeps = deps()) => {
    while ((await processPendingJobs(d, 50)) > 0);
  };

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp({ storage, ai: { client: ai }, embedding }).app;
    a = await createCompany({ name: 'RAG A' });
    b = await createCompany({ name: 'RAG B' });
    await query(`UPDATE companies SET ai_enabled = true WHERE id = $1`, [a.id]);
    for (const [name, role, company] of [
      ['kontrolyor', 'kontrolyor', a],
      ['labHead', 'lab_head', a],
      ['chemist', 'chemist', a],
      ['admin', 'admin', a],
      ['director', 'director', a],
      ['kontrolyorB', 'kontrolyor', b],
      ['labHeadB', 'lab_head', b],
      ['chemistB', 'chemist', b],
    ] as const) {
      users[name] = await createUser({ role, company });
      tokens[name] = (await loginAs(app, users[name]!)).accessToken;
    }
  });
  afterAll(() => db.teardown());
  beforeEach(() => ai.reset());

  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const actors = { tokens, users };

  it('pgvector: kengaytma public sxemada, izolyatsiya sxemasida vector turi ko‘rinadi', async () => {
    const ext = await query<{ nspname: string }>(
      `SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'vector'`,
    );
    expect(ext.rows[0]!.nspname).toBe('public');
    const t = await query<{ d: number }>(`SELECT vector_dims('[1,2,3]'::vector) AS d`);
    expect(t.rows[0]!.d).toBe(3);
  });

  it('faqat tasdiqlangan protokol va peaklar navbatga; qoralama/yuborilgan — yo‘q', async () => {
    const draft = await protocolFlow(app, actors, { approve: false, substanceName: 'Draftmodda' });
    const ok = await protocolFlow(app, actors, {
      substanceName: 'Paratsetamol',
      serialNumber: 'P-1',
      mainText: 'Paratsetamol assay HPLC column C18 retention drift observed',
      peaks: [{ name: 'peak1.pdf', text: 'Paratsetamol chromatogram main peak 4.2 min' }],
    });
    const jobs = await query<{ source_type: string; source_id: string }>(
      `SELECT source_type, source_id FROM rag_index_jobs WHERE company_id = $1`,
      [a.id],
    );
    const ids = jobs.rows.map((j) => j.source_id);
    expect(ids).toContain(ok.protocolId);
    expect(ids).toContain(ok.peakFileIds[0]);
    expect(ids).not.toContain(draft.protocolId);

    await drain();
    const chunks = await query<{ source_type: string; embedding_model: string; embedding_dim: number; substance_name: string; series: string; has_vec: boolean }>(
      `SELECT source_type, embedding_model, embedding_dim, substance_name, series, embedding IS NOT NULL AS has_vec
         FROM doc_chunks WHERE source_id = ANY($1)`,
      [[ok.protocolId, ok.peakFileIds[0]]],
    );
    expect(chunks.rows.length).toBeGreaterThanOrEqual(2);
    expect(chunks.rows.every((c) => c.has_vec && c.embedding_model === 'mock-embed' && c.embedding_dim === 1024)).toBe(true);
    expect(chunks.rows[0]).toMatchObject({ substance_name: 'Paratsetamol', series: 'P-1' });
    const st = await query<{ status: string }>(`SELECT status FROM rag_index_jobs WHERE source_id = $1`, [ok.protocolId]);
    expect(st.rows[0]!.status).toBe('done');
    expect((await query(`SELECT 1 FROM doc_chunks WHERE source_id = $1`, [draft.protocolId])).rows).toHaveLength(0);
  });

  it('idempotent: qayta indekslashda mazmun o‘zgarmasa bo‘laklar qayta yozilmaydi', async () => {
    const p = await protocolFlow(app, actors, { substanceName: 'Idempotent', mainText: 'Idempotent check text for indexing stable' });
    await drain();
    const before = await query<{ id: string }>(`SELECT id FROM doc_chunks WHERE source_id = $1 ORDER BY chunk_index`, [p.protocolId]);
    expect(await enqueueAllApproved(a.id)).toBeGreaterThan(0);
    await drain();
    const after = await query<{ id: string }>(`SELECT id FROM doc_chunks WHERE source_id = $1 ORDER BY chunk_index`, [p.protocolId]);
    expect(after.rows.map((r) => r.id)).toEqual(before.rows.map((r) => r.id));
    // Model almashsa — qayta yoziladi (model nomi xeshda)
    await enqueueAllApproved(a.id);
    await drain({ ...deps(), embedding: createMockEmbeddingProvider(1024, 'mock-embed-v2') });
    const v2 = await query<{ embedding_model: string }>(`SELECT DISTINCT embedding_model FROM doc_chunks WHERE source_id = $1`, [p.protocolId]);
    expect(v2.rows).toEqual([{ embedding_model: 'mock-embed-v2' }]);
  });

  it('xato → retry (eksponensial), MAX_ATTEMPTS dan keyin failed; qayta urinish endpointi', async () => {
    const p = await protocolFlow(app, actors, { substanceName: 'Retrymodda' });
    const broken: RagDeps = { ...deps(), storage: null };
    await processPendingJobs(broken, 50);
    let job = await query<{ id: string; status: string; attempts: number; last_error: string }>(
      `SELECT id, status, attempts, last_error FROM rag_index_jobs WHERE source_id = $1`,
      [p.protocolId],
    );
    expect(job.rows[0]).toMatchObject({ status: 'pending', attempts: 1, last_error: 'STORAGE_UNAVAILABLE' });
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      await query(`UPDATE rag_index_jobs SET run_after = now() WHERE id = $1`, [job.rows[0]!.id]);
      await processPendingJobs(broken, 50);
    }
    job = await query(`SELECT id, status, attempts, last_error FROM rag_index_jobs WHERE source_id = $1`, [p.protocolId]);
    expect(job.rows[0]).toMatchObject({ status: 'failed', attempts: MAX_ATTEMPTS });

    const status = await request(app).get('/api/v1/rag/status').set(auth('labHead')).expect(200);
    expect(status.body.data.failed.map((f: { id: string }) => f.id)).toContain(job.rows[0]!.id);
    expect(status.body.data.searchMode).toBe('hybrid');
    await request(app).post(`/api/v1/rag/jobs/${job.rows[0]!.id}/retry`).set(auth('labHead')).expect(200);
    await drain();
    job = await query(`SELECT id, status, attempts, last_error FROM rag_index_jobs WHERE source_id = $1`, [p.protocolId]);
    expect(job.rows[0]!.status).toBe('done');
  });

  it('ND: tasdiqlanganda indekslanadi, revise qilinsa bo‘laklar olib tashlanadi', async () => {
    const nd = await request(app).post('/api/v1/nd').set(auth('labHead')).send({ code: 'ND-RAG', name: 'Monografiya', substanceName: 'Ibuprofen' }).expect(201);
    const id = nd.body.data.id as string;
    await request(app).post(`/api/v1/nd/${id}/file`).set(auth('labHead')).attach('file', textPdf('Sulfated ash method requires muffle furnace 600 C'), 'nd.pdf').expect(200);
    await request(app).post(`/api/v1/nd/${id}/requirements`).set(auth('labHead')).send({ kind: 'equipment', equipmentCategory: 'Muffel pech', methodName: 'Sulfated ash' }).expect(201);
    await drain();
    expect((await query(`SELECT 1 FROM doc_chunks WHERE source_id = $1`, [id])).rows).toHaveLength(0); // draft
    await request(app).post(`/api/v1/nd/${id}/approve`).set(auth('labHead')).expect(200);
    await drain();
    const c = await query<{ chunk_text: string }>(`SELECT chunk_text FROM doc_chunks WHERE source_id = $1`, [id]);
    expect(c.rows[0]!.chunk_text).toMatch(/Sulfated ash method/);
    expect(c.rows.map((r) => r.chunk_text).join('\n')).toMatch(/apparat: Muffel pech/);
    await request(app).post(`/api/v1/nd/${id}/revise`).set(auth('labHead')).expect(200);
    await drain();
    expect((await query(`SELECT 1 FROM doc_chunks WHERE source_id = $1`, [id])).rows).toHaveLength(0);
    const job = await query<{ status: string }>(`SELECT status FROM rag_index_jobs WHERE source_id = $1`, [id]);
    expect(job.rows[0]!.status).toBe('skipped');
  });

  it('OCR: matnsiz skan peak fayli — P18 vision orqali; AI o‘chiq kompaniyada — faqat metadata', async () => {
    ai.respond({ image_quality: 'good', text: 'Skan qilingan xromatogramma: asosiy peak 7.45 min, tailing 1.9' });
    const p = await protocolFlow(app, actors, {
      substanceName: 'Skanmodda',
      peaks: [{ name: 'scan.pdf', body: textPdf('') }],
    });
    await drain();
    const c = await query<{ chunk_text: string }>(`SELECT chunk_text FROM doc_chunks WHERE source_id = $1`, [p.peakFileIds[0]]);
    expect(c.rows.map((r) => r.chunk_text).join('\n')).toMatch(/asosiy peak 7\.45/);
    const ocrLog = await query<{ kind: string; result_json: unknown }>(`SELECT kind, result_json FROM ai_extractions WHERE kind = 'ocr' AND company_id = $1`, [a.id]);
    expect(ocrLog.rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(ocrLog.rows[0]!.result_json)).not.toMatch(/7\.45/); // matn jurnalga yozilmaydi

    // B kompaniyada AI o'chiq — OCR chaqirilmaydi, metadata sarlavhasi indekslanadi
    const pb = await protocolFlow(app, actors, { suffix: 'B', substanceName: 'Skanmodda', mainText: '', peaks: [{ name: 's.pdf', body: textPdf('') }] });
    ai.reset();
    await drain();
    expect(ai.calls).toHaveLength(0);
    const jb = await query<{ status: string; last_error: string }>(`SELECT status, last_error FROM rag_index_jobs WHERE source_id = $1`, [pb.peakFileIds[0]]);
    expect(jb.rows[0]).toMatchObject({ status: 'done', last_error: 'OCR_DISABLED' });
    const cb = await query<{ chunk_text: string }>(`SELECT chunk_text FROM doc_chunks WHERE source_id = $1`, [pb.peakFileIds[0]]);
    expect(cb.rows[0]!.chunk_text).toMatch(/^\[Peak fayli\] Skanmodda/);
  });

  describe('KOMPANIYALARARO IZOLYATSIYA (majburiy)', () => {
    let aProto: string;
    let bProto: string;
    beforeAll(async () => {
      const secret = 'Metformin dissolution failure caused by vacuum degasser leak';
      aProto = (await protocolFlow(app, actors, { substanceName: 'Metformin', mainText: `A kompaniya: ${secret}` })).protocolId;
      bProto = (await protocolFlow(app, actors, { suffix: 'B', substanceName: 'Metformin', mainText: `B kompaniya MAXFIY: ${secret}` })).protocolId;
      await drain();
    });

    it('vektor + FTS: A so‘rovi B bo‘laklarini hech qachon qaytarmaydi (va aksincha)', async () => {
      for (const [company, own, foreign] of [
        [a.id, aProto, bProto],
        [b.id, bProto, aProto],
      ] as const) {
        const hybrid = await retrieve(company, 'Metformin dissolution vacuum degasser leak', {}, embedding, 50);
        const fts = await retrieve(company, 'Metformin dissolution vacuum degasser leak', {}, null, 50);
        for (const r of [hybrid, fts]) {
          const ids = r.chunks.map((c) => c.sourceId);
          expect(ids).toContain(own);
          expect(ids).not.toContain(foreign);
        }
        const all = await query<{ company_id: string }>(
          `SELECT DISTINCT c.company_id FROM doc_chunks c WHERE c.id = ANY($1)`,
          [[...hybrid.chunks, ...fts.chunks].map((c) => c.chunkId)],
        );
        expect(all.rows.map((r) => r.company_id)).toEqual([company]);
      }
    });

    it('filtrlar ham kompaniya ichida: xomashyo filtri bilan boshqa kompaniya ko‘rinmaydi', async () => {
      const r = await retrieve(b.id, 'Metformin', { substanceName: 'metformin' }, embedding, 50);
      expect(r.chunks.length).toBeGreaterThan(0);
      expect(r.chunks.every((c) => c.sourceId !== aProto)).toBe(true);
    });

    it('rag/status va reindex faqat o‘z kompaniyasi; kimyogar/director/kontrolyor — 403', async () => {
      const sa = await request(app).get('/api/v1/rag/status').set(auth('labHeadB')).expect(200);
      expect(sa.body.data.failed.every((f: { sourceId: string }) => f.sourceId !== aProto)).toBe(true);
      for (const who of ['chemist', 'director', 'kontrolyor']) {
        expect((await request(app).get('/api/v1/rag/status').set(auth(who))).status, who).toBe(403);
      }
      const aJob = await query<{ id: string }>(`SELECT id FROM rag_index_jobs WHERE source_id = $1`, [aProto]);
      expect((await request(app).post(`/api/v1/rag/jobs/${aJob.rows[0]!.id}/retry`).set(auth('labHeadB'))).status).toBe(404);
      const re = await request(app).post('/api/v1/rag/reindex').set(auth('admin')).expect(200);
      const queued = await query<{ company_id: string }>(`SELECT DISTINCT company_id FROM rag_index_jobs WHERE status = 'pending'`);
      expect(re.body.data.queued).toBeGreaterThan(0);
      expect(queued.rows.map((r) => r.company_id)).toEqual([a.id]);
      await drain();
    });
  });

  it('FTS fallback: embedding yo‘q — fts_only rejimi, natija topiladi', async () => {
    await protocolFlow(app, actors, { substanceName: 'Amoksitsillin', mainText: 'Amoksitsillin related substances impurity spike column aging' });
    await drain();
    const r = await retrieve(a.id, 'amoksitsillin impurity', {}, null);
    expect(r.mode).toBe('fts_only');
    expect(r.chunks[0]!.chunkText).toMatch(/Amoksitsillin/);
    const h = await retrieve(a.id, 'amoksitsillin impurity', {}, embedding);
    expect(h.mode).toBe('hybrid');
  });
});
