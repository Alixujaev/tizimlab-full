import type express from 'express';
import JSZip from 'jszip';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { query } from '../src/config/database.js';
import { createSampleSchema } from '../src/modules/samples/samples.schemas.js';
import { toIsoDay } from '../src/utils/dates.js';
import { buildSampleInfoRows, formatIsoDay } from '../src/utils/docxExport.js';
import { testApp } from './helpers/app.js';
import { createCompany, createUser, loginAs, setupAuthDb, type TestUser } from './helpers/auth.js';
import { describeDb } from './helpers/db.js';

/** P16 / TZ §3.1 — namunada kelgan sana va yaroqlilik muddati (D-168, R-P16-01..04). */

const base = { type: 'raw_material' as const, substanceName: 'Paratsetamol' };

describe('createSampleSchema: arrivalDate / expiryDate (R-P16-01)', () => {
  it('ikkala sana ixtiyoriy, null ham qabul qilinadi', () => {
    expect(createSampleSchema.safeParse(base).success).toBe(true);
    expect(
      createSampleSchema.safeParse({ ...base, arrivalDate: null, expiryDate: null }).success,
    ).toBe(true);
  });

  it('format va kalendar mavjudligi tekshiriladi', () => {
    expect(createSampleSchema.safeParse({ ...base, arrivalDate: '2026-02-30' }).success).toBe(
      false,
    );
    expect(createSampleSchema.safeParse({ ...base, expiryDate: '26-01-01' }).success).toBe(false);
    expect(createSampleSchema.safeParse({ ...base, expiryDate: '2028-02-29' }).success).toBe(true);
  });

  it('chegara: expiryDate == manufacturedAt ruxsat, bir kun oldin — rad', () => {
    const same = createSampleSchema.safeParse({
      ...base,
      manufacturedAt: '2026-01-10',
      expiryDate: '2026-01-10',
    });
    expect(same.success).toBe(true);

    const before = createSampleSchema.safeParse({
      ...base,
      manufacturedAt: '2026-01-10',
      expiryDate: '2026-01-09',
    });
    expect(before.success).toBe(false);
    expect(before.error?.issues[0]?.path).toEqual(['expiryDate']);
  });

  it('manufacturedAt yo‘q bo‘lsa expiryDate istalgan to‘g‘ri sana bo‘lishi mumkin', () => {
    expect(createSampleSchema.safeParse({ ...base, expiryDate: '2000-01-01' }).success).toBe(true);
  });
});

describe('toIsoDay (pg date → YYYY-MM-DD, zona siljishisiz)', () => {
  it('lokal yarim tundagi Date bir kun orqaga surilmaydi', () => {
    expect(toIsoDay(new Date(2026, 1, 1))).toBe('2026-02-01');
    expect(toIsoDay(new Date(2026, 11, 31, 0, 0, 0))).toBe('2026-12-31');
  });
  it('satr, null, bo‘sh va noto‘g‘ri qiymatlar', () => {
    expect(toIsoDay('2026-02-01')).toBe('2026-02-01');
    expect(toIsoDay('2026-02-01T10:00:00Z')).toBe('2026-02-01');
    expect(toIsoDay(null)).toBeNull();
    expect(toIsoDay('')).toBeNull();
    expect(toIsoDay('Sun Feb 01')).toBeNull();
    expect(toIsoDay(new Date('invalid'))).toBeNull();
  });
});

describe('DOCX eksport qatorlari (R-P16-03, D-84)', () => {
  it('formatIsoDay: ISO → DD.MM.YYYY, bo‘sh → —', () => {
    expect(formatIsoDay('2026-03-05')).toBe('05.03.2026');
    expect(formatIsoDay(null)).toBe('—');
    expect(formatIsoDay(undefined)).toBe('—');
  });

  it('yangi sanalar uch tilda chiqadi, namuna kodi qatori yo‘q', () => {
    const extra = {
      lotNumber: 'LOT-1',
      manufacturedAt: '2026-01-01',
      expiryDate: '2028-01-01',
      arrivalDate: '2026-02-01',
      analysisEnd: '2026-02-10',
    };
    const proto = { sampleType: 'raw_material' as const, sampleSubstanceName: 'X' };
    const uz = Object.fromEntries(buildSampleInfoRows(proto, extra, 'uz'));
    expect(uz['Kelgan sana']).toBe('01.02.2026');
    expect(uz['Yaroqlilik muddati']).toBe('01.01.2028');
    expect(uz['Ishlab chiqarilgan sana']).toBe('01.01.2026');
    expect(uz['Analiz tugash sanasi']).toBe('10.02.2026');
    expect(uz['Partiya (lot) raqami']).toBe('LOT-1');

    const ru = Object.fromEntries(buildSampleInfoRows(proto, extra, 'ru'));
    expect(ru['Срок годности']).toBe('01.01.2028');
    const en = Object.fromEntries(buildSampleInfoRows(proto, extra, 'en'));
    expect(en['Arrival Date']).toBe('01.02.2026');

    for (const rows of [uz, ru, en]) {
      expect(Object.keys(rows).some((k) => /kod|код|code/i.test(k))).toBe(false);
    }
  });
});

