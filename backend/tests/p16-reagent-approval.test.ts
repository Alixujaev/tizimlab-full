import type express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { query } from '../src/config/database.js';
import { roleHasPermission } from '../src/config/permissions.js';
import {
  recipientRule,
  setNotificationChannel,
} from '../src/modules/notifications/notifications.service.js';
import type { NotificationDto } from '../src/modules/notifications/notifications.types.js';
import { reviewReagentSchema } from '../src/modules/reagents/reagents.schemas.js';
import { testApp } from './helpers/app.js';
import { createCompany, createUser, loginAs, setupAuthDb, type TestUser } from './helpers/auth.js';
import { describeDb } from './helpers/db.js';

/** P16 / TZ §3.2 — reaktivni tasdiqlash oqimi (D-169, R-P16-04..08). */

describe('reaktiv tasdiqlash: unit', () => {
  it('ruxsat katalogi: reagents:approve faqat chemist va lab_head da', () => {
    expect(roleHasPermission('chemist', 'reagents:approve')).toBe(true);
    expect(roleHasPermission('lab_head', 'reagents:approve')).toBe(true);
    for (const r of ['kontrolyor', 'director', 'admin', 'super_admin'] as const) {
      expect(roleHasPermission(r, 'reagents:approve')).toBe(false);
    }
  });

  it('rad etish sababi: 4 belgi — rad, 5 belgi — qabul (bo‘shliqlar hisobga olinmaydi)', () => {
    expect(reviewReagentSchema.safeParse({ reason: 'abcd' }).success).toBe(false);
    expect(reviewReagentSchema.safeParse({ reason: '  abcd  ' }).success).toBe(false);
    expect(reviewReagentSchema.safeParse({ reason: 'abcde' }).success).toBe(true);
    expect(reviewReagentSchema.safeParse({}).success).toBe(false);
  });

  it('qabul qiluvchilar: pending → chemist+lab_head, qaror → kiritgan shaxs', () => {
    expect(recipientRule('reagent_pending_approval')).toEqual({
      users: [],
      roles: ['chemist', 'lab_head'],
    });
    expect(recipientRule('reagent_approved', { createdBy: 'u1' })).toEqual({
      users: ['u1'],
      roles: [],
    });
    expect(recipientRule('reagent_rejected', { createdBy: 'u1' })).toEqual({
      users: ['u1'],
      roles: [],
    });
  });
});

