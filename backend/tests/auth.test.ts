import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { query } from '../src/config/database.js';
import { sha256 } from '../src/modules/auth/tokens.js';
import { TEST_ENV, testApp } from './helpers/app.js';
import {
  createCompany,
  createUser,
  loginAs,
  refreshCookieOf,
  setupAuthDb,
  TEST_PASSWORD,
} from './helpers/auth.js';
import { describeDb } from './helpers/db.js';

type Db = Awaited<ReturnType<typeof setupAuthDb>>;

const LOGIN = '/api/v1/auth/login';
const REFRESH = '/api/v1/auth/refresh';
const LOGOUT = '/api/v1/auth/logout';
const ME = '/api/v1/auth/me';

describeDb('auth (TEST_DATABASE_URL)', () => {
  let db: Db;
  beforeAll(async () => {
    db = await setupAuthDb();
  });
  afterAll(async () => {
    await db.teardown();
  });

  const sessionsOf = async (userId: string) =>
    (await query<{ id: string }>('SELECT id FROM sessions WHERE user_id = $1', [userId])).rows;
  const auditOf = async (action: string, userId?: string) =>
    (
      await query<Record<string, unknown>>(
        `SELECT * FROM audit_log WHERE action = $1 AND ($2::uuid IS NULL OR user_id = $2) ORDER BY created_at`,
        [action, userId ?? null],
      )
    ).rows;

  describe('POST /auth/login', () => {
    it("muvaffaqiyat: access token, refresh cookie (HttpOnly, SameSite=Strict, path), foydalanuvchi ma'lumoti", async () => {
      const { app } = testApp();
      const company = await createCompany();
      const user = await createUser({ role: 'lab_head', company });
      const res = await request(app)
        .post(LOGIN)
        .set('User-Agent', 'vitest-agent')
        .send({ email: user.email.toUpperCase(), password: TEST_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.data.user).toEqual({
        id: user.id,
        email: user.email,
        fullName: 'Test lab_head',
        role: 'lab_head',
        companyId: company.id,
        company: { id: company.id, name: company.name, slug: company.slug },
      });
      expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
      const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
        c.startsWith('refresh_token='),
      )!;
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Strict/);
      expect(cookie).toMatch(/Path=\/api\/v1\/auth\/refresh/);
      expect(cookie).not.toMatch(/Secure/); // faqat production'da

      // D-87: claim'lar
      const claims = jwt.verify(
        res.body.data.accessToken,
        TEST_ENV.JWT_ACCESS_SECRET,
      ) as jwt.JwtPayload;
      expect(claims).toMatchObject({ sub: user.id, role: 'lab_head', company_id: company.id });
      expect(claims.exp! - claims.iat!).toBe(30 * 60);
      const sessions = await query<{
        id: string;
        token_hash: string;
        user_agent: string;
        days: number;
      }>(
        `SELECT id, token_hash, user_agent, round(extract(epoch FROM expires_at - created_at) / 86400) AS days
         FROM sessions WHERE user_id = $1`,
        [user.id],
      );
      expect(sessions.rows).toHaveLength(1);
      expect(claims.sid).toBe(sessions.rows[0]!.id);
      // Bazada xom token emas — SHA-256 xesh (R-AUTH-09)
      const rawRefresh = cookie.split(';')[0]!.slice('refresh_token='.length);
      expect(sessions.rows[0]!.token_hash).toBe(sha256(rawRefresh));
      expect(Number(sessions.rows[0]!.days)).toBe(7);
      expect(sessions.rows[0]!.user_agent).toBe('vitest-agent');
    });

    it('super_admin login — company_id null', async () => {
      const { app } = testApp();
      const sa = await createUser({ role: 'super_admin' });
      const { accessToken } = await loginAs(app, sa);
      const claims = jwt.decode(accessToken) as jwt.JwtPayload;
      expect(claims.company_id).toBeNull();
      const me = await request(app).get(ME).set('Authorization', `Bearer ${accessToken}`);
      expect(me.body.data).toMatchObject({ role: 'super_admin', companyId: null, company: null });
    });

    it("noto'g'ri parol va noma'lum email — bir xil javob (D-91)", async () => {
      const { app } = testApp();
      const user = await createUser({ role: 'chemist' });
      const wrong = await request(app)
        .post(LOGIN)
        .send({ email: user.email, password: 'Notogri123' });
      const unknown = await request(app)
        .post(LOGIN)
        .send({ email: 'yoq@test.uz', password: 'Notogri123' });
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
      const strip = (b: { error: { requestId?: string } }) => ({
        ...b.error,
        requestId: undefined,
      });
      expect(strip(unknown.body)).toEqual(strip(wrong.body));
      expect(wrong.headers['set-cookie']).toBeUndefined();
    });

    it('nofaol foydalanuvchi va nofaol kompaniya foydalanuvchisi kira olmaydi', async () => {
      const { app } = testApp();
      const inactiveUser = await createUser({ role: 'chemist', isActive: false });
      const inactiveCompany = await createCompany({ isActive: false });
      const inCompany = await createUser({ role: 'admin', company: inactiveCompany });
      for (const u of [inactiveUser, inCompany]) {
        const res = await request(app)
          .post(LOGIN)
          .send({ email: u.email, password: TEST_PASSWORD });
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
        expect(await sessionsOf(u.id)).toHaveLength(0);
      }
      // Nofaol hisob uchun ham noto'g'ri parol — INVALID_CREDENTIALS (holat oshkor qilinmaydi)
      const wrong = await request(app)
        .post(LOGIN)
        .send({ email: inactiveUser.email, password: 'Notogri123' });
      expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it("validatsiya: email formati, bo'sh parol → 400", async () => {
      const { app } = testApp();
      const res = await request(app).post(LOGIN).send({ email: 'emas-email', password: '' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it("4-sessiya eng uzoq ishlatilmaganini o'chiradi (D-89, Q-58)", async () => {
      const { app } = testApp();
      const user = await createUser({ role: 'chemist' });
      const first = await loginAs(app, user);
      const second = await loginAs(app, user);
      const third = await loginAs(app, user);
      const sid = (t: string) => (jwt.decode(t) as jwt.JwtPayload).sid as string;
      // Birinchi sessiya yaqinda ishlatilgan, ikkinchisi — eng eski faollik
      await query(
        `UPDATE sessions SET last_activity = now() - interval '10 minutes' WHERE id = $1`,
        [sid(second.accessToken)],
      );
      await query(
        `UPDATE sessions SET last_activity = now() - interval '5 minutes' WHERE id = $1`,
        [sid(third.accessToken)],
      );
      await loginAs(app, user);
      const ids = (await sessionsOf(user.id)).map((s) => s.id);
      expect(ids).toHaveLength(3);
      expect(ids).toContain(sid(first.accessToken));
      expect(ids).not.toContain(sid(second.accessToken));
      const revoked = await auditOf('session_revoked', user.id);
      expect(revoked.at(-1)).toMatchObject({
        record_id: sid(second.accessToken),
        new_values: { reason: 'session_limit' },
      });
      // O'chirilgan sessiya tokeni endi ishlamaydi
      const me = await request(app).get(ME).set('Authorization', `Bearer ${second.accessToken}`);
      expect(me.status).toBe(401);
      expect(me.body.error.code).toBe('SESSION_EXPIRED');
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotatsiya: yangi access + yangi cookie; eski cookie qayta ishlatilsa — sessiya bekor, TOKEN_REUSED', async () => {
      const { app } = testApp();
      const user = await createUser({ role: 'director' });
      const { refreshCookie } = await loginAs(app, user);
      const r1 = await request(app).post(REFRESH).set('Cookie', refreshCookie);
      expect(r1.status).toBe(200);
      expect(typeof r1.body.data.accessToken).toBe('string');
      const rotated = refreshCookieOf(r1);
      expect(rotated).not.toBe(refreshCookie);

      const r2 = await request(app).post(REFRESH).set('Cookie', rotated);
      expect(r2.status).toBe(200);

      // Eski (almashtirilgan) token — reuse
      const reuse = await request(app).post(REFRESH).set('Cookie', refreshCookie);
      expect(reuse.status).toBe(401);
      expect(reuse.body.error.code).toBe('TOKEN_REUSED');
      expect(await sessionsOf(user.id)).toHaveLength(0);
      expect(await auditOf('token_refresh_reuse', user.id)).toHaveLength(1);
      // Sessiya bekor qilingani uchun eng yangi token ham ishlamaydi
      const after = await request(app).post(REFRESH).set('Cookie', refreshCookieOf(r2));
      expect(after.status).toBe(401);
      expect(after.body.error.code).toBe('SESSION_EXPIRED');
    });

    it("cookie yo'q yoki soxta — 401", async () => {
      const { app } = testApp();
      expect((await request(app).post(REFRESH)).status).toBe(401);
      const forged = jwt.sign(
        { typ: 'refresh', sid: crypto.randomUUID() },
        'boshqa-sir-0123456789abcdef0123456789',
        {
          subject: crypto.randomUUID(),
        },
      );
      const res = await request(app).post(REFRESH).set('Cookie', `refresh_token=${forged}`);
      expect(res.status).toBe(401);
    });

    it('idle sessiya refresh bilan ham tiklanmaydi (D-90)', async () => {
      const { app } = testApp();
      const user = await createUser({ role: 'chemist' });
      const { refreshCookie } = await loginAs(app, user);
      await query(
        `UPDATE sessions SET last_activity = now() - interval '31 minutes' WHERE user_id = $1`,
        [user.id],
      );
      const res = await request(app).post(REFRESH).set('Cookie', refreshCookie);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('SESSION_EXPIRED');
      expect(await sessionsOf(user.id)).toHaveLength(0);
    });
  });

  describe("sessionTimeout (har himoyalangan so'rov)", () => {
    it("idle timeout: 30 daqiqadan oshsa 401 SESSION_EXPIRED va sessiya o'chiriladi", async () => {
      const { app } = testApp();
      const user = await createUser({ role: 'chemist' });
      const { accessToken } = await loginAs(app, user);
      await query(
        `UPDATE sessions SET last_activity = now() - interval '29 minutes' WHERE user_id = $1`,
        [user.id],
      );
      expect(
        (await request(app).get(ME).set('Authorization', `Bearer ${accessToken}`)).status,
      ).toBe(200);
      await query(
        `UPDATE sessions SET last_activity = now() - interval '31 minutes' WHERE user_id = $1`,
        [user.id],
      );
      const res = await request(app).get(ME).set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('SESSION_EXPIRED');
      expect(await sessionsOf(user.id)).toHaveLength(0);
      const revoked = await auditOf('session_revoked', user.id);
      expect(revoked.at(-1)).toMatchObject({ new_values: { reason: 'idle' } });
    });

    it("last_activity daqiqada ko'pi bilan bir marta yoziladi (Q-59)", async () => {
      const { app } = testApp();
      const user = await createUser({ role: 'chemist' });
      const { accessToken } = await loginAs(app, user);
      const lastActivity = async () =>
        (
          await query<{ a: Date }>('SELECT last_activity AS a FROM sessions WHERE user_id = $1', [
            user.id,
          ])
        ).rows[0]!.a;
      await query(
        `UPDATE sessions SET last_activity = now() - interval '30 seconds' WHERE user_id = $1`,
        [user.id],
      );
      const before = await lastActivity();
      await request(app).get(ME).set('Authorization', `Bearer ${accessToken}`);
      expect((await lastActivity()).getTime()).toBe(before.getTime());
      await query(
        `UPDATE sessions SET last_activity = now() - interval '2 minutes' WHERE user_id = $1`,
        [user.id],
      );
      const old = await lastActivity();
      await request(app).get(ME).set('Authorization', `Bearer ${accessToken}`);
      expect((await lastActivity()).getTime()).toBeGreaterThan(old.getTime());
    });

    it("kompaniya yoki foydalanuvchi nofaollashtirilsa — keyingi so'rov 401, sessiya bekor (D-34)", async () => {
      const { app } = testApp();
      const company = await createCompany();
      const user = await createUser({ role: 'admin', company });
      const { accessToken } = await loginAs(app, user);
      await query('UPDATE companies SET is_active = false WHERE id = $1', [company.id]);
      const res = await request(app).get(ME).set('Authorization', `Bearer ${accessToken}`);
      expect(res.body.error.code).toBe('SESSION_EXPIRED');
      expect(await sessionsOf(user.id)).toHaveLength(0);

      const other = await createUser({ role: 'chemist' });
      const t = await loginAs(app, other);
      await query('UPDATE users SET is_active = false WHERE id = $1', [other.id]);
      expect(
        (await request(app).get(ME).set('Authorization', `Bearer ${t.accessToken}`)).status,
      ).toBe(401);
    });
  });

  describe('access token', () => {
    it("token yo'q, noto'g'ri imzo, muddati o'tgan, noma'lum sid — 401", async () => {
      const { app } = testApp();
      const user = await createUser({ role: 'chemist' });
      const { accessToken } = await loginAs(app, user);
      const claims = jwt.decode(accessToken) as jwt.JwtPayload;
      const sign = (
        payload: object,
        secret = TEST_ENV.JWT_ACCESS_SECRET,
        opts: jwt.SignOptions = {},
      ) =>
        jwt.sign(
          { typ: 'access', role: claims.role, company_id: claims.company_id, ...payload },
          secret,
          {
            subject: user.id,
            expiresIn: '30m',
            ...opts,
          },
        );
      const cases = [
        undefined,
        'Bearer ',
        `Bearer ${sign({ sid: claims.sid }, 'boshqa-sir-0123456789abcdef0123456789')}`,
        `Bearer ${sign({ sid: claims.sid }, TEST_ENV.JWT_ACCESS_SECRET, { expiresIn: -10 })}`,
        `Bearer ${sign({ sid: crypto.randomUUID() })}`,
        // refresh sirida imzolangan token access sifatida qabul qilinmaydi
        `Bearer ${sign({ sid: claims.sid }, TEST_ENV.JWT_REFRESH_SECRET)}`,
        `Bearer ${jwt.sign({ typ: 'access', role: 'boss', company_id: null, sid: claims.sid }, TEST_ENV.JWT_ACCESS_SECRET, { subject: user.id })}`,
      ];
      for (const header of cases) {
        const req = request(app).get(ME);
        if (header) req.set('Authorization', header);
        const res = await req;
        expect(res.status, String(header)).toBe(401);
      }
      expect(
        (await request(app).get(ME).set('Authorization', `Bearer ${accessToken}`)).status,
      ).toBe(200);
    });
  });

  describe('POST /auth/logout', () => {
    it("sessiyani o'chiradi, cookie tozalanadi, refresh endi ishlamaydi", async () => {
      const { app } = testApp();
      const user = await createUser({ role: 'kontrolyor' });
      const { accessToken, refreshCookie } = await loginAs(app, user);
      const res = await request(app).post(LOGOUT).set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(204);
      const cleared = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
        c.startsWith('refresh_token='),
      );
      expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
      expect(await sessionsOf(user.id)).toHaveLength(0);
      expect((await request(app).post(REFRESH).set('Cookie', refreshCookie)).status).toBe(401);
      expect(
        (await request(app).get(ME).set('Authorization', `Bearer ${accessToken}`)).status,
      ).toBe(401);
      expect((await request(app).post(LOGOUT)).status).toBe(401);
    });
  });

  describe('audit (D-60, D-62, D-80, D-92)', () => {
    let app: ReturnType<typeof testApp>['app'];
    beforeEach(() => {
      app = testApp().app;
    });

    it("login_success, login_failed (record_id NULL), logout — maydonlar to'g'ri, sezgir qiymatlar yo'q", async () => {
      const company = await createCompany();
      const user = await createUser({ role: 'admin', company });
      await request(app)
        .post(LOGIN)
        .set('User-Agent', 'ua-1')
        .send({ email: user.email, password: 'Notogri123' });
      await request(app).post(LOGIN).send({ email: 'hech-kim@test.uz', password: 'Notogri123' });
      const { accessToken } = await loginAs(app, user);
      const sid = (jwt.decode(accessToken) as jwt.JwtPayload).sid as string;
      await request(app).post(LOGOUT).set('Authorization', `Bearer ${accessToken}`);

      const failed = await auditOf('login_failed', user.id);
      expect(failed.at(-1)).toMatchObject({
        table_name: 'auth',
        record_id: null,
        user_id: user.id,
        company_id: company.id,
        user_agent: 'ua-1',
        new_values: { email: user.email, reason: 'invalid_password' },
      });
      expect(failed.at(-1)!.ip_address).toBeTruthy();
      const unknown = (await auditOf('login_failed')).find(
        (r) => (r.new_values as { email: string }).email === 'hech-kim@test.uz',
      );
      expect(unknown).toMatchObject({
        user_id: null,
        record_id: null,
        new_values: { reason: 'unknown_email' },
      });
      expect((await auditOf('login_success', user.id)).at(-1)).toMatchObject({
        table_name: 'sessions',
        record_id: sid,
        company_id: company.id,
      });
      expect((await auditOf('logout', user.id)).at(-1)).toMatchObject({
        table_name: 'sessions',
        record_id: sid,
      });

      const all = await query<{ t: string }>('SELECT row_to_json(a)::text AS t FROM audit_log a');
      const dump = all.rows.map((r) => r.t).join('\n');
      expect(dump).not.toContain(TEST_PASSWORD);
      expect(dump).not.toContain('Notogri123');
      expect(dump).not.toMatch(/\$2[aby]\$/); // bcrypt xeshi
      expect(dump).not.toContain(accessToken);
      const hashes = await query<{ token_hash: string }>('SELECT token_hash FROM sessions');
      for (const h of hashes.rows) expect(dump).not.toContain(h.token_hash);
    });

    it("loglarda parol, token va cookie qiymatlari yo'q", async () => {
      const { app: logged, sink } = testApp();
      const user = await createUser({ role: 'chemist' });
      const { accessToken, refreshCookie } = await loginAs(logged, user);
      await request(logged).post(REFRESH).set('Cookie', refreshCookie);
      await request(logged).get(ME).set('Authorization', `Bearer ${accessToken}`);
      await request(logged).post(LOGIN).send({ email: user.email, password: 'Notogri123' });
      const text = sink.text();
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toContain(TEST_PASSWORD);
      expect(text).not.toContain('Notogri123');
      expect(text).not.toContain(accessToken);
      expect(text).not.toContain(refreshCookie.split('=')[1]!);
    });
  });
});