describeDb('samples: arrival_date / expiry_date (API, tenant, rol)', () => {
  let db: Awaited<ReturnType<typeof setupAuthDb>>;
  let app: express.Express;
  let kontrolyorA: TestUser;
  let chemistA: TestUser;
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp().app;
    const companyA = await createCompany({ name: 'P16 Alpha' });
    const companyB = await createCompany({ name: 'P16 Beta' });
    kontrolyorA = await createUser({ role: 'kontrolyor', company: companyA });
    chemistA = await createUser({ role: 'chemist', company: companyA });
    const labHeadA = await createUser({ role: 'lab_head', company: companyA });
    const directorA = await createUser({ role: 'director', company: companyA });
    const labHeadB = await createUser({ role: 'lab_head', company: companyB });
    for (const [k, u] of Object.entries({ kontrolyorA, chemistA, labHeadA, directorA, labHeadB })) {
      tokens[k] = (await loginAs(app, u)).accessToken;
    }
  });

  afterAll(async () => {
    await db.teardown();
  });

  const auth = (k: string) => ({ Authorization: `Bearer ${tokens[k]}` });

  async function createSample(body: Record<string, unknown>) {
    return request(app)
      .post('/api/v1/samples')
      .set(auth('kontrolyorA'))
      .send({ ...base, ...body });
  }

  it('R-P16-02: sanalar saqlanadi (DB) va detail/ro‘yxatda qaytadi', async () => {
    const res = await createSample({
      manufacturedAt: '2026-01-01',
      expiryDate: '2028-01-01',
      arrivalDate: '2026-02-01',
      lotNumber: 'LOT-P16',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.arrivalDate).toBe('2026-02-01');
    expect(res.body.data.expiryDate).toBe('2028-01-01');

    const dbRow = await query<{ arrival_date: string; expiry_date: string }>(
      `SELECT arrival_date::text AS arrival_date, expiry_date::text AS expiry_date FROM samples WHERE id = $1`,
      [res.body.data.id],
    );
    expect(dbRow.rows[0]).toEqual({ arrival_date: '2026-02-01', expiry_date: '2028-01-01' });

    const detail = await request(app)
      .get(`/api/v1/samples/${res.body.data.id}`)
      .set(auth('labHeadA'));
    expect(detail.status).toBe(200);
    expect(detail.body.data.arrivalDate).toBe('2026-02-01');

    const list = await request(app).get('/api/v1/samples').set(auth('labHeadA'));
    const item = list.body.data.find((s: { id: string }) => s.id === res.body.data.id);
    expect(item.expiryDate).toBe('2028-01-01');
  });

  it('R-P16-01: yaroqlilik muddati ishlab chiqarilgan sanadan oldin — 400', async () => {
    const res = await createSample({ manufacturedAt: '2026-05-01', expiryDate: '2026-04-30' });
    expect(res.status).toBe(400);
  });

  it('R-P16-01: DB CHECK ham himoya qiladi (validatsiyani chetlab o‘tgan yozuv rad etiladi)', async () => {
    const created = await createSample({ manufacturedAt: '2026-05-01' });
    await expect(
      query(`UPDATE samples SET expiry_date = '2026-04-01' WHERE id = $1`, [created.body.data.id]),
    ).rejects.toThrow(/samples_expiry_after_manufacture_check/);
  });

  it('rol: kontrolyor bo‘lmaganlar (lab_head, director, chemist) namuna yarata olmaydi — 403', async () => {
    for (const k of ['labHeadA', 'directorA', 'chemistA']) {
      const res = await request(app)
        .post('/api/v1/samples')
        .set(auth(k))
        .send({ ...base, arrivalDate: '2026-02-01' });
      expect(res.status).toBe(403);
    }
  });

  it('tenant: B kompaniyasi A namunasini (sanalari bilan) ko‘ra olmaydi — 404', async () => {
    const created = await createSample({ arrivalDate: '2026-02-02' });
    const res = await request(app)
      .get(`/api/v1/samples/${created.body.data.id}`)
      .set(auth('labHeadB'));
    expect(res.status).toBe(404);
  });

  it('R-P16-03: DOCX eksportda lot, seriya va yangi sanalar haqiqatda chiqadi; namuna kodi yo‘q', async () => {
    const created = await createSample({
      lotNumber: 'LOT-DOCX-77',
      serialNumber: 'SER-DOCX-88',
      manufacturedAt: '2026-01-15',
      expiryDate: '2027-07-31',
      arrivalDate: '2026-02-20',
    });
    const sampleId = created.body.data.id as string;
    const assign = await request(app)
      .post(`/api/v1/samples/${sampleId}/assign`)
      .set(auth('labHeadA'))
      .send({ chemistId: chemistA.id });
    expect(assign.status).toBe(200);
    const protocols = await request(app)
      .get(`/api/v1/protocols/sample/${sampleId}`)
      .set(auth('chemistA'));
    const protocolId = protocols.body.data[0].id as string;

    const exportRes = await request(app)
      .get(`/api/v1/protocols/${protocolId}/export?lang=uz`)
      .set(auth('chemistA'))
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(exportRes.status).toBe(200);

    const zip = await JSZip.loadAsync(exportRes.body as Buffer);
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('LOT-DOCX-77');
    expect(xml).toContain('SER-DOCX-88');
    expect(xml).toContain('31.07.2027');
    expect(xml).toContain('20.02.2026');
    expect(xml).toContain('Kelgan sana');
    expect(xml.toLowerCase()).not.toContain('smp-');
    void kontrolyorA;
  });
});