describeDb('reaktiv tasdiqlash: API, rol, tenant, holat', () => {
  let db: Awaited<ReturnType<typeof setupAuthDb>>;
  let app: express.Express;
  const tokens: Record<string, string> = {};
  const users: Record<string, TestUser> = {};
  let pushed: { userId: string; n: NotificationDto }[] = [];

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp().app;
    const a = await createCompany({ name: 'P16 Reagent A' });
    const b = await createCompany({ name: 'P16 Reagent B' });
    const specs: [string, TestUser['role'], typeof a][] = [
      ['admin', 'admin', a],
      ['labHead', 'lab_head', a],
      ['labHead2', 'lab_head', a],
      ['chemist', 'chemist', a],
      ['kontrolyor', 'kontrolyor', a],
      ['director', 'director', a],
      ['chemistB', 'chemist', b],
    ];
    for (const [name, role, company] of specs) {
      users[name] = await createUser({ role, company });
      tokens[name] = (await loginAs(app, users[name]!)).accessToken;
    }
  });

  afterAll(() => db.teardown());

  beforeEach(async () => {
    pushed = [];
    setNotificationChannel('test', (userId, n) => pushed.push({ userId, n }));
    await query('DELETE FROM reagent_transactions');
    await query('DELETE FROM reagents');
    await query('DELETE FROM notifications');
  });
  afterEach(() => setNotificationChannel('test', null));

  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  async function create(who = 'labHead', body: Record<string, unknown> = {}): Promise<string> {
    const res = await request(app)
      .post('/api/v1/reagents')
      .set(auth(who))
      .send({ name: 'Sulfat kislota', unit: 'ml', quantity: 100, ...body });
    expect(res.status).toBe(201);
    return res.body.data.id as string;
  }

  it('R-P16-04: yangi reaktiv pending, created_by saqlanadi; mavjud qatorlar default bo‘yicha DB da ham pending', async () => {
    const id = await create();
    const { rows } = await query<{ approval_status: string; created_by: string }>(
      'SELECT approval_status, created_by FROM reagents WHERE id = $1',
      [id],
    );
    expect(rows[0]).toEqual({ approval_status: 'pending', created_by: users.labHead!.id });

    const dto = await request(app).get(`/api/v1/reagents/${id}`).set(auth('chemist'));
    expect(dto.body.data).toMatchObject({
      approvalStatus: 'pending',
      createdBy: users.labHead!.id,
      approvedAt: null,
    });
  });

  it('R-P16-05: yaratilganda chemist va boshqa lab_head ga xabar; kirituvchiga va boshqa rollarga emas', async () => {
    await create('labHead');
    const recipients = pushed
      .filter((p) => p.n.type === 'reagent_pending_approval')
      .map((p) => p.userId);
    expect(new Set(recipients)).toEqual(new Set([users.chemist!.id, users.labHead2!.id]));
  });

  it('R-P16-06: chemist tasdiqlaydi → approved, approved_by/at, audit va kirituvchiga xabar', async () => {
    const id = await create('labHead');
    pushed = [];
    const res = await request(app).post(`/api/v1/reagents/${id}/approve`).set(auth('chemist'));
    expect(res.status).toBe(200);
    expect(res.body.data.approvalStatus).toBe('approved');
    expect(res.body.data.approvedBy).toBe(users.chemist!.id);
    expect(res.body.data.approvedAt).not.toBeNull();

    const audit = await query<{ old_values: unknown; new_values: unknown }>(
      `SELECT old_values, new_values FROM audit_log WHERE table_name = 'reagents' AND record_id = $1 AND action = 'status_change'`,
      [id],
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]!.old_values).toMatchObject({ approval_status: 'pending' });
    expect(audit.rows[0]!.new_values).toMatchObject({ approval_status: 'approved' });

    expect(pushed.filter((p) => p.n.type === 'reagent_approved').map((p) => p.userId)).toEqual([
      users.labHead!.id,
    ]);
  });

  it('R-P16-06: rad etish sababi bilan → rejected, sabab saqlanadi; sababsiz yoki 4 belgi — 400', async () => {
    const id = await create('labHead');
    const bad = await request(app)
      .post(`/api/v1/reagents/${id}/reject`)
      .set(auth('chemist'))
      .send({ reason: 'yoq' });
    expect(bad.status).toBe(400);
    const none = await request(app)
      .post(`/api/v1/reagents/${id}/reject`)
      .set(auth('chemist'))
      .send({});
    expect(none.status).toBe(400);

    const ok = await request(app)
      .post(`/api/v1/reagents/${id}/reject`)
      .set(auth('chemist'))
      .send({ reason: 'Sertifikat mos emas' });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({
      approvalStatus: 'rejected',
      rejectionReason: 'Sertifikat mos emas',
    });
    const n = pushed.find((p) => p.n.type === 'reagent_rejected');
    expect(n?.userId).toBe(users.labHead!.id);
    expect(n?.n.message).toContain('Sertifikat mos emas');
  });

  it('R-P16-07: rol — kontrolyor, director, admin 403; individual grant bilan ham admin/director 403', async () => {
    const id = await create('labHead');
    for (const who of ['kontrolyor', 'director', 'admin']) {
      const res = await request(app).post(`/api/v1/reagents/${id}/approve`).set(auth(who));
      expect(res.status).toBe(403);
      const rej = await request(app)
        .post(`/api/v1/reagents/${id}/reject`)
        .set(auth(who))
        .send({ reason: 'Sabab yetarli' });
      expect(rej.status).toBe(403);
    }
    const grant = await request(app)
      .put(`/api/v1/admin/users/${users.director!.id}/permissions`)
      .set(auth('admin'))
      .send({ permissions: ['reagents:approve'] });
    expect(grant.status).toBe(200);
    const withGrant = await request(app)
      .post(`/api/v1/reagents/${id}/approve`)
      .set(auth('director'));
    expect(withGrant.status).toBe(403);
    const still = await query<{ approval_status: string }>(
      'SELECT approval_status FROM reagents WHERE id = $1',
      [id],
    );
    expect(still.rows[0]!.approval_status).toBe('pending');
  });

  it('R-P16-07: o‘zi kiritgan reaktivni o‘zi tasdiqlay olmaydi (403 SELF_REVIEW_FORBIDDEN), boshqa lab_head — mumkin', async () => {
    const id = await create('labHead');
    const self = await request(app).post(`/api/v1/reagents/${id}/approve`).set(auth('labHead'));
    expect(self.status).toBe(403);
    expect(self.body.error.code).toBe('SELF_REVIEW_FORBIDDEN');
    const other = await request(app).post(`/api/v1/reagents/${id}/approve`).set(auth('labHead2'));
    expect(other.status).toBe(200);
  });

  it('holat: takroriy qaror 409; parallel approve + reject dan faqat bittasi o‘tadi', async () => {
    const id = await create('labHead');
    expect(
      (await request(app).post(`/api/v1/reagents/${id}/approve`).set(auth('chemist'))).status,
    ).toBe(200);
    const again = await request(app).post(`/api/v1/reagents/${id}/approve`).set(auth('chemist'));
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('REAGENT_ALREADY_REVIEWED');

    const id2 = await create('labHead');
    const results = await Promise.all([
      request(app).post(`/api/v1/reagents/${id2}/approve`).set(auth('chemist')),
      request(app)
        .post(`/api/v1/reagents/${id2}/reject`)
        .set(auth('labHead2'))
        .send({ reason: 'Mos kelmaydi' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it('R-P16-08: pending va rejected reaktivdan sarf (out) 409, qoldiq o‘zgarmaydi; in/disposal mumkin; approved — out ishlaydi', async () => {
    const id = await create('labHead');
    const out1 = await request(app)
      .post(`/api/v1/reagents/${id}/transactions`)
      .set(auth('labHead'))
      .send({ type: 'out', quantity: 2, analysisPurpose: 'Sulfated ash' });
    expect(out1.status).toBe(409);
    expect(out1.body.error.code).toBe('REAGENT_NOT_APPROVED');
    const qty = await query<{ quantity: string }>('SELECT quantity FROM reagents WHERE id = $1', [
      id,
    ]);
    expect(Number(qty.rows[0]!.quantity)).toBe(100);

    expect(
      (
        await request(app)
          .post(`/api/v1/reagents/${id}/transactions`)
          .set(auth('labHead'))
          .send({ type: 'in', quantity: 5 })
      ).status,
    ).toBe(201);
    expect(
      (
        await request(app)
          .post(`/api/v1/reagents/${id}/transactions`)
          .set(auth('labHead'))
          .send({ type: 'disposal', quantity: 1 })
      ).status,
    ).toBe(201);

    const rejectedId = await create('labHead');
    await request(app)
      .post(`/api/v1/reagents/${rejectedId}/reject`)
      .set(auth('chemist'))
      .send({ reason: 'Muddati o‘tgan' });
    const out2 = await request(app)
      .post(`/api/v1/reagents/${rejectedId}/transactions`)
      .set(auth('labHead'))
      .send({ type: 'out', quantity: 1 });
    expect(out2.status).toBe(409);

    await request(app).post(`/api/v1/reagents/${id}/approve`).set(auth('chemist'));
    const out3 = await request(app)
      .post(`/api/v1/reagents/${id}/transactions`)
      .set(auth('labHead'))
      .send({ type: 'out', quantity: 2 });
    expect(out3.status).toBe(201);
    expect(out3.body.data.quantityAfter).toBe(102);
  });

  it('tenant: B kompaniyasi kimyogari A reaktivini tasdiqlay olmaydi (404), holat o‘zgarmaydi', async () => {
    const id = await create('labHead');
    const res = await request(app).post(`/api/v1/reagents/${id}/approve`).set(auth('chemistB'));
    expect(res.status).toBe(404);
    const { rows } = await query<{ approval_status: string }>(
      'SELECT approval_status FROM reagents WHERE id = $1',
      [id],
    );
    expect(rows[0]!.approval_status).toBe('pending');
    expect(pushed.some((p) => p.userId === users.chemistB!.id)).toBe(false);
  });

  it('ro‘yxat filtri approvalStatus va noto‘g‘ri qiymat — 400', async () => {
    const a = await create('labHead', { name: 'A-reaktiv' });
    await create('labHead', { name: 'B-reaktiv' });
    await request(app).post(`/api/v1/reagents/${a}/approve`).set(auth('chemist'));

    const pending = await request(app)
      .get('/api/v1/reagents?approvalStatus=pending')
      .set(auth('chemist'));
    expect(pending.status, JSON.stringify(pending.body)).toBe(200);
    // Boshqa filtr bilan birga ham parametr raqamlari to'g'ri (is_hazardous + approval_status)
    const combo = await request(app)
      .get('/api/v1/reagents?isHazardous=false&approvalStatus=approved')
      .set(auth('chemist'));
    expect(combo.status).toBe(200);
    expect(combo.body.data.map((r: { name: string }) => r.name)).toEqual(['A-reaktiv']);
    expect(pending.body.data.map((r: { name: string }) => r.name)).toEqual(['B-reaktiv']);
    const approved = await request(app)
      .get('/api/v1/reagents?approvalStatus=approved')
      .set(auth('chemist'));
    expect(approved.body.data.map((r: { name: string }) => r.name)).toEqual(['A-reaktiv']);
    const bad = await request(app)
      .get('/api/v1/reagents?approvalStatus=maybe')
      .set(auth('chemist'));
    expect(bad.status).toBe(400);
  });

  it('DB CHECK: rejected holatda sabab majburiy', async () => {
    const id = await create('labHead');
    await expect(
      query(`UPDATE reagents SET approval_status = 'rejected', approved_at = now() WHERE id = $1`, [
        id,
      ]),
    ).rejects.toThrow(/reagents_rejection_reason_check/);
  });
});
