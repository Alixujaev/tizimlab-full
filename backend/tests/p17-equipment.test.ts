import type express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getPool, query } from '../src/config/database.js';
import { calibrationMessage, runCalibrationJob } from '../src/modules/equipment/equipment.job.js';
import { createEquipmentSchema } from '../src/modules/equipment/equipment.schemas.js';
import { setNotificationChannel } from '../src/modules/notifications/notifications.service.js';
import type { NotificationDto } from '../src/modules/notifications/notifications.types.js';
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

/** P17 / TZ §3.3 — apparatlar va kalibrlash ogohlantirishi (D-175). */

describe('equipment: unit', () => {
  it('sxema: nom va kategoriya majburiy, holat enum, sana mavjud bo‘lishi shart', () => {
    expect(createEquipmentSchema.safeParse({ name: 'HPLC-1', category: 'HPLC' }).data?.status).toBe(
      'active',
    );
    expect(createEquipmentSchema.safeParse({ name: '', category: 'HPLC' }).success).toBe(false);
    expect(
      createEquipmentSchema.safeParse({ name: 'A', category: 'B', status: 'broken' }).success,
    ).toBe(false);
    expect(
      createEquipmentSchema.safeParse({ name: 'A', category: 'B', calibrationDue: '2026-02-30' })
        .success,
    ).toBe(false);
  });
  it('xabar matni', () => {
    expect(calibrationMessage('Tarozi', '2026-07-01', 7)).toBe(
      'Tarozi — kalibrlash muddati: 01.07.2026 (7 kun qoldi)',
    );
    expect(calibrationMessage('Tarozi', '2026-07-01', 0)).toBe(
      'Tarozi — kalibrlash muddati bugun tugaydi (01.07.2026)',
    );
  });
});

const NOW = new Date('2026-06-15T10:00:00Z'); // Toshkent: 2026-06-15
const day = (o: number) => new Date(Date.UTC(2026, 5, 15 + o)).toISOString().slice(0, 10);

