import type express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { query } from '../src/config/database.js';
import { registryListQuerySchema } from '../src/modules/registry/registry.schemas.js';
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

/** P16 / TZ §3.5 — audit qidiruvi: nom, seriya, sana oralig'i va kimyogar (D-172, R-P16-19..21). */

describe('registryListQuerySchema.chemistId', () => {
  it('UUID bo‘lishi shart; bo‘sh — ixtiyoriy', () => {
    expect(registryListQuerySchema.safeParse({}).success).toBe(true);
    expect(
      registryListQuerySchema.safeParse({ chemistId: '00000000-0000-4000-8000-000000000001' })
        .success,
    ).toBe(true);
    expect(registryListQuerySchema.safeParse({ chemistId: 'abc' }).success).toBe(false);
  });
});

describeDb('registry: kimyogar bo‘yicha qidiruv', () => {
  let db: Awaited<ReturnType<typeof setupAuthDb>>;
  let app: express.Express;
  let a: TestCompany;
  let b: TestCompany;
  const users: Record<string, TestUser> = {};
  const tokens: Record<string, string> = {};

  async function approvedSample(opts: {
    company: TestCompany;
    creator: TestUser;
    chemist: TestUser | null;
    name: string;
    serial: string;
    approvedAt: string;
    status?: string;
  }): Promise<string> {
    const { rows } = await query<{ id: string }>(
      `INSERT INTO samples (company_id, type, status, substance_name, serial_number, lot_number, created_by, assigned_to)
       VALUES ($1, 'raw_material', $2, $3, $4, 'LOT-1', $5, $6) RETURNING id`,
      [
        opts.company.id,
        opts.status ?? 'approved',
        opts.name,
        opts.serial,
        opts.creator.id,
        opts.chemist?.id ?? null,
      ],
    );
    await query(
      `INSERT INTO sample_tracking (company_id, sample_id, event_type, user_id, from_status, to_status, created_at)
       VALUES ($1, $2, 'approved', $3, 'submitted', 'approved', $4)`,
      [opts.company.id, rows[0]!.id, opts.creator.id, opts.approvedAt],
    );
    return rows[0]!.id;
  }

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp().app;
    a = await createCompany({ name: 'Search A' });
    b = await createCompany({ name: 'Search B' });
    for (const [name, role, company] of [
      ['kontrolyor', 'kontrolyor', a],
      ['chemist1', 'chemist', a],
      ['chemist2', 'chemist', a],
      ['chemistOff', 'chemist', a],
      ['director', 'director', a],
      ['kontrolyorB', 'kontrolyor', b],
      ['chemistB', 'chemist', b],
    ] as const) {
      users[name] = await createUser({ role, company });
      tokens[name] = (await loginAs(app, users[name]!)).accessToken;
    }
    users.superAdmin = await createUser({ role: 'super_admin' });
    tokens.superAdmin = (await loginAs(app, users.superAdmin)).accessToken;
    await query(`UPDATE users SET is_active = false, full_name = 'Zz Nofaol' WHERE id = $1`, [
      users.chemistOff!.id,
    ]);
    await query(`UPDATE users SET full_name = 'Aziz Karimov' WHERE id = $1`, [users.chemist1!.id]);

    const k = users.kontrolyor!;
    await approvedSample({
      company: a,
      creator: k,
      chemist: users.chemist1!,
      name: 'Ibuprofen',
      serial: 'S-1',
      approvedAt: '2026-03-01T10:00:00Z',
    });
    await approvedSample({
      company: a,
      creator: k,
      chemist: users.chemist1!,
      name: 'Paratsetamol',
      serial: 'S-2',
      approvedAt: '2026-04-01T10:00:00Z',
    });
    await approvedSample({
      company: a,
      creator: k,
      chemist: users.chemist2!,
      name: 'Ibuprofen',
      serial: 'S-3',
      approvedAt: '2026-03-15T10:00:00Z',
    });
    await approvedSample({
      company: a,
      creator: k,
      chemist: users.chemistOff!,
      name: 'Aspirin',
      serial: 'S-4',
      approvedAt: '2026-02-01T10:00:00Z',
    });
    // Tasdiqlanmagan — reyestrda yo'q
    await approvedSample({
      company: a,
      creator: k,
      chemist: users.chemist1!,
      name: 'Ibuprofen',
      serial: 'S-5',
      approvedAt: '2026-03-02T10:00:00Z',
      status: 'in_progress',
    });
    await approvedSample({
      company: b,
      creator: users.kontrolyorB!,
      chemist: users.chemistB!,
      name: 'Ibuprofen',
      serial: 'S-B',
      approvedAt: '2026-03-01T10:00:00Z',
    });
  });
  afterAll(() => db.teardown());

  const get = (who: string, qs: string) =>
    request(app).get(`/api/v1/registry${qs}`).set('Authorization', `Bearer ${tokens[who]}`);
  const serials = (res: request.Response) =>
    (res.body.data as { serialNumber: string }[]).map((r) => r.serialNumber).sort();

  it('R-P16-19: kimyogar bo‘yicha filtr va kimyogar ismi javobda', async () => {
    const res = await get('kontrolyor', `?chemistId=${users.chemist1!.id}`);
    expect(res.status).toBe(200);
    expect(serials(res)).toEqual(['S-1', 'S-2']);
    expect(res.body.data[0].assignedToName).toBe('Aziz Karimov');
    expect(res.body.meta.total).toBe(2);
  });

  it('R-P16-19: kimyogar + nom + sana oralig‘i birgalikda (AND), sahifalash meta to‘g‘ri', async () => {
    const res = await get(
      'director',
      `?chemistId=${users.chemist1!.id}&substanceName=ibu&approvedFrom=2026-03-01&approvedTo=2026-03-31`,
    );
    expect(serials(res)).toEqual(['S-1']);

    const page = await get('director', `?substanceName=ibuprofen&limit=1&page=2`);
    expect(page.body.meta).toEqual({ page: 2, limit: 1, total: 2 });
    expect(page.body.data).toHaveLength(1);
    const bySerial = await get('director', `?serialNumber=s-3&chemistId=${users.chemist2!.id}`);
    expect(serials(bySerial)).toEqual(['S-3']);
  });

  it('tenant: boshqa kompaniya kimyogari bilan filtr — bo‘sh (ma’lumot oqmaydi)', async () => {
    const res = await get('kontrolyor', `?chemistId=${users.chemistB!.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it('noto‘g‘ri chemistId — 400', async () => {
    expect((await get('kontrolyor', '?chemistId=not-a-uuid')).status).toBe(400);
  });

  it('R-P16-20: GET /registry/chemists — barcha kompaniya rollari, faqat o‘z kompaniyasi, faollar oldin', async () => {
    for (const who of ['kontrolyor', 'chemist1', 'director']) {
      const res = await request(app)
        .get('/api/v1/registry/chemists')
        .set('Authorization', `Bearer ${tokens[who]}`);
      expect(res.status).toBe(200);
      const ids = (res.body.data as { id: string }[]).map((c) => c.id);
      expect(ids).toHaveLength(3);
      expect(ids).not.toContain(users.chemistB!.id);
      expect(res.body.data.at(-1)).toMatchObject({ id: users.chemistOff!.id, isActive: false });
    }
  });

  it('rol: super_admin reyestr qidiruvi va kimyogarlar ro‘yxatiga kira olmaydi (403)', async () => {
    expect((await get('superAdmin', `?chemistId=${users.chemist1!.id}`)).status).toBe(403);
    const res = await request(app)
      .get('/api/v1/registry/chemists')
      .set('Authorization', `Bearer ${tokens.superAdmin}`);
    expect(res.status).toBe(403);
    expect((await request(app).get('/api/v1/registry/chemists')).status).toBe(401);
  });

  it('R-P16-21: 019 indekslari mavjud', async () => {
    const { rows } = await query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'samples' AND indexname LIKE 'idx_samples_registry_%'`,
    );
    expect(rows.map((r) => r.indexname).sort()).toEqual([
      'idx_samples_registry_assignee',
      'idx_samples_registry_lot',
      'idx_samples_registry_name',
      'idx_samples_registry_serial',
    ]);
  });
});
