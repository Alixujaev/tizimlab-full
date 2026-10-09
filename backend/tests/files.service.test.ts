import express from 'express';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { query } from '../src/config/database.js';
import {
  buildKey,
  getFileDownloadUrl,
  listFiles,
  removeFile,
  runWithUpload,
  storeFile,
} from '../src/modules/files/files.service.js';
import { requireStorage, storageFromEnv } from '../src/modules/files/files.storage.js';
import { uploadSingle } from '../src/modules/files/files.upload.js';
import { assertAllowedFile, GENERIC_MAX_BYTES } from '../src/modules/files/files.validation.js';
import { miniApp } from './helpers/app.js';
import {
  createCompany,
  createUser,
  setupAuthDb,
  type TestCompany,
  type TestUser,
} from './helpers/auth.js';
import { describeDb } from './helpers/db.js';
import { fixtures, MemoryStorage } from './helpers/memoryStorage.js';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

describe('files: R2 kaliti (R-FILE-01, path traversal yo‘q)', () => {
  it('format <company_id>/<entity>/<uuid>.<ext>, asl nom yo‘q', () => {
    const key = buildKey('11111111-1111-1111-1111-111111111111', 'sample-passports', 'pdf');
    expect(key).toMatch(
      new RegExp(`^11111111-1111-1111-1111-111111111111/sample-passports/${UUID}\\.pdf$`),
    );
  });

  it('noto‘g‘ri entity/ext rad etiladi', () => {
    expect(() => buildKey('c', '../x', 'pdf')).toThrow();
    expect(() => buildKey('c', 'ok', 'p/df')).toThrow();
  });
});

describe('files: storage konfiguratsiyasi (R-FILE-11, D-121)', () => {
  it('R2_* to‘liq bo‘lmasa storage null → 503 STORAGE_UNAVAILABLE', () => {
    expect(storageFromEnv({ R2_BUCKET: 'b' } as never)).toBeNull();
    expect(() => requireStorage(null)).toThrow(
      expect.objectContaining({ status: 503, code: 'STORAGE_UNAVAILABLE' }),
    );
  });

  it('R2_* to‘liq bo‘lsa S3-mos adapter yaratiladi (tarmoqqa ulanmasdan)', () => {
    const s = storageFromEnv({
      R2_ACCOUNT_ID: 'acc',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_BUCKET: 'bucket',
      R2_ENDPOINT: 'https://acc.r2.cloudflarestorage.com',
    });
    expect(s).not.toBeNull();
    expect(typeof s!.put).toBe('function');
  });
});

describe('files: yuklash tartibi — COMMIT xatosida yetim ob‘ekt o‘chiriladi', () => {
  it('put muvaffaqiyatli, COMMIT xato → storage.delete chaqiriladi', async () => {
    const storage = new MemoryStorage();
    const client = {
      query: async (sql: string) => {
        if (sql === 'COMMIT') throw new Error('commit failed');
        return { rows: [] };
      },
      release: () => undefined,
    };
    const pool = { connect: async () => client } as unknown as pg.Pool;
    await expect(
      runWithUpload(
        storage,
        { key: 'c/e/k.pdf', body: fixtures.pdf(), contentType: 'application/pdf' },
        async () => 'ok',
        pool,
      ),
    ).rejects.toThrow('commit failed');
    expect(storage.deleted).toEqual(['c/e/k.pdf']);
    expect(storage.objects.size).toBe(0);
  });
});

