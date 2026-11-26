import type express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { query } from '../src/config/database.js';
import { checkEquipment, checkReagent, type LotLite } from '../src/modules/nd/nd.feasibility.js';
import { ndRequirementSchema } from '../src/modules/nd/nd.schemas.js';
import { testApp } from './helpers/app.js';
import {
  createCompany,
  createUser,
  loginAs,
  setupAuthDb,
  type TestCompany,
  type TestUser,
} from './helpers/auth.js';
import { describeDb } from './helpers/db.js';
import { fixtures, MemoryStorage } from './helpers/memoryStorage.js';

/** P17 / TZ §3.2–§3.3 — ND, talablar (draft → approved) va moslik tekshiruvi (D-176). */

const TODAY = '2026-06-15';
const lot = (over: Partial<LotLite>): LotLite => ({
  id: 'l',
  quantity: 10,
  unit: 'ml',
  expiresAt: null,
  approvalStatus: 'approved',
  ...over,
});

describe('feasibility: sof funksiyalar', () => {
  it('apparat: yo‘q / texnik xizmatda / kalibrlash o‘tgan / bittasi yaroqli bo‘lsa — ok', () => {
    expect(checkEquipment('Mufel pech', [], TODAY).reasons[0]!.type).toBe('equipment_missing');
    const bad = checkEquipment(
      'Mufel pech',
      [
        { id: '1', name: 'M1', status: 'maintenance', calibrationDue: null },
        { id: '2', name: 'M2', status: 'active', calibrationDue: '2026-06-14' },
      ],
      TODAY,
    );
    expect(bad.ok).toBe(false);
    expect(bad.reasons.map((r) => r.type)).toEqual([
      'equipment_unavailable',
      'equipment_calibration_expired',
    ]);
    const okToday = checkEquipment(
      'Mufel pech',
      [{ id: '3', name: 'M3', status: 'active', calibrationDue: TODAY }],
      TODAY,
    );
    expect(okToday).toMatchObject({ ok: true, reasons: [] });
  });

  it('reaktiv: aynan yetadi — ok; 1 birlik kam — insufficient (yetishmaydigan miqdor bilan)', () => {
    const item = { id: 'i', name: 'Sulfat kislota' };
    expect(checkReagent(item, 'ml', 2, 5, [lot({ quantity: 10 })], TODAY)).toMatchObject({
      ok: true,
      required: 10,
      available: 10,
    });
    const short = checkReagent(item, 'ml', 2, 5, [lot({ quantity: 9 })], TODAY);
    expect(short.ok).toBe(false);
    expect(short.reasons[0]).toMatchObject({
      type: 'reagent_insufficient',
      data: { required: 10, available: 9, missing: 1, unit: 'ml' },
    });
  });

  it('reaktiv: faqat tasdiqlangan, muddati o‘tmagan lotlar; bugun tugaydigani sanaladi; birlik konvertatsiyasi', () => {
    const item = { id: 'i', name: 'Etanol' };
    const lots = [
      lot({ quantity: 0.5, unit: 'l', expiresAt: TODAY }), // 500 ml — sanaladi
      lot({ quantity: 1000, expiresAt: '2026-06-14' }), // o'tgan
      lot({ quantity: 1000, approvalStatus: 'pending' }), // tasdiqlanmagan
      lot({ quantity: 1000, approvalStatus: 'rejected' }),
    ];
    expect(checkReagent(item, 'ml', 500, 1, lots, TODAY)).toMatchObject({
      ok: true,
      available: 500,
    });
    expect(checkReagent(item, 'ml', 501, 1, lots, TODAY).reasons[0]!.data.missing).toBe(1);
  });

  it('reaktiv: umuman yo‘q / barcha (tasdiqlangan) lotlar muddati o‘tgan', () => {
    const item = { id: 'i', name: 'X' };
    expect(checkReagent(item, 'g', 1, 1, [], TODAY).reasons[0]!.type).toBe('reagent_missing');
    expect(
      checkReagent(
        item,
        'g',
        1,
        1,
        [lot({ unit: 'g', expiresAt: '2026-01-01' }), lot({ unit: 'g', expiresAt: '2026-06-14' })],
        TODAY,
      ).reasons[0]!.type,
    ).toBe('reagent_all_expired');
  });

  it('talab sxemasi: turga qarab maydonlar majburiy', () => {
    expect(
      ndRequirementSchema.safeParse({ kind: 'equipment', equipmentCategory: 'HPLC' }).success,
    ).toBe(true);
    expect(ndRequirementSchema.safeParse({ kind: 'equipment' }).success).toBe(false);
    expect(
      ndRequirementSchema.safeParse({
        kind: 'reagent',
        reagentItemId: '00000000-0000-4000-8000-000000000001',
        quantityPerAnalysis: 0,
        unit: 'ml',
      }).success,
    ).toBe(false);
  });
});

