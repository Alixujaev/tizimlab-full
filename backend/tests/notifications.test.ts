import type express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { query, withTransaction } from '../src/config/database.js';
import {
  createNotification,
  setNotificationChannel,
} from '../src/modules/notifications/notifications.service.js';
import type { NotificationDto } from '../src/modules/notifications/notifications.types.js';
import { testApp } from './helpers/app.js';
import { createCompany, createUser, loginAs, setupAuthDb, type TestUser } from './helpers/auth.js';
import { describeDb } from './helpers/db.js';
import { fixtures, MemoryStorage } from './helpers/memoryStorage.js';

type Db = Awaited<ReturnType<typeof setupAuthDb>>;

describeDb('notifications: qabul qiluvchilar, tenant izolyatsiyasi, API (P6, D-13, D-59)', () => {
  let db: Db;
  let app: express.Express;
  const storage = new MemoryStorage();
  const tokens: Record<string, string> = {};
  const users: Record<string, TestUser> = {};
  /** Socket kanali o'rniga: COMMIT dan keyin push qilingan xabarnomalar. */
  let pushed: { userId: string; n: NotificationDto }[] = [];

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp({ storage }).app;
    const a = await createCompany({ name: 'Alpha Pharma' });
    const b = await createCompany({ name: 'Beta Pharma' });
    const specs: [string, TestUser['role'], typeof a, boolean?][] = [
      ['kontrolyor', 'kontrolyor', a],
      ['kontrolyor2', 'kontrolyor', a],
      ['chemist1', 'chemist', a],
      ['chemist2', 'chemist', a],
      ['labHead', 'lab_head', a],
      ['labHead2', 'lab_head', a],
      ['labHeadInactive', 'lab_head', a, false],
      ['director', 'director', a],
      ['admin', 'admin', a],
      ['labHeadB', 'lab_head', b],
      ['adminB', 'admin', b],
      ['chemistB', 'chemist', b],
    ];
    for (const [name, role, company, isActive] of specs) {
      users[name] = await createUser({ role, company, isActive: isActive ?? true });
      if (isActive !== false) tokens[name] = (await loginAs(app, users[name]!)).accessToken;
    }
  });

  afterAll(() => db.teardown());
  beforeEach(async () => {
    storage.reset();
    pushed = [];
    setNotificationChannel('test', (userId, n) => pushed.push({ userId, n }));
    await query('DELETE FROM notifications');
  });
  afterEach(() => setNotificationChannel('test', null));

  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const idOf = (who: string) => users[who]!.id;
  const nameOf = (id: string) => Object.keys(users).find((k) => users[k]!.id === id);

  /** Bazadagi xabarnomalar: `type` → qabul qiluvchilar nomlari (tartiblangan). */
  async function inbox(): Promise<Record<string, string[]>> {
    const { rows } = await query<{ type: string; user_id: string }>(
      'SELECT type::text AS type, user_id FROM notifications',
    );
    const out: Record<string, string[]> = {};
    for (const r of rows) (out[r.type] ??= []).push(nameOf(r.user_id) ?? r.user_id);
    for (const k of Object.keys(out)) out[k]!.sort();
    return out;
  }

  async function createSample(type = 'raw_material'): Promise<string> {
    const res = await request(app)
      .post('/api/v1/samples')
      .set(auth('kontrolyor'))
      .send({ type, substanceName: 'Paratsetamol', lotNumber: 'LOT-N-1' });
    expect(res.status).toBe(201);
    return res.body.data.id as string;
  }

  async function assign(sampleId: string, chemist = 'chemist1'): Promise<void> {
    const res = await request(app)
      .post(`/api/v1/samples/${sampleId}/assign`)
      .set(auth('labHead'))
      .send({ chemistId: idOf(chemist) });
    expect(res.status).toBe(200);
  }

  /** Namuna → biriktirish → asosiy fayl → submit; protokol id qaytariladi. */
  async function submittedProtocol(): Promise<{ sampleId: string; protocolId: string }> {
    const sampleId = await createSample();
    await assign(sampleId);
    const list = await request(app)
      .get(`/api/v1/protocols/sample/${sampleId}`)
      .set(auth('chemist1'));
    const protocolId = list.body.data[0].id as string;
    const up = await request(app)
      .post(`/api/v1/protocols/${protocolId}/file`)
      .set(auth('chemist1'))
      .attach('file', fixtures.pdf(), 'main.pdf');
    expect(up.status).toBe(200);
    const sub = await request(app)
      .post(`/api/v1/protocols/${protocolId}/submit`)
      .set(auth('chemist1'));
    expect(sub.status).toBe(200);
    return { sampleId, protocolId };
  }

  describe('1. Turlar va qabul qiluvchilar (D-13)', () => {
    it('sample_assigned — faqat biriktirilgan kimyogarga; biriktirgan lab_head ga emas (R-NOTIF-01, R-SAMPLE-17)', async () => {
      const sampleId = await createSample();
      await assign(sampleId);
      expect(await inbox()).toEqual({ sample_assigned: ['chemist1'] });
      const [p] = pushed;
      expect(p?.userId).toBe(idOf('chemist1'));
      expect(p?.n).toMatchObject({ type: 'sample_assigned', referenceId: sampleId, isRead: false });

      // Qayta biriktirish — yangi kimyogarga
      await assign(sampleId, 'chemist2');
      expect((await inbox()).sample_assigned).toEqual(['chemist1', 'chemist2']);
    });

    it('protocol_submitted — kompaniyaning barcha FAOL lab_head lariga; boshqa kompaniya/rollarga emas (R-NOTIF-04, R-PROTO-48)', async () => {
      await submittedProtocol();
      const box = await inbox();
      expect(box.protocol_submitted).toEqual(['labHead', 'labHead2']);
    });

    it('protocol_approved + sample_approved: kimyogar; sample_approved yaratgan kontrolyorga ham (R-NOTIF-02, R-NOTIF-05, R-PROTO-49)', async () => {
      const { protocolId } = await submittedProtocol();
      await query('DELETE FROM notifications');
      const res = await request(app)
        .post(`/api/v1/protocols/${protocolId}/approve`)
        .set(auth('labHead'));
      expect(res.status).toBe(200);
      expect(await inbox()).toEqual({
        protocol_approved: ['chemist1'],
        sample_approved: ['chemist1', 'kontrolyor'],
      });
    });

    it('protocol_rejected + sample_rejected: sabab xabarda; kontrolyor2 (yaratmagan) olmaydi (R-NOTIF-03, R-NOTIF-06, R-PROTO-50)', async () => {
      const { protocolId } = await submittedProtocol();
      await query('DELETE FROM notifications');
      const reason = 'Modda tarkibi talabga javob bermaydi';
      const res = await request(app)
        .post(`/api/v1/protocols/${protocolId}/reject`)
        .set(auth('labHead'))
        .send({ reason });
      expect(res.status).toBe(200);
      expect(await inbox()).toEqual({
        protocol_rejected: ['chemist1'],
        sample_rejected: ['chemist1', 'kontrolyor'],
      });
      const { rows } = await query<{ message: string }>('SELECT message FROM notifications');
      for (const r of rows) expect(r.message).toContain(reason);
    });

    it('in_process protokol tasdiqlansa sample_approved yuborilmaydi (namuna statusi o‘zgarmaydi, D-15)', async () => {
      const sampleId = await createSample('finished_product');
      await assign(sampleId);
      const created = await request(app)
        .post(`/api/v1/protocols/sample/${sampleId}/in-process`)
        .set(auth('chemist1'));
      expect(created.status).toBe(201);
      const protocolId = created.body.data.id as string;
      await request(app)
        .post(`/api/v1/protocols/${protocolId}/file`)
        .set(auth('chemist1'))
        .attach('file', fixtures.pdf(), 'p.pdf');
      await request(app).post(`/api/v1/protocols/${protocolId}/submit`).set(auth('chemist1'));
      await query('DELETE FROM notifications');
      await request(app).post(`/api/v1/protocols/${protocolId}/approve`).set(auth('labHead'));
      expect(await inbox()).toEqual({ protocol_approved: ['chemist1'] });
    });

    it('pasport orqali tasdiqlash — sample_approved yaratgan kontrolyorga (biriktirilmagan, D-13)', async () => {
      const res = await request(app)
        .post('/api/v1/samples')
        .set(auth('kontrolyor'))
        .send({ type: 'reagent', substanceName: 'Natriy xlorid', lotNumber: 'R-1' });
      const id = res.body.data.id as string;
      const up = await request(app)
        .post(`/api/v1/samples/${id}/passport`)
        .set(auth('kontrolyor'))
        .attach('file', fixtures.pdf(), 'pasport.pdf');
      expect(up.status).toBe(201);
      const rev = await request(app)
        .post(`/api/v1/samples/${id}/passport/review`)
        .set(auth('labHead'))
        .send({ decision: 'approve' });
      expect(rev.status).toBe(200);
      expect(await inbox()).toEqual({ sample_approved: ['kontrolyor'] });
    });

    it('temperature_alert / low_stock — lab_head + admin; stability_* — kimyogar + lab_head (D-04, D-13)', async () => {
      const company = users.labHead!.companyId!;
      await createNotification(db.pool, {
        companyId: company,
        actorId: null,
        type: 'low_stock',
        title: 't',
        message: 'm',
      });
      await createNotification(db.pool, {
        companyId: company,
        actorId: null,
        type: 'stability_overdue',
        title: 't',
        message: 'm',
        context: { assignedTo: idOf('chemist2') },
      });
      expect(await inbox()).toEqual({
        low_stock: ['admin', 'labHead', 'labHead2'],
        stability_overdue: ['chemist2', 'labHead', 'labHead2'],
      });
    });
  });

  describe('2. Harakat egasi, tenant izolyatsiyasi, tranzaksiya (D-13, D-12)', () => {
    it('harakat egasiga xabar yuborilmaydi, hatto u qabul qiluvchi rolida bo‘lsa ham (R-NOTIF-23)', async () => {
      await createNotification(db.pool, {
        companyId: users.admin!.companyId!,
        actorId: idOf('labHead'),
        type: 'temperature_alert',
        title: 't',
        message: 'm',
      });
      expect((await inbox()).temperature_alert).toEqual(['admin', 'labHead2']);
    });

    it('boshqa kompaniya foydalanuvchisi aniq ko‘rsatilsa ham olmaydi (R-NOTIF-24)', async () => {
      await createNotification(db.pool, {
        companyId: users.labHead!.companyId!,
        actorId: null,
        type: 'sample_approved',
        title: 't',
        message: 'm',
        context: { createdBy: idOf('chemistB'), assignedTo: idOf('chemist1') },
      });
      expect(await inbox()).toEqual({ sample_approved: ['chemist1'] });
      expect(pushed.map((p) => nameOf(p.userId))).toEqual(['chemist1']);
    });

    it('push faqat COMMIT dan keyin; ROLLBACK da xabar ham, push ham yo‘q (R-NOTIF-12, R-NOTIF-21)', async () => {
      const input = {
        companyId: users.labHead!.companyId!,
        actorId: null,
        type: 'low_stock' as const,
        title: 't',
        message: 'm',
      };
      await expect(
        withTransaction(async (tx) => {
          await createNotification(tx, input);
          expect(pushed).toHaveLength(0);
          throw new Error('rollback');
        }),
      ).rejects.toThrow('rollback');
      expect(pushed).toHaveLength(0);
      expect(await inbox()).toEqual({});

      await withTransaction(async (tx) => {
        await createNotification(tx, input);
        expect(pushed).toHaveLength(0);
      });
      expect(pushed.map((p) => nameOf(p.userId)).sort()).toEqual(['admin', 'labHead', 'labHead2']);
    });
  });

  describe('3. API: ro‘yxat, o‘qilmaganlar soni, o‘qildi belgisi (D-59)', () => {
    async function seed(who: string, count: number): Promise<void> {
      for (let i = 0; i < count; i++) {
        await query(
          `INSERT INTO notifications (company_id, user_id, type, title, message)
           VALUES ($1, $2, 'low_stock', $3, 'm')`,
          [users[who]!.companyId, idOf(who), `n${i}`],
        );
      }
    }

    it('faqat o‘z xabarnomalari, sahifalash va unread filtri (R-NOTIF-13)', async () => {
      await seed('labHead', 3);
      await seed('labHead2', 2);
      await seed('labHeadB', 4);
      const res = await request(app)
        .get('/api/v1/notifications?limit=2&page=1')
        .set(auth('labHead'));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toEqual({ page: 1, limit: 2, total: 3 });

      const all = await request(app).get('/api/v1/notifications').set(auth('labHead'));
      await request(app)
        .post(`/api/v1/notifications/${all.body.data[0].id}/read`)
        .set(auth('labHead'));
      const unread = await request(app)
        .get('/api/v1/notifications?unread=true')
        .set(auth('labHead'));
      expect(unread.body.meta.total).toBe(2);
      expect(unread.body.data.every((n: NotificationDto) => !n.isRead)).toBe(true);
    });

    it('unread-count, bittalab va hammasini o‘qish (R-NOTIF-25, R-NOTIF-26, R-NOTIF-27)', async () => {
      await seed('labHead', 3);
      await seed('labHead2', 1);
      const count = async (who: string) =>
        (await request(app).get('/api/v1/notifications/unread-count').set(auth(who))).body.data
          .count as number;
      expect(await count('labHead')).toBe(3);

      const list = await request(app).get('/api/v1/notifications').set(auth('labHead'));
      const one = await request(app)
        .post(`/api/v1/notifications/${list.body.data[0].id}/read`)
        .set(auth('labHead'));
      expect(one.status).toBe(200);
      expect(one.body.data.isRead).toBe(true);
      expect(await count('labHead')).toBe(2);

      const all = await request(app).post('/api/v1/notifications/read-all').set(auth('labHead'));
      expect(all.body.data).toEqual({ updated: 2 });
      expect(await count('labHead')).toBe(0);
      // Boshqa foydalanuvchiniki tegilmagan
      expect(await count('labHead2')).toBe(1);
    });

    it('boshqaning yoki boshqa kompaniyaning xabarnomasini belgilab bo‘lmaydi (404); noto‘g‘ri id 400', async () => {
      await seed('labHead2', 1);
      const { rows } = await query<{ id: string }>('SELECT id FROM notifications');
      const id = rows[0]!.id;
      expect(
        (await request(app).post(`/api/v1/notifications/${id}/read`).set(auth('labHead'))).status,
      ).toBe(404);
      expect(
        (await request(app).post(`/api/v1/notifications/${id}/read`).set(auth('labHeadB'))).status,
      ).toBe(404);
      expect(
        (await request(app).post('/api/v1/notifications/abc/read').set(auth('labHead'))).status,
      ).toBe(400);
      const still = await query<{ is_read: boolean }>('SELECT is_read FROM notifications');
      expect(still.rows[0]!.is_read).toBe(false);
    });

    it('o‘chirish endpointi yo‘q (R-NOTIF-28); tokensiz 401', async () => {
      await seed('labHead', 1);
      const { rows } = await query<{ id: string }>('SELECT id FROM notifications');
      expect(
        (await request(app).delete(`/api/v1/notifications/${rows[0]!.id}`).set(auth('labHead')))
          .status,
      ).toBe(404);
      expect((await request(app).get('/api/v1/notifications')).status).toBe(401);
    });
  });
});