describeDb('equipment: API, rol, tenant, kalibrlash job', () => {
  let db: Awaited<ReturnType<typeof setupAuthDb>>;
  let app: express.Express;
  let a: TestCompany;
  let b: TestCompany;
  const users: Record<string, TestUser> = {};
  const tokens: Record<string, string> = {};
  let pushed: { userId: string; n: NotificationDto }[] = [];

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp().app;
    a = await createCompany({ name: 'Eq A' });
    b = await createCompany({ name: 'Eq B' });
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
  });
  afterAll(() => db.teardown());
  beforeEach(async () => {
    pushed = [];
    setNotificationChannel('t', (userId, n) => pushed.push({ userId, n }));
    await query('DELETE FROM equipment');
    await query('DELETE FROM notifications');
  });
  afterEach(() => setNotificationChannel('t', null));

  const auth = (w: string) => ({ Authorization: `Bearer ${tokens[w]}` });
  const create = (w: string, body: Record<string, unknown>) =>
    request(app).post('/api/v1/equipment').set(auth(w)).send(body);

  it('CRUD (lab_head/admin) + audit; holat va kalibrlash maydonlari DTO da', async () => {
    const res = await create('labHead', {
      name: 'Mufel pech',
      category: 'Mufel pech',
      model: 'SNOL 8.2',
      serialNumber: 'MP-01',
      location: 'Xona-3',
      calibrationDue: '2099-01-01',
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      status: 'active',
      isUsable: true,
      isCalibrationExpired: false,
      calibrationDue: '2099-01-01',
    });
    const id = res.body.data.id as string;

    const upd = await request(app)
      .put(`/api/v1/equipment/${id}`)
      .set(auth('admin'))
      .send({ status: 'maintenance' });
    expect(upd.body.data).toMatchObject({ status: 'maintenance', isUsable: false });

    const audit = await query<{ action: string }>(
      `SELECT action FROM audit_log WHERE table_name = 'equipment' AND record_id = $1 ORDER BY created_at`,
      [id],
    );
    expect(audit.rows.map((r) => r.action)).toEqual(['create', 'update']);

    expect((await request(app).delete(`/api/v1/equipment/${id}`).set(auth('labHead'))).status).toBe(
      204,
    );
    expect((await request(app).get(`/api/v1/equipment/${id}`).set(auth('labHead'))).status).toBe(
      404,
    );
  });

  it('kalibrlash o‘tgan apparat foydalanib bo‘lmaydi; bugun tugaydigani — hali yaroqli', async () => {
    const past = await create('labHead', {
      name: 'A',
      category: 'Tarozi',
      calibrationDue: '2000-01-01',
    });
    expect(past.body.data).toMatchObject({ isCalibrationExpired: true, isUsable: false });
    const { rows } = await query<{ d: string }>(
      `SELECT (now() AT TIME ZONE 'Asia/Tashkent')::date::text AS d`,
    );
    const today = await create('labHead', {
      name: 'B',
      category: 'Tarozi',
      calibrationDue: rows[0]!.d,
    });
    expect(today.body.data).toMatchObject({
      isCalibrationExpired: false,
      isCalibrationDueSoon: true,
      isUsable: true,
    });
  });

  it('rol: kontrolyor, chemist, director o‘qiydi, lekin yaratish/tahrirlash/o‘chirish — 403', async () => {
    const id = (await create('labHead', { name: 'pH-metr', category: 'pH metr' })).body.data
      .id as string;
    for (const w of ['kontrolyor', 'chemist', 'director']) {
      expect((await request(app).get('/api/v1/equipment').set(auth(w))).status).toBe(200);
      expect((await create(w, { name: 'X', category: 'Y' })).status).toBe(403);
      expect(
        (await request(app).put(`/api/v1/equipment/${id}`).set(auth(w)).send({ name: 'Z' })).status,
      ).toBe(403);
      expect((await request(app).delete(`/api/v1/equipment/${id}`).set(auth(w))).status).toBe(403);
    }
  });

  it('tenant: B kompaniyasi A apparatini ko‘rmaydi/o‘zgartirmaydi (404), ro‘yxatda yo‘q; seriya unikalligi kompaniya ichida', async () => {
    const id = (await create('labHead', { name: 'HPLC', category: 'HPLC', serialNumber: 'S-1' }))
      .body.data.id as string;
    expect((await request(app).get(`/api/v1/equipment/${id}`).set(auth('labHeadB'))).status).toBe(
      404,
    );
    expect(
      (await request(app).put(`/api/v1/equipment/${id}`).set(auth('labHeadB')).send({ name: 'x' }))
        .status,
    ).toBe(404);
    expect(
      (await request(app).delete(`/api/v1/equipment/${id}`).set(auth('labHeadB'))).status,
    ).toBe(404);
    expect((await request(app).get('/api/v1/equipment').set(auth('labHeadB'))).body.data).toEqual(
      [],
    );
    expect(
      (await create('labHeadB', { name: 'HPLC', category: 'HPLC', serialNumber: 'S-1' })).status,
    ).toBe(201);
    expect(
      (await create('labHead', { name: 'HPLC2', category: 'HPLC', serialNumber: 'S-1' })).status,
    ).toBe(409);
  });

  it('kategoriya normallashtiriladi: filtr va /categories', async () => {
    await create('labHead', { name: 'A', category: 'Mufel  pech' });
    await create('labHead', { name: 'B', category: 'mufel pech' });
    await create('labHead', { name: 'C', category: 'HPLC' });
    const list = await request(app)
      .get('/api/v1/equipment?category=MUFEL PECH')
      .set(auth('chemist'));
    expect(list.body.data.map((e: { name: string }) => e.name).sort()).toEqual(['A', 'B']);
    const cats = await request(app).get('/api/v1/equipment/categories').set(auth('kontrolyor'));
    expect(cats.body.data).toHaveLength(2);
  });

  describe('kalibrlash job (30/7/0, advisory lock, dublikatsiz)', () => {
    async function eq(company: TestCompany, name: string, due: string | null, status = 'active') {
      await query(
        `INSERT INTO equipment (company_id, name, category, status, calibration_due) VALUES ($1, $2, 'K', $3::equipment_status, $4)`,
        [company.id, name, status, due],
      );
    }
    const notices = async () =>
      (
        await query<{ name: string; threshold: number }>(
          `SELECT e.name, n.threshold FROM equipment_calibration_notices n JOIN equipment e ON e.id = n.equipment_id ORDER BY e.name`,
        )
      ).rows;

    it('chegaralar, out_of_service va uzoq muddatlilar xabarsiz; faqat lab_head (o‘z kompaniyasi)', async () => {
      await eq(a, 'd30', day(30));
      await eq(a, 'd31', day(31));
      await eq(a, 'd7', day(7));
      await eq(a, 'd0', day(0));
      await eq(a, 'dm2', day(-2));
      await eq(a, 'dm9', day(-9));
      await eq(a, 'off', day(3), 'out_of_service');
      await eq(a, 'maint', day(3), 'maintenance');
      await eq(b, 'bOne', day(7));
      const res = await runCalibrationJob({ now: NOW });
      expect(res).toEqual({ executed: true, reason: 'success', notified: 6 });
      expect(await notices()).toEqual([
        { name: 'bOne', threshold: 7 },
        { name: 'd0', threshold: 0 },
        { name: 'd30', threshold: 30 },
        { name: 'd7', threshold: 7 },
        { name: 'dm2', threshold: 0 },
        { name: 'maint', threshold: 7 },
      ]);
      const forA = pushed.filter((p) => p.n.message.startsWith('d7'));
      expect(forA.map((p) => p.userId)).toEqual([users.labHead!.id]);
      expect(forA[0]!.n.type).toBe('equipment_calibration_due');
      expect(pushed.find((p) => p.n.message.startsWith('bOne'))?.userId).toBe(users.labHeadB!.id);
    });

    it('idempotent va parallel — bir marta; muddat uzaytirilsa yangi sana uchun qayta', async () => {
      await eq(a, 'X', day(7));
      const r = await Promise.all([
        runCalibrationJob({ now: NOW }),
        runCalibrationJob({ now: NOW }),
      ]);
      expect(r.reduce((s, x) => s + x.notified, 0)).toBe(1);
      expect((await runCalibrationJob({ now: NOW })).notified).toBe(0);
      await query(`UPDATE equipment SET calibration_due = $1 WHERE name = 'X'`, [day(5)]);
      expect((await runCalibrationJob({ now: NOW })).notified).toBe(1);
    });

    it('advisory lock band bo‘lsa job hech narsa qilmaydi', async () => {
      await eq(a, 'L', day(1));
      const client = await getPool().connect();
      try {
        await client.query('BEGIN');
        await client.query(`SELECT pg_advisory_xact_lock(hashtext('equipment_calibration_job'))`);
        expect(await runCalibrationJob({ now: NOW })).toEqual({
          executed: false,
          reason: 'locked',
          notified: 0,
        });
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
    });
  });
});
