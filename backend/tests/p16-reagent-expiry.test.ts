import type express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getPool, query } from '../src/config/database.js';
import { setNotificationChannel } from '../src/modules/notifications/notifications.service.js';
import type { NotificationDto } from '../src/modules/notifications/notifications.types.js';
import {
  EXPIRED_CATCHUP_DAYS,
  expiryMessage,
  expiryThresholdFor,
  runReagentExpiryJob,
} from '../src/modules/reagents/reagents.job.js';
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

/** P16 / TZ §3.2 — reaktiv muddati ogohlantirishi (D-170, R-P16-09..12). */

describe('expiryThresholdFor: chegaralar (off-by-one)', () => {
  it.each([
    [31, null],
    [30, 30],
    [8, 30],
    [7, 7],
    [1, 7],
    [0, 0],
    [-1, 0],
    [-EXPIRED_CATCHUP_DAYS, 0],
    [-EXPIRED_CATCHUP_DAYS - 1, null],
  ])('%i kun qoldi → %s', (days, expected) => {
    expect(expiryThresholdFor(days)).toBe(expected);
  });

  it('xabar matni: qolgan kun, bugun, o‘tgan', () => {
    expect(expiryMessage('HCl', '2026-07-01', 5)).toBe('HCl — muddat: 01.07.2026 (5 kun qoldi)');
    expect(expiryMessage('HCl', '2026-07-01', 0)).toBe('HCl — muddat bugun tugaydi (01.07.2026)');
    expect(expiryMessage('HCl', '2026-07-01', -2)).toBe('HCl — muddati o‘tgan: 01.07.2026');
  });
});

// Toshkent: 2026-06-15 15:00 (UTC+5) — "bugun" = 2026-06-15
const NOW = new Date('2026-06-15T10:00:00Z');
const day = (offset: number) => {
  const d = new Date(Date.UTC(2026, 5, 15 + offset));
  return d.toISOString().slice(0, 10);
};

