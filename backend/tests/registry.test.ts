import type express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { query } from '../src/config/database.js';
import { registryHooks } from '../src/modules/registry/registry.hooks.js';
import { AppError } from '../src/utils/errors.js';
import type { SampleType } from '../src/modules/samples/samples.types.js';
import { testApp } from './helpers/app.js';
import { createCompany, createUser, loginAs, setupAuthDb, type TestUser } from './helpers/auth.js';
import { describeDb } from './helpers/db.js';
import { fixtures, MemoryStorage } from './helpers/memoryStorage.js';

type Db = Awaited<ReturnType<typeof setupAuthDb>>;

describeDb('registry: reyestr (R-REG-*, R-ROLE-38..42, R-FE-26/27 backend)', () => {
  let db: Db;
  let app: express.Express;
  const storage = new MemoryStorage();
  const tokens: Record<string, string> = {};
  const users: Record<string, TestUser> = {};
  let companyAId: string;
  let companyBId: string;
  const ids: Record<string, string> = {};

  async function insertSample(opts: {
    type: SampleType;
    status?: string;
    substance?: string;
    serial?: string | null;
    lot?: string | null;
    approvedAt?: string;
    company?: string;
    deleted?: boolean;
  }): Promise<string> {
    const company = opts.company ?? companyAId;
    const creator = company === companyAId ? users.kontrolyor!.id : users.kontrolyorB!.id;
    const { rows } = await query<{ id: string }>(
      `INSERT INTO samples (company_id, type, status, substance_name, serial_number, lot_number, created_by, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        company,
        opts.type,
        opts.status ?? 'approved',
        opts.substance ?? 'Paratsetamol',
        opts.serial ?? null,
        opts.lot ?? null,
        creator,
        opts.deleted ? new Date().toISOString() : null,
      ],
    );
    const id = rows[0]!.id;
    if (opts.approvedAt) {
      await query(
        `INSERT INTO sample_tracking (company_id, sample_id, event_type, user_id, from_status, to_status, created_at)
         VALUES ($1, $2, 'approved', $3, 'submitted', 'approved', $4)`,
        [company, id, creator, opts.approvedAt],
      );
    }
    return id;
  }

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp({ storage }).app;
    const a = await createCompany({ name: 'Pharm Alpha' });
    const b = await createCompany({ name: 'Pharm Beta' });
    companyAId = a.id;
    companyBId = b.id;
    for (const [name, role, company] of [
      ['kontrolyor', 'kontrolyor', a],
      ['kontrolyor2', 'kontrolyor', a],
      ['chemist', 'chemist', a],
      ['labHead', 'lab_head', a],
      ['director', 'director', a],
      ['admin', 'admin', a],
      ['kontrolyorB', 'kontrolyor', b],
      ['labHeadB', 'lab_head', b],
    ] as const) {
      users[name] = await createUser({ role, company });
      tokens[name] = (await loginAs(app, users[name]!)).accessToken;
    }
    users.superAdmin = await createUser({ role: 'super_admin' });
    tokens.superAdmin = (await loginAs(app, users.superAdmin)).accessToken;

    ids.raw = await insertSample({
      type: 'raw_material',
      substance: 'Ibuprofen',
      serial: 'SER-100',
      lot: 'LOT-A1',
      approvedAt: '2026-03-10T10:00:00Z',
    });
    ids.finished = await insertSample({
      type: 'finished_product',
      substance: 'Paratsetamol 500',
      serial: 'SER-200',
      lot: 'LOT-B2',
      approvedAt: '2026-04-15T10:00:00Z',
    });
    ids.other = await insertSample({
      type: 'other',
      substance: 'Aspirin',
      serial: 'SER-300',
      lot: 'LOT-A3',
      approvedAt: '2026-05-20T10:00:00Z',
    });
    ids.pendingSample = await insertSample({
      type: 'raw_material',
      status: 'in_progress',
      substance: 'Ibuprofen',
    });
    ids.deleted = await insertSample({
      type: 'raw_material',
      substance: 'Ibuprofen',
      approvedAt: '2026-03-11T10:00:00Z',
      deleted: true,
    });
    ids.otherCompany = await insertSample({
      type: 'raw_material',
      substance: 'Ibuprofen',
      approvedAt: '2026-03-12T10:00:00Z',
      company: companyBId,
    });

    // Pasport orqali tasdiqlangan reagent — haqiqiy oqim bilan
    const { rows } = await query<{ id: string }>(
      `INSERT INTO samples (company_id, type, substance_name, lot_number, created_by)
       VALUES ($1, 'reagent', 'Natriy xlorid', 'LOT-R1', $2) RETURNING id`,
      [companyAId, users.kontrolyor!.id],
    );
    ids.reagent = rows[0]!.id;
    const up = await request(app)
      .post(`/api/v1/samples/${ids.reagent}/passport`)
      .set(auth('labHead'))
      .attach('file', fixtures.pdf(), 'pasport.pdf');
    expect(up.status).toBe(201);
  });
  afterAll(() => db.teardown());
  afterEach(() => vi.restoreAllMocks());

  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const list = (who: string, q: Record<string, string> = {}) =>
    request(app).get('/api/v1/registry').query(q).set(auth(who));
  const listIds = async (q: Record<string, string> = {}) => {
    const res = await list('labHead', q);
    expect(res.status).toBe(200);
    return (res.body.data as { id: string }[]).map((r) => r.id);
  };

  it('R-REG-01: faqat approved va o‘chirilmagan, o‘z kompaniyasi namunalari', async () => {
    const res = await list('labHead');
    expect(res.status).toBe(200);
    const got = (res.body.data as { id: string }[]).map((r) => r.id).sort();
    expect(got).toEqual([ids.raw, ids.finished, ids.other, ids.reagent].sort());
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20, total: 4 });
  });

  it.each(['kontrolyor', 'kontrolyor2', 'chemist', 'labHead', 'director', 'admin'])(
    'R-ROLE-38..42: %s reyestrni (boshqalar yaratgan namunalar bilan) ko‘radi',
    async (who) => {
      const res = await list(who);
      expect(res.status).toBe(200);
      expect(res.body.meta.total).toBe(4);
      expect((await request(app).get(`/api/v1/registry/${ids.raw}`).set(auth(who))).status).toBe(
        200,
      );
    },
  );

  it('super_admin reyestrga kira olmaydi (403)', async () => {
    expect((await list('superAdmin')).status).toBe(403);
  });

  it('R-REG-02..06: har filtr alohida', async () => {
    expect(await listIds({ type: 'finished_product' })).toEqual([ids.finished]);
    expect((await listIds({ substanceName: 'paratset' })).sort()).toEqual([ids.finished].sort());
    expect(await listIds({ serialNumber: 'ser-3' })).toEqual([ids.other]);
    expect((await listIds({ lotNumber: 'LOT-A' })).sort()).toEqual([ids.raw, ids.other].sort());
    expect(await listIds({ approvedFrom: '2026-05-20' })).toEqual(
      expect.arrayContaining([ids.other]),
    );
    expect(await listIds({ approvedFrom: '2026-05-20' })).not.toContain(ids.finished);
    expect(await listIds({ approvedTo: '2026-03-10' })).toEqual([ids.raw]);
  });

  it('R-REG-06: sana oralig‘i inklyuziv, birgalikdagi filtrlar', async () => {
    expect(
      (await listIds({ approvedFrom: '2026-03-10', approvedTo: '2026-04-15' })).sort(),
    ).toEqual([ids.raw, ids.finished].sort());
    expect(
      await listIds({ lotNumber: 'LOT-A', approvedFrom: '2026-04-01', type: 'other' }),
    ).toEqual([ids.other]);
    expect(await listIds({ lotNumber: 'LOT-A', type: 'finished_product' })).toEqual([]);
  });

  it('noto‘g‘ri sana / oraliq → 400', async () => {
    expect((await list('labHead', { approvedFrom: '10.03.2026' })).status).toBe(400);
    expect((await list('labHead', { approvedFrom: '2026-02-30' })).status).toBe(400);
    expect(
      (await list('labHead', { approvedFrom: '2026-05-01', approvedTo: '2026-04-01' })).status,
    ).toBe(400);
  });

  it('saralash approved_at kamayish bo‘yicha va pagination', async () => {
    const res = await list('labHead', { limit: '2', page: '2', type: 'raw_material' });
    expect(res.body.meta).toMatchObject({ page: 2, limit: 2, total: 1 });
    const all = await listIds({ approvedTo: '2026-12-31', serialNumber: 'SER' });
    expect(all).toEqual([ids.other, ids.finished, ids.raw]);
  });

  it('R-REG-07: tafsilot tracking bilan; approved emas/o‘chirilgan/boshqa kompaniya → 404', async () => {
    const res = await request(app).get(`/api/v1/registry/${ids.reagent}`).set(auth('chemist'));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: ids.reagent,
      status: 'approved',
      downloadKind: 'passport',
    });
    expect((res.body.data.tracking as { eventType: string }[]).map((t) => t.eventType)).toContain(
      'approved',
    );
    for (const id of [ids.pendingSample, ids.deleted, ids.otherCompany]) {
      expect((await request(app).get(`/api/v1/registry/${id}`).set(auth('labHead'))).status).toBe(
        404,
      );
    }
  });

  it('R-REG-08: yuklab olish — pasport → imzolangan URL; finished_product → protokol hook (hozir 404)', async () => {
    const res = await request(app)
      .get(`/api/v1/registry/${ids.reagent}/download`)
      .set(auth('kontrolyor2'));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ expiresIn: 300 });

    const hook = vi.spyOn(registryHooks, 'getFinalProtocolFile');
    const fin = await request(app)
      .get(`/api/v1/registry/${ids.finished}/download`)
      .set(auth('labHead'));
    expect(fin.status).toBe(404);
    expect(fin.body.error.code).toBe('FILE_NOT_FOUND');
    expect(hook).toHaveBeenCalledTimes(1);

    expect(
      (await request(app).get(`/api/v1/registry/${ids.raw}/download`).set(auth('labHead'))).status,
    ).toBe(404);
    expect(
      (await request(app).get(`/api/v1/registry/${ids.otherCompany}/download`).set(auth('labHead')))
        .status,
    ).toBe(404);
  });

  it('ro‘yxatda downloadKind va approvedAt', async () => {
    const rows = (await list('labHead')).body.data as {
      id: string;
      downloadKind: string | null;
      approvedAt: string;
    }[];
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId[ids.reagent!]!.downloadKind).toBe('passport');
    expect(byId[ids.finished!]!.downloadKind).toBe('protocol');
    expect(byId[ids.raw!]!.downloadKind).toBeNull();
    expect(new Date(byId[ids.raw!]!.approvedAt).toISOString()).toBe('2026-03-10T10:00:00.000Z');
  });

  it('R-REG-10: lab_head va admin dan boshqa rol o‘chira olmaydi', async () => {
    for (const who of ['kontrolyor', 'chemist', 'director']) {
      expect((await request(app).delete(`/api/v1/registry/${ids.raw}`).set(auth(who))).status).toBe(
        403,
      );
    }
    expect(
      (await request(app).delete(`/api/v1/registry/${ids.raw}`).set(auth('labHeadB'))).status,
    ).toBe(404);
  });

  it('R-REG-15 (hook): faol stabilizatsiya tekshiruvi chaqiriladi; xato bo‘lsa o‘chirish bekor', async () => {
    vi.spyOn(registryHooks, 'assertNoActiveStability').mockRejectedValueOnce(
      new AppError(409, 'ACTIVE_STABILITY', 'Faol stabilizatsiya bor'),
    );
    const res = await request(app).delete(`/api/v1/registry/${ids.other}`).set(auth('admin'));
    expect(res.status).toBe(409);
    expect(await listIds()).toContain(ids.other);
  });

  it('R-REG-09: soft-delete — ro‘yxatlardan yo‘qoladi, tracking va audit, fayllar saqlanadi', async () => {
    const hook = vi.spyOn(registryHooks, 'assertNoActiveStability');
    const res = await request(app).delete(`/api/v1/registry/${ids.reagent}`).set(auth('labHead'));
    expect(res.status).toBe(204);
    expect(hook).toHaveBeenCalledTimes(1);

    expect(await listIds()).not.toContain(ids.reagent);
    expect(
      (await request(app).get(`/api/v1/registry/${ids.reagent}`).set(auth('labHead'))).status,
    ).toBe(404);
    expect(
      (await request(app).get(`/api/v1/samples/${ids.reagent}`).set(auth('labHead'))).status,
    ).toBe(404);
    const samples = await request(app).get('/api/v1/samples').set(auth('labHead'));
    expect((samples.body.data as { id: string }[]).map((s) => s.id)).not.toContain(ids.reagent);

    const row = (
      await query<{ deleted_at: string | null; passport_file_path: string | null }>(
        'SELECT deleted_at, passport_file_path FROM samples WHERE id = $1',
        [ids.reagent],
      )
    ).rows[0]!;
    expect(row.deleted_at).not.toBeNull();
    expect(row.passport_file_path).not.toBeNull();
    expect((await query('SELECT 1 FROM files WHERE sample_id = $1', [ids.reagent])).rowCount).toBe(
      1,
    );
    expect(
      (
        await query(
          `SELECT 1 FROM sample_tracking WHERE sample_id = $1 AND event_type = 'deleted'`,
          [ids.reagent],
        )
      ).rowCount,
    ).toBe(1);
    expect(
      (
        await query(`SELECT 1 FROM audit_log WHERE record_id = $1 AND action = 'delete'`, [
          ids.reagent,
        ])
      ).rowCount,
    ).toBe(1);

    expect(
      (await request(app).delete(`/api/v1/registry/${ids.raw}`).set(auth('admin'))).status,
    ).toBe(204);
    expect(
      (await request(app).delete(`/api/v1/registry/${ids.raw}`).set(auth('admin'))).status,
    ).toBe(404);
  });

  it('R-REG-16: /registry da unfinalizedOnly filtri faqat yakunlanmagan protokollarni qaytaradi', async () => {
    // ids.finished uchun approved holatdagi protokol yaratamiz (finalized emas)
    const protoId = '00000000-0000-0000-0000-000000000001';
    await query(
      `INSERT INTO protocols (id, company_id, sample_id, created_by, status, protocol_role)
       VALUES ($1, $2, $3, $4, 'approved', 'final')
       ON CONFLICT (id) DO NOTHING`,
      [protoId, companyAId, ids.finished, users.labHead!.id],
    );

    const res = await request(app)
      .get('/api/v1/registry?unfinalizedOnly=true')
      .set(auth('director'));
    expect(res.status).toBe(200);
    const returnedIds = (res.body.data as { id: string }[]).map((s) => s.id);
    expect(returnedIds).toContain(ids.finished);

    // Protokolni finalized qilgach, unfinalizedOnly ro'yxatida chiqmaydi
    await query(`UPDATE protocols SET status = 'finalized' WHERE id = $1`, [protoId]);
    const resAfter = await request(app)
      .get('/api/v1/registry?unfinalizedOnly=true')
      .set(auth('director'));
    expect(resAfter.status).toBe(200);
    const returnedAfterIds = (resAfter.body.data as { id: string }[]).map((s) => s.id);
    expect(returnedAfterIds).not.toContain(ids.finished);
  });
});