describeDb('ND: API, holat, fayl, moslik', () => {
  let db: Awaited<ReturnType<typeof setupAuthDb>>;
  let app: express.Express;
  const storage = new MemoryStorage();
  let a: TestCompany;
  let b: TestCompany;
  const users: Record<string, TestUser> = {};
  const tokens: Record<string, string> = {};
  let itemSulfat = '';

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp({ storage }).app;
    a = await createCompany({ name: 'ND A' });
    b = await createCompany({ name: 'ND B' });
    for (const [n, role, c] of [
      ['kontrolyor', 'kontrolyor', a],
      ['chemist', 'chemist', a],
      ['labHead', 'lab_head', a],
      ['director', 'director', a],
      ['admin', 'admin', a],
      ['labHeadB', 'lab_head', b],
    ] as const) {
      users[n] = await createUser({ role, company: c });
      tokens[n] = (await loginAs(app, users[n]!)).accessToken;
    }
    const { rows } = await query<{ id: string }>(
      `INSERT INTO reagent_items (company_id, name, name_key, unit_family) VALUES ($1, 'Sulfat kislota', 'sulfat kislota', 'volume') RETURNING id`,
      [a.id],
    );
    itemSulfat = rows[0]!.id;
  });
  afterAll(() => db.teardown());
  beforeEach(async () => {
    storage.reset();
    await query('DELETE FROM nd_requirements');
    await query('DELETE FROM normative_documents');
    await query('DELETE FROM equipment');
    await query('DELETE FROM reagents');
  });

  const auth = (w: string) => ({ Authorization: `Bearer ${tokens[w]}` });
  async function nd(code = 'ND-42-1234', who = 'labHead'): Promise<string> {
    const r = await request(app)
      .post('/api/v1/nd')
      .set(auth(who))
      .send({ code, name: 'Paratsetamol substansiyasi', version: '2024' });
    expect(r.status).toBe(201);
    return r.body.data.id as string;
  }
  const addReq = (id: string, body: Record<string, unknown>, who = 'labHead') =>
    request(app).post(`/api/v1/nd/${id}/requirements`).set(auth(who)).send(body);
  const sulfatReq = {
    kind: 'reagent',
    methodName: 'Sulfated ash',
    reagentItemId: '',
    quantityPerAnalysis: 2,
    unit: 'ml',
  };

  it('yaratish, talablar (draft), tasdiqlash; approved holatda tahrirlash — 409; revise → draft', async () => {
    const id = await nd();
    expect(
      (await request(app).post(`/api/v1/nd/${id}/approve`).set(auth('labHead'))).body.error.code,
    ).toBe('ND_NO_REQUIREMENTS');
    expect(
      (
        await addReq(id, {
          kind: 'equipment',
          methodName: 'Sulfated ash',
          equipmentCategory: 'Mufel pech',
        })
      ).status,
    ).toBe(201);
    const r2 = await addReq(id, { ...sulfatReq, reagentItemId: itemSulfat });
    expect(r2.status).toBe(201);
    expect(r2.body.data.requirements).toHaveLength(2);
    expect(
      r2.body.data.requirements.find((q: { kind: string }) => q.kind === 'reagent'),
    ).toMatchObject({
      reagentItemName: 'Sulfat kislota',
      quantityPerAnalysis: 2,
      unit: 'ml',
      source: 'manual',
    });

    const ap = await request(app).post(`/api/v1/nd/${id}/approve`).set(auth('labHead'));
    expect(ap.body.data).toMatchObject({ status: 'approved', approvedBy: users.labHead!.id });
    const locked = await addReq(id, { kind: 'equipment', equipmentCategory: 'Tarozi' });
    expect(locked.status).toBe(409);
    expect(locked.body.error.code).toBe('ND_NOT_DRAFT');
    expect((await request(app).post(`/api/v1/nd/${id}/approve`).set(auth('labHead'))).status).toBe(
      409,
    );

    const rev = await request(app).post(`/api/v1/nd/${id}/revise`).set(auth('admin'));
    expect(rev.body.data).toMatchObject({ status: 'draft', approvedAt: null });
    const audit = await query<{ action: string }>(
      `SELECT action FROM audit_log WHERE table_name = 'normative_documents' AND record_id = $1 ORDER BY created_at`,
      [id],
    );
    expect(audit.rows.map((x) => x.action)).toEqual(['create', 'status_change', 'status_change']);
  });

  it('reaktiv talabi: birlik element oilasiga mos kelmasa — 422 UNIT_MISMATCH; boshqa kompaniya elementi — 404', async () => {
    const id = await nd();
    const bad = await addReq(id, { ...sulfatReq, reagentItemId: itemSulfat, unit: 'g' });
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('UNIT_MISMATCH');
    expect((await addReq(id, { ...sulfatReq, reagentItemId: itemSulfat, unit: 'l' })).status).toBe(
      201,
    );
    const { rows } = await query<{ id: string }>(
      `INSERT INTO reagent_items (company_id, name, name_key, unit_family) VALUES ($1, 'B kislota', 'b kislota', 'volume') RETURNING id`,
      [b.id],
    );
    expect((await addReq(id, { ...sulfatReq, reagentItemId: rows[0]!.id })).status).toBe(404);
  });

  it('kod + versiya kompaniya ichida unikal (409), boshqa kompaniyada mumkin', async () => {
    await nd('ND-1');
    const dup = await request(app)
      .post('/api/v1/nd')
      .set(auth('labHead'))
      .send({ code: 'nd-1', name: 'X', version: '2024' });
    expect(dup.status).toBe(409);
    expect(
      (
        await request(app)
          .post('/api/v1/nd')
          .set(auth('labHeadB'))
          .send({ code: 'ND-1', name: 'X', version: '2024' })
      ).status,
    ).toBe(201);
  });

  it('rol: kontrolyor/chemist/director o‘qiydi va moslikni tekshiradi; yozish — 403', async () => {
    const id = await nd();
    for (const w of ['kontrolyor', 'chemist', 'director']) {
      expect((await request(app).get(`/api/v1/nd/${id}`).set(auth(w))).status).toBe(200);
      expect((await request(app).get(`/api/v1/nd/${id}/feasibility`).set(auth(w))).status).toBe(
        200,
      );
      expect(
        (await request(app).post('/api/v1/nd').set(auth(w)).send({ code: 'Z', name: 'Z' })).status,
      ).toBe(403);
      expect((await addReq(id, { kind: 'equipment', equipmentCategory: 'Y' }, w)).status).toBe(403);
      expect((await request(app).post(`/api/v1/nd/${id}/approve`).set(auth(w))).status).toBe(403);
    }
  });

  it('tenant: B kompaniyasi A ND sini, talablarini va moslik natijasini ko‘ra olmaydi (404)', async () => {
    const id = await nd();
    for (const path of [`/api/v1/nd/${id}`, `/api/v1/nd/${id}/feasibility`]) {
      expect((await request(app).get(path).set(auth('labHeadB'))).status).toBe(404);
    }
    expect(
      (await addReq(id, { kind: 'equipment', equipmentCategory: 'Y' }, 'labHeadB')).status,
    ).toBe(404);
    expect((await request(app).get('/api/v1/nd').set(auth('labHeadB'))).body.data).toEqual([]);
  });

  it('fayl: PDF yuklanadi (R2), DOCX — 415; yuklab olish havolasi', async () => {
    const id = await nd();
    const up = await request(app)
      .post(`/api/v1/nd/${id}/file`)
      .set(auth('labHead'))
      .attach('file', fixtures.pdf(), 'nd.pdf');
    expect(up.status).toBe(200);
    expect(up.body.data).toMatchObject({ hasFile: true, fileName: 'nd.pdf' });
    expect(
      (
        await request(app)
          .post(`/api/v1/nd/${id}/file`)
          .set(auth('labHead'))
          .attach('file', fixtures.docx(), 'nd.docx')
      ).status,
    ).toBe(415);
    const link = await request(app).get(`/api/v1/nd/${id}/file`).set(auth('chemist'));
    expect(link.status).toBe(200);
    expect(link.body.data.url).toBeTruthy();
  });

  it('o‘chirish: faqat draft', async () => {
    const id = await nd();
    await addReq(id, { kind: 'equipment', equipmentCategory: 'X' });
    await request(app).post(`/api/v1/nd/${id}/approve`).set(auth('labHead')).expect(200);
    expect((await request(app).delete(`/api/v1/nd/${id}`).set(auth('labHead'))).status).toBe(409);
    await request(app).post(`/api/v1/nd/${id}/revise`).set(auth('labHead')).expect(200);
    expect((await request(app).delete(`/api/v1/nd/${id}`).set(auth('labHead'))).status).toBe(204);
  });

  describe('moslik (feasibility) API', () => {
    async function lotRow(qty: number, unit: string, expires: string | null, status = 'approved') {
      await query(
        `INSERT INTO reagents (company_id, name, unit, quantity, expires_at, approval_status, approved_at, rejection_reason, reagent_item_id)
         VALUES ($1, 'Sulfat kislota', $2, $3, $4, $5::reagent_approval_status,
                 CASE WHEN $5 = 'pending' THEN NULL ELSE now() END,
                 CASE WHEN $5 = 'rejected' THEN 'Mos emas' ELSE NULL END, $6)`,
        [a.id, unit, qty, expires, status, itemSulfat],
      );
    }
    async function ready(): Promise<string> {
      const id = await nd();
      await addReq(id, {
        kind: 'equipment',
        methodName: 'Sulfated ash',
        equipmentCategory: 'Mufel pech',
      });
      await addReq(id, { ...sulfatReq, reagentItemId: itemSulfat });
      return id;
    }

    it('hammasi bor — canRun: true; n=5 da yetmasa aniq sabab (GET ?n va POST body)', async () => {
      const id = await ready();
      await query(
        `INSERT INTO equipment (company_id, name, category, calibration_due) VALUES ($1, 'Mufel-1', 'mufel  PECH', '2099-01-01')`,
        [a.id],
      );
      await lotRow(5, 'ml', '2099-01-01');
      await lotRow(0.004, 'l', null); // 4 ml
      const ok = await request(app).get(`/api/v1/nd/${id}/feasibility?n=4`).set(auth('chemist'));
      expect(ok.body.data).toMatchObject({ canRun: true, reasons: [], nAnalyses: 4 });
      expect(ok.body.data.reagents[0]).toMatchObject({ required: 8, available: 9, ok: true });

      const no = await request(app)
        .post(`/api/v1/nd/${id}/feasibility`)
        .set(auth('chemist'))
        .send({ nAnalyses: 5 });
      expect(no.body.data.canRun).toBe(false);
      expect(no.body.data.reasons).toEqual([
        expect.objectContaining({
          type: 'reagent_insufficient',
          data: expect.objectContaining({ required: 10, available: 9, missing: 1 }),
        }),
      ]);
    });

    it('apparat yo‘q, reaktiv yo‘q — ikkala sabab; talabsiz ND — no_requirements', async () => {
      const id = await ready();
      const res = await request(app).get(`/api/v1/nd/${id}/feasibility`).set(auth('labHead'));
      expect(res.body.data.canRun).toBe(false);
      expect(res.body.data.reasons.map((r: { type: string }) => r.type)).toEqual([
        'equipment_missing',
        'reagent_missing',
      ]);
      const empty = await nd('ND-EMPTY');
      expect(
        (await request(app).get(`/api/v1/nd/${empty}/feasibility`).set(auth('labHead'))).body.data
          .reasons[0].type,
      ).toBe('no_requirements');
    });

    it('apparat texnik xizmatda va kalibrlash o‘tgan; barcha lotlar muddati o‘tgan; pending lot sanalmaydi', async () => {
      const id = await ready();
      await query(
        `INSERT INTO equipment (company_id, name, category, status, calibration_due) VALUES
           ($1, 'M1', 'Mufel pech', 'maintenance', NULL), ($1, 'M2', 'Mufel pech', 'active', '2000-01-01')`,
        [a.id],
      );
      await lotRow(100, 'ml', '2000-01-01');
      await lotRow(100, 'ml', null, 'pending');
      const res = await request(app).get(`/api/v1/nd/${id}/feasibility`).set(auth('labHead'));
      expect(res.body.data.reasons.map((r: { type: string }) => r.type)).toEqual([
        'equipment_unavailable',
        'equipment_calibration_expired',
        'reagent_all_expired',
      ]);
    });

    it('n validatsiyasi: 0 va 101 — 400', async () => {
      const id = await ready();
      expect(
        (await request(app).get(`/api/v1/nd/${id}/feasibility?n=0`).set(auth('labHead'))).status,
      ).toBe(400);
      expect(
        (await request(app).get(`/api/v1/nd/${id}/feasibility?n=101`).set(auth('labHead'))).status,
      ).toBe(400);
    });
  });
});