describeDb('reaktiv muddati job va filtr', () => {
  let db: Awaited<ReturnType<typeof setupAuthDb>>;
  let app: express.Express;
  let a: TestCompany;
  let b: TestCompany;
  const users: Record<string, TestUser> = {};
  const tokens: Record<string, string> = {};
  let pushed: { channel: string; userId: string; n: NotificationDto }[] = [];

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp().app;
    a = await createCompany({ name: 'Expiry A' });
    b = await createCompany({ name: 'Expiry B' });
    for (const [name, role, company] of [
      ['labHeadA', 'lab_head', a],
      ['adminA', 'admin', a],
      ['chemistA', 'chemist', a],
      ['kontrolyorA', 'kontrolyor', a],
      ['labHeadB', 'lab_head', b],
    ] as const) {
      users[name] = await createUser({ role, company });
      tokens[name] = (await loginAs(app, users[name]!)).accessToken;
    }
  });
  afterAll(() => db.teardown());

  beforeEach(async () => {
    pushed = [];
    // Socket va Telegram kanallari createNotification orqali bir xil yetkaziladi
    setNotificationChannel('socket-test', (userId, n) =>
      pushed.push({ channel: 'socket', userId, n }),
    );
    setNotificationChannel('telegram-test', (userId, n) =>
      pushed.push({ channel: 'telegram', userId, n }),
    );
    await query('DELETE FROM reagent_expiry_notices');
    await query('DELETE FROM reagent_transactions');
    await query('DELETE FROM reagents');
    await query('DELETE FROM notifications');
  });
  afterEach(() => {
    setNotificationChannel('socket-test', null);
    setNotificationChannel('telegram-test', null);
  });

  async function reagent(
    company: TestCompany,
    name: string,
    expiresAt: string | null,
    opts: { quantity?: number; status?: 'pending' | 'approved' | 'rejected' } = {},
  ): Promise<string> {
    const status = opts.status ?? 'approved';
    const { rows } = await query<{ id: string }>(
      `INSERT INTO reagents (company_id, name, unit, quantity, expires_at, approval_status, approved_at, rejection_reason)
       VALUES ($1, $2, 'ml', $3, $4, $5::reagent_approval_status, CASE WHEN $5 = 'pending' THEN NULL ELSE now() END,
               CASE WHEN $5 = 'rejected' THEN 'Mos kelmadi' ELSE NULL END)
       RETURNING id`,
      [company.id, name, opts.quantity ?? 10, expiresAt, status],
    );
    return rows[0]!.id;
  }

  const notices = async () =>
    (
      await query<{ name: string; threshold: number }>(
        `SELECT r.name, n.threshold FROM reagent_expiry_notices n JOIN reagents r ON r.id = n.reagent_id ORDER BY r.name`,
      )
    ).rows;

  it('R-P16-09: chegaralar 30/7/0, eng shoshilinchi; qamrovdan tashqari holatlar xabarsiz', async () => {
    await reagent(a, 'd30', day(30));
    await reagent(a, 'd31', day(31));
    await reagent(a, 'd8', day(8));
    await reagent(a, 'd7', day(7));
    await reagent(a, 'd1', day(1));
    await reagent(a, 'd0', day(0));
    await reagent(a, 'dm3', day(-3));
    await reagent(a, 'dm8', day(-EXPIRED_CATCHUP_DAYS - 1));
    await reagent(a, 'noexp', null);
    await reagent(a, 'empty', day(5), { quantity: 0 });
    await reagent(a, 'rejected', day(5), { status: 'rejected' });
    await reagent(a, 'pending', day(5), { status: 'pending' });

    const res = await runReagentExpiryJob({ now: NOW });
    expect(res).toEqual({ executed: true, reason: 'success', notified: 7 });
    expect(await notices()).toEqual([
      { name: 'd0', threshold: 0 },
      { name: 'd1', threshold: 7 },
      { name: 'd30', threshold: 30 },
      { name: 'd7', threshold: 7 },
      { name: 'd8', threshold: 30 },
      { name: 'dm3', threshold: 0 },
      { name: 'pending', threshold: 7 },
    ]);
  });

  it('R-P16-10: qabul qiluvchilar — o‘z kompaniyasining lab_head va admin; socket + telegram kanallari', async () => {
    await reagent(a, 'HCl', day(7));
    await reagent(b, 'NaOH', day(30));
    await runReagentExpiryJob({ now: NOW });

    const forA = pushed.filter((p) => p.n.message.startsWith('HCl'));
    expect(new Set(forA.map((p) => p.userId))).toEqual(
      new Set([users.labHeadA!.id, users.adminA!.id]),
    );
    expect(new Set(forA.map((p) => p.channel))).toEqual(new Set(['socket', 'telegram']));
    expect(forA[0]!.n.type).toBe('reagent_expiring');
    expect(forA[0]!.n.message).toBe(
      `HCl — muddat: ${day(7).split('-').reverse().join('.')} (7 kun qoldi)`,
    );

    const forB = pushed.filter((p) => p.n.message.startsWith('NaOH')).map((p) => p.userId);
    expect(new Set(forB)).toEqual(new Set([users.labHeadB!.id]));
    // Tenant: A xodimlariga B reaktivi haqida xabar yo'q
    expect(forA.some((p) => p.userId === users.labHeadB!.id)).toBe(false);
  });

  it('R-P16-11: idempotent — shu kuni qayta ishlash (va keyingi soatlar) dublikat yubormaydi', async () => {
    await reagent(a, 'HCl', day(7));
    await runReagentExpiryJob({ now: NOW });
    const first = pushed.length;
    expect(first).toBeGreaterThan(0);
    const again = await runReagentExpiryJob({ now: NOW });
    const later = await runReagentExpiryJob({ now: new Date(NOW.getTime() + 6 * 3600_000) });
    expect(again.notified).toBe(0);
    expect(later.notified).toBe(0);
    expect(pushed.length).toBe(first);
    const { rows } = await query<{ c: string }>(
      `SELECT count(*) AS c FROM notifications WHERE type = 'reagent_expiring'`,
    );
    expect(Number(rows[0]!.c)).toBe(2); // lab_head + admin, bir marta
  });

  it('R-P16-11: keyingi chegara kelganda va muddat o‘zgarganda yangi ogohlantirish', async () => {
    const id = await reagent(a, 'HCl', day(30));
    expect((await runReagentExpiryJob({ now: NOW })).notified).toBe(1);
    // 23 kundan keyin — 7 kun qoldi
    const plus23 = new Date(NOW.getTime() + 23 * 86400_000);
    expect((await runReagentExpiryJob({ now: plus23 })).notified).toBe(1);
    expect((await runReagentExpiryJob({ now: plus23 })).notified).toBe(0);
    // Yangi partiya: muddat uzaytirilib yana 7 kun ichiga tushsa — yangi sana uchun qayta
    await query(`UPDATE reagents SET expires_at = $1 WHERE id = $2`, [day(28), id]);
    expect((await runReagentExpiryJob({ now: plus23 })).notified).toBe(1);
    expect((await notices()).map((n) => n.threshold).sort()).toEqual([30, 7, 7]);
  });

  it('R-P16-11: advisory lock — boshqa instansiya ishlayotganda job hech narsa yubormaydi', async () => {
    await reagent(a, 'HCl', day(7));
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('reagent_expiry_job'))`);
      const res = await runReagentExpiryJob({ now: NOW });
      expect(res).toEqual({ executed: false, reason: 'locked', notified: 0 });
      expect(pushed).toHaveLength(0);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
    expect((await runReagentExpiryJob({ now: NOW })).notified).toBe(1);
  });

  it('R-P16-11: parallel ikki ishga tushirish — xabar bir marta', async () => {
    await reagent(a, 'HCl', day(7));
    const results = await Promise.all([
      runReagentExpiryJob({ now: NOW }),
      runReagentExpiryJob({ now: NOW }),
    ]);
    expect(results.reduce((s, r) => s + r.notified, 0)).toBe(1);
  });

  it('R-P16-12: GET /reagents?expiringWithinDays — bugun..N ichidagilar, tenant izolyatsiyasi, validatsiya', async () => {
    const tz = `(now() AT TIME ZONE 'Asia/Tashkent')::date`;
    for (const [name, off, company] of [
      ['in5', 5, a],
      ['in30', 30, a],
      ['in31', 31, a],
      ['past', -1, a],
      ['otherCo', 5, b],
    ] as const) {
      await query(
        `INSERT INTO reagents (company_id, name, unit, quantity, expires_at, approval_status, approved_at)
         VALUES ($1, $2, 'ml', 5, ${tz} + $3::int, 'approved', now())`,
        [company.id, name, off],
      );
    }
    const res = await request(app)
      .get('/api/v1/reagents?expiringWithinDays=30&limit=100')
      .set('Authorization', `Bearer ${tokens.chemistA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((r: { name: string }) => r.name).sort()).toEqual(['in30', 'in5']);
    expect(res.body.data.every((r: { isExpiringSoon: boolean }) => r.isExpiringSoon)).toBe(true);

    const all = await request(app)
      .get('/api/v1/reagents?limit=100')
      .set('Authorization', `Bearer ${tokens.kontrolyorA}`);
    const byName = Object.fromEntries(
      all.body.data.map((r: { name: string; isExpiringSoon: boolean; isExpired: boolean }) => [
        r.name,
        r,
      ]),
    );
    expect(byName.in31.isExpiringSoon).toBe(false);
    expect(byName.past.isExpiringSoon).toBe(false);
    expect(byName.past.isExpired).toBe(true);

    for (const bad of ['0', '366', 'abc']) {
      const r = await request(app)
        .get(`/api/v1/reagents?expiringWithinDays=${bad}`)
        .set('Authorization', `Bearer ${tokens.chemistA}`);
      expect(r.status).toBe(400);
    }
  });
});