describe('files: multer memory storage va limit (R-FILE-07, R-FILE-08)', () => {
  const app = () => {
    const r = express.Router();
    r.post('/u', uploadSingle('file', GENERIC_MAX_BYTES), (req, res) => {
      const v = assertAllowedFile(req.file, GENERIC_MAX_BYTES);
      res.json({ data: { size: v.size, mime: v.mime, hasPath: 'path' in (req.file ?? {}) } });
    });
    return miniApp(r).app;
  };

  it('fayl xotirada (diskka yozilmaydi), mijoz MIME e‘tiborsiz', async () => {
    const res = await request(app())
      .post('/u')
      .attach('file', fixtures.pdf(), { filename: 'a.pdf', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ mime: 'application/pdf', hasPath: false });
  });

  it('50MB dan katta fayl → 413', async () => {
    const big = Buffer.concat([fixtures.pdf(), Buffer.alloc(GENERIC_MAX_BYTES)]);
    const res = await request(app()).post('/u').attach('file', big, 'big.pdf');
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('kutilmagan maydon → 400', async () => {
    const res = await request(app()).post('/u').attach('other', fixtures.pdf(), 'a.pdf');
    expect(res.status).toBe(400);
  });
});

type Db = Awaited<ReturnType<typeof setupAuthDb>>;

describeDb('files: generic servis (R-FILE-03..06, R-FILE-10), tenant izolyatsiyasi', () => {
  let db: Db;
  let companyA: TestCompany;
  let companyB: TestCompany;
  let userA: TestUser;
  let userB: TestUser;
  const storage = new MemoryStorage();
  const validated = () =>
    assertAllowedFile(
      { originalname: 'hujjat.pdf', buffer: fixtures.pdf(), size: fixtures.pdf().length },
      GENERIC_MAX_BYTES,
    );

  beforeAll(async () => {
    db = await setupAuthDb();
    companyA = await createCompany();
    companyB = await createCompany();
    userA = await createUser({ role: 'lab_head', company: companyA });
    userB = await createUser({ role: 'lab_head', company: companyB });
  });
  afterAll(() => db.teardown());
  beforeEach(() => storage.reset());

  const actorA = () => ({ userId: userA.id, companyId: companyA.id });

  it('storeFile: R2 ga yozadi, files jadvaliga metama‘lumot va audit', async () => {
    const dto = await storeFile(storage, actorA(), { entity: 'generic', file: validated() });
    const { rows } = await query<{
      r2_key: string;
      filename: string;
      mime_type: string;
      size_bytes: string;
      company_id: string;
    }>('SELECT * FROM files WHERE id = $1', [dto.id]);
    expect(rows[0]).toMatchObject({
      filename: 'hujjat.pdf',
      mime_type: 'application/pdf',
      company_id: companyA.id,
    });
    expect(rows[0]!.r2_key).toMatch(new RegExp(`^${companyA.id}/generic/${UUID}\\.pdf$`));
    expect(rows[0]!.r2_key).not.toContain('hujjat');
    expect(storage.objects.has(rows[0]!.r2_key)).toBe(true);
    const audit = await query('SELECT 1 FROM audit_log WHERE table_name = $1 AND record_id = $2', [
      'files',
      dto.id,
    ]);
    expect(audit.rowCount).toBe(1);
  });

  it('put xato → files qatori yozilmaydi (rollback)', async () => {
    const before = await query<{ c: string }>('SELECT count(*)::text c FROM files');
    storage.failNextPut = true;
    await expect(
      storeFile(storage, actorA(), { entity: 'generic', file: validated() }),
    ).rejects.toThrow();
    const after = await query<{ c: string }>('SELECT count(*)::text c FROM files');
    expect(after.rows[0]!.c).toBe(before.rows[0]!.c);
  });

  it('listFiles, getFileDownloadUrl, removeFile — faqat o‘z kompaniyasi; boshqasi 404', async () => {
    const dto = await storeFile(storage, actorA(), { entity: 'generic', file: validated() });
    expect((await listFiles(companyA.id)).map((f) => f.id)).toContain(dto.id);
    expect((await listFiles(companyB.id)).map((f) => f.id)).not.toContain(dto.id);

    const link = await getFileDownloadUrl(storage, companyA.id, dto.id);
    expect(link.expiresIn).toBe(300);
    expect(storage.signed.at(-1)!.opts.contentDisposition).toContain('hujjat.pdf');

    await expect(getFileDownloadUrl(storage, companyB.id, dto.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      removeFile(storage, { userId: userB.id, companyId: companyB.id }, dto.id),
    ).rejects.toMatchObject({ status: 404 });

    await removeFile(storage, actorA(), dto.id);
    expect((await listFiles(companyA.id)).map((f) => f.id)).not.toContain(dto.id);
    expect(storage.deleted).toHaveLength(1);
  });

  it('removeFile: R2 delete xatosi DB o‘chirishni bekor qilmaydi', async () => {
    const dto = await storeFile(storage, actorA(), { entity: 'generic', file: validated() });
    storage.failNextDelete = true;
    await removeFile(storage, actorA(), dto.id);
    expect((await listFiles(companyA.id)).map((f) => f.id)).not.toContain(dto.id);
  });
});
