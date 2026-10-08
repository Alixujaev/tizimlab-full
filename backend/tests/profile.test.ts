import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { query } from '../src/config/database.js';
import { testApp } from './helpers/app.js';
import {
  createUser,
  loginAs,
  setupAuthDb,
  TEST_PASSWORD,
  type TestUser,
} from './helpers/auth.js';
import { describeDb } from './helpers/db.js';

type Db = Awaited<ReturnType<typeof setupAuthDb>>;

describeDb('auth: profile & password change', () => {
  let db: Db;
  let app: express.Express;
  let user: TestUser;
  let token: string;

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp().app;
    user = await createUser({ role: 'chemist' });
    const login = await loginAs(app, user);
    token = login.accessToken;
  });

  afterAll(async () => {
    await db.teardown();
  });

  describe('GET /api/v1/auth/profile', () => {
    it("tokensiz — 401", async () => {
      const res = await request(app).get('/api/v1/auth/profile');
      expect(res.status).toBe(401);
    });

    it("joriy foydalanuvchi ma'lumotlarini qaytaradi", async () => {
      const res = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        id: user.id,
        email: user.email,
        role: 'chemist',
        companyId: user.companyId,
      });
      expect(res.body.data.fullName).toBe('Test chemist');
    });
  });

  describe('PATCH /api/v1/auth/profile', () => {
    it("tokensiz — 401", async () => {
      const res = await request(app)
        .patch('/api/v1/auth/profile')
        .send({ fullName: 'Yangi Ism' });
      expect(res.status).toBe(401);
    });

    it("bo'sh yoki probellardan iborat fullName — 400", async () => {
      const res = await request(app)
        .patch('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ fullName: '   ' });
      expect(res.status).toBe(400);
    });

    it("fullName'ni muvaffaqiyatli yangilaydi va audit log yozadi", async () => {
      const res = await request(app)
        .patch('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ fullName: 'Alisher Navoiy' });
      expect(res.status).toBe(200);
      expect(res.body.data.fullName).toBe('Alisher Navoiy');

      // Audit log yozilganligini tekshirish
      const { rows } = await query<{ action: string; user_id: string }>(
        `SELECT action, user_id FROM audit_log WHERE user_id = $1 AND action = 'profile_update'`,
        [user.id],
      );
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('PUT /api/v1/auth/password', () => {
    it("tokensiz — 401", async () => {
      const res = await request(app)
        .put('/api/v1/auth/password')
        .send({ currentPassword: TEST_PASSWORD, newPassword: 'YangiParol123' });
      expect(res.status).toBe(401);
    });

    it("noto'g'ri joriy parol — 400 VALIDATION_ERROR", async () => {
      const res = await request(app)
        .put('/api/v1/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'XatoParol123', newPassword: 'YangiParol123' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it("yangi parol siyosatga to'g'ri kelmasa — 400", async () => {
      // Kamida 8 belgi, katta harf, kichik harf, raqam
      const res = await request(app)
        .put('/api/v1/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: TEST_PASSWORD, newPassword: 'oddiy' });
      expect(res.status).toBe(400);
    });

    it("yangi parol joriy parol bilan bir xil bo'lsa — 400 VALIDATION_ERROR", async () => {
      const res = await request(app)
        .put('/api/v1/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it("parolni muvaffaqiyatli yangilaydi, boshqa sessiyalarni bekor qiladi, joriy sessiya saqlanadi", async () => {
      const targetUser = await createUser({ role: 'chemist', password: 'OldPassword123' });
      // Ikkita alohida login qilamiz (ikkita sessiya)
      const session1 = await loginAs(app, targetUser);
      const session2 = await loginAs(app, targetUser);

      // session1 orqali parolni o'zgartiramiz
      const changeRes = await request(app)
        .put('/api/v1/auth/password')
        .set('Authorization', `Bearer ${session1.accessToken}`)
        .send({ currentPassword: 'OldPassword123', newPassword: 'NewPassword999' });
      expect(changeRes.status).toBe(200);
      expect(changeRes.body.data.success).toBe(true);

      // session1 hali ham ishlashi kerak (joriy sessiya saqlangan)
      const me1 = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${session1.accessToken}`);
      expect(me1.status).toBe(200);

      // session2 esa bekor qilingan bo'lishi kerak (401 SESSION_EXPIRED / SESSION_NOT_FOUND)
      const me2 = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${session2.accessToken}`);
      expect(me2.status).toBe(401);

      // Eski parol bilan login qilib bo'lmaydi
      const failLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: targetUser.email, password: 'OldPassword123' });
      expect(failLogin.status).toBe(401);

      // Yangi parol bilan login qilib bo'ladi
      const successLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: targetUser.email, password: 'NewPassword999' });
      expect(successLogin.status).toBe(200);

      // Audit log yozilganligini tekshirish
      const { rows } = await query<{ action: string; user_id: string }>(
        `SELECT action, user_id FROM audit_log WHERE user_id = $1 AND action = 'password_change'`,
        [targetUser.id],
      );
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });
  });
});
