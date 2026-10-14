import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { query } from '../src/config/database.js';
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

type Db = Awaited<ReturnType<typeof setupAuthDb>>;

describeDb('admin: users, roles, permissions and audit logs', () => {
  let db: Db;
  let app: express.Express;
  let companyA: TestCompany;
  let companyB: TestCompany;

  let adminA: TestUser;
  let labHeadA: TestUser;
  let directorA: TestUser;
  let chemistA: TestUser;
  let superAdmin: TestUser;

  let tokenAdminA: string;
  let tokenLabHeadA: string;
  let tokenDirectorA: string;
  let tokenChemistA: string;
  let tokenSuperAdmin: string;

  let adminB: TestUser;
  let chemistB: TestUser;
  let tokenAdminB: string;

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp().app;

    companyA = await createCompany({ name: 'Kompaniya A' });
    companyB = await createCompany({ name: 'Kompaniya B' });

    adminA = await createUser({ role: 'admin', company: companyA });
    labHeadA = await createUser({ role: 'lab_head', company: companyA });
    directorA = await createUser({ role: 'director', company: companyA });
    chemistA = await createUser({ role: 'chemist', company: companyA });
    await createUser({ role: 'kontrolyor', company: companyA });
    superAdmin = await createUser({ role: 'super_admin' });

    tokenAdminA = (await loginAs(app, adminA)).accessToken;
    tokenLabHeadA = (await loginAs(app, labHeadA)).accessToken;
    tokenDirectorA = (await loginAs(app, directorA)).accessToken;
    tokenChemistA = (await loginAs(app, chemistA)).accessToken;
    tokenSuperAdmin = (await loginAs(app, superAdmin)).accessToken;

    adminB = await createUser({ role: 'admin', company: companyB });
    chemistB = await createUser({ role: 'chemist', company: companyB });
    tokenAdminB = (await loginAs(app, adminB)).accessToken;
  });

  afterAll(async () => {
    await db.teardown();
  });

  describe('Ruxsatlar va Rollar tekshiruvi (Matrix & Spec §10)', () => {
    it('tokensiz murojaat — 401', async () => {
      const res = await request(app).get('/api/v1/admin/users');
      expect(res.status).toBe(401);
    });

    it('super_admin — company-scoped route sababli 403 COMPANY_REQUIRED', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${tokenSuperAdmin}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('COMPANY_REQUIRED');
    });

    it('chemist va kontrolyor — 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${tokenChemistA}`);
      expect(res.status).toBe(403);
    });

    it('director — users:view ruxsati bor (ko‘ra oladi), lekin yarata olmaydi / o‘zgartira olmaydi (403)', async () => {
      const getRes = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${tokenDirectorA}`);
      expect(getRes.status).toBe(200);

      // Yaratishga urinish — 403
      const postRes = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${tokenDirectorA}`)
        .send({
          email: 'dir.created@test.uz',
          password: 'Password123!',
          fullName: 'Dir User',
          role: 'chemist',
        });
      expect(postRes.status).toBe(403);

      // Parol tiklashga urinish — 403
      const resetRes = await request(app)
        .post(`/api/v1/admin/users/${chemistA.id}/reset-password`)
        .set('Authorization', `Bearer ${tokenDirectorA}`)
        .send({ newPassword: 'Password123!' });
      expect(resetRes.status).toBe(403);
    });

    it('lab_head — faqat chemist va kontrolyor yarata oladi (D-16, D-99)', async () => {
      // chemist yaratish — 201
      const res1 = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${tokenLabHeadA}`)
        .send({
          email: 'lh.chemist@test.uz',
          password: 'Password123!',
          fullName: 'LH Chemist',
          role: 'chemist',
        });
      expect(res1.status).toBe(201);

      // kontrolyor yaratish — 201
      const res2 = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${tokenLabHeadA}`)
        .send({
          email: 'lh.kontrolyor@test.uz',
          password: 'Password123!',
          fullName: 'LH Kontrolyor',
          role: 'kontrolyor',
        });
      expect(res2.status).toBe(201);

      // admin yaratishga urinish — 403 FORBIDDEN
      const resAdmin = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${tokenLabHeadA}`)
        .send({
          email: 'lh.admin@test.uz',
          password: 'Password123!',
          fullName: 'LH Admin',
          role: 'admin',
        });
      expect(resAdmin.status).toBe(403);
      expect(resAdmin.body.error.code).toBe('FORBIDDEN');

      // lab_head yaratishga urinish — 403 FORBIDDEN
      const resLh = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${tokenLabHeadA}`)
        .send({
          email: 'lh.second@test.uz',
          password: 'Password123!',
          fullName: 'LH Second',
          role: 'lab_head',
        });
      expect(resLh.status).toBe(403);
      expect(resLh.body.error.code).toBe('FORBIDDEN');
    });

    it('lab_head — boshqa lab_head, admin yoki director profilini o‘zgartira olmaydi (403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${adminA.id}`)
        .set('Authorization', `Bearer ${tokenLabHeadA}`)
        .send({ fullName: 'Buzilgan Admin' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('lab_head — permissions boshqara olmaydi (403, permissions:manage kerak)', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/users/${chemistA.id}/permissions`)
        .set('Authorization', `Bearer ${tokenLabHeadA}`)
        .send({ permissions: ['protocols:approve'] });
      expect(res.status).toBe(403);
    });
  });

  describe('Multi-tenant izolyatsiyasi (D-102)', () => {
    it('admin A faqat kompaniya A foydalanuvchilarini ko‘radi', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(res.status).toBe(200);
      const userIds = res.body.data.map((u: { id: string }) => u.id);
      expect(userIds).toContain(adminA.id);
      expect(userIds).toContain(chemistA.id);
      expect(userIds).not.toContain(adminB.id);
      expect(userIds).not.toContain(chemistB.id);
    });

    it('admin A boshqa kompaniya foydalanuvchisi IDsi bilan murojaat qilsa — 404 (403 emas)', async () => {
      // GET :id
      const getRes = await request(app)
        .get(`/api/v1/admin/users/${chemistB.id}`)
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(getRes.status).toBe(404);
      expect(getRes.body.error.code).toBe('NOT_FOUND');

      // PATCH :id
      const patchRes = await request(app)
        .patch(`/api/v1/admin/users/${chemistB.id}`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({ fullName: 'Xaker Ism' });
      expect(patchRes.status).toBe(404);

      // POST reset-password
      const resetRes = await request(app)
        .post(`/api/v1/admin/users/${chemistB.id}/reset-password`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({ newPassword: 'Password123!' });
      expect(resetRes.status).toBe(404);

      // GET permissions
      const permGetRes = await request(app)
        .get(`/api/v1/admin/users/${chemistB.id}/permissions`)
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(permGetRes.status).toBe(404);

      // PUT permissions
      const permPutRes = await request(app)
        .put(`/api/v1/admin/users/${chemistB.id}/permissions`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({ permissions: ['protocols:approve'] });
      expect(permPutRes.status).toBe(404);

      // GET logs
      const logsRes = await request(app)
        .get(`/api/v1/admin/users/${chemistB.id}/logs`)
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(logsRes.status).toBe(404);
    });
  });

  describe('Oxirgi faol admin himoyasi va o‘zini nofaol qilish taqiqi (D-101)', () => {
    it('kompaniyadagi yagona faol adminni nofaol qilish — 400 VALIDATION_ERROR', async () => {
      // companyB da faqat adminB faol admin
      // Avval adminB o'zini nofaol qilishga urinsa — 400 CANNOT_DEACTIVATE_SELF
      const selfRes = await request(app)
        .patch(`/api/v1/admin/users/${adminB.id}`)
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .send({ isActive: false });
      expect(selfRes.status).toBe(400);
      expect(selfRes.body.error.code).toBe('VALIDATION_ERROR');

      // Endi ikkinchi admin yaratamiz
      const adminB2 = await createUser({ role: 'admin', company: companyB });
      const tokenAdminB2 = (await loginAs(app, adminB2)).accessToken;

      // adminB2 adminB ni nofaol qila oladi (chunki adminB2 hali faol qoladi)
      const deactFirst = await request(app)
        .patch(`/api/v1/admin/users/${adminB.id}`)
        .set('Authorization', `Bearer ${tokenAdminB2}`)
        .send({ isActive: false });
      expect(deactFirst.status).toBe(200);

      // Endi faqat adminB2 faol admin qoldi. Uning rolini chemistga o'zgartirishga urinsa:
      const changeRoleRes = await request(app)
        .patch(`/api/v1/admin/users/${adminB2.id}`)
        .set('Authorization', `Bearer ${tokenAdminB2}`)
        .send({ role: 'chemist' });
      expect(changeRoleRes.status).toBe(400);
      expect(changeRoleRes.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Foydalanuvchini nofaol qilish va sessiyalar bekor bo‘lishi', () => {
    it('user is_active=false qilinganda uning sessiyalari darhol bekor bo‘ladi', async () => {
      const u = await createUser({ role: 'chemist', company: companyA });
      const { accessToken } = await loginAs(app, u);

      // Hozir sessiya ishlayapti
      const meBefore = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(meBefore.status).toBe(200);

      // Admin uni nofaol qiladi
      const patchRes = await request(app)
        .patch(`/api/v1/admin/users/${u.id}`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({ isActive: false });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.isActive).toBe(false);

      // Keyingi so‘rov sessiya bekor qilingani sababli 401 bo‘ladi
      const meAfter = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(meAfter.status).toBe(401);
    });
  });

  describe('Parol tiklash (POST /api/v1/admin/users/:id/reset-password)', () => {
    it('admin foydalanuvchi parolini tiklaydi, eski sessiyalar o‘chadi, yangi parol bilan kiradi', async () => {
      const u = await createUser({ role: 'chemist', company: companyA, password: 'OldPass12345!' });
      const { accessToken } = await loginAs(app, u);

      // Admin parolni tiklaydi
      const resetRes = await request(app)
        .post(`/api/v1/admin/users/${u.id}/reset-password`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({ newPassword: 'FreshPassword999!' });
      expect(resetRes.status).toBe(200);

      // Eski sessiya bekor qilingan
      const me = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(me.status).toBe(401);

      // Yangi parol bilan tizimga kirish
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: u.email, password: 'FreshPassword999!' });
      expect(login.status).toBe(200);

      // Audit log yozilganligini tekshirish
      const { rows } = await query<{ action: string; record_id: string }>(
        `SELECT action, record_id FROM audit_log WHERE action = 'admin_password_reset' AND record_id = $1`,
        [u.id],
      );
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Ruxsatlar boshqaruvi (catalog & grants - D-32)', () => {
    it('GET /api/v1/admin/permissions/catalog — 24 ta ruxsat (+ analytics:* D-159) va roleDefaults qaytaradi', async () => {
      const res = await request(app)
        .get('/api/v1/admin/permissions/catalog')
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(res.status).toBe(200);
      expect(res.body.data.catalog).toHaveLength(24);
      expect(res.body.data.roleDefaults).toBeDefined();
      expect(res.body.data.roleDefaults.lab_head).toContain('protocols:approve');
      expect(res.body.data.roleDefaults.chemist).not.toContain('protocols:approve');
    });

    it('GET va PUT /api/v1/admin/users/:id/permissions — grant qo‘shish va bekor qilish', async () => {
      // Dastlab chemistA da individual grant yo'q
      const getRes1 = await request(app)
        .get(`/api/v1/admin/users/${chemistA.id}/permissions`)
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(getRes1.status).toBe(200);
      expect(getRes1.body.data.individualPermissions).toEqual([]);
      expect(getRes1.body.data.effectivePermissions).not.toContain('protocols:approve');

      // Chemistga 'protocols:approve' grantini beramiz
      const putRes = await request(app)
        .put(`/api/v1/admin/users/${chemistA.id}/permissions`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({ permissions: ['protocols:approve'] });
      expect(putRes.status).toBe(200);
      expect(putRes.body.data.individualPermissions).toContain('protocols:approve');
      expect(putRes.body.data.effectivePermissions).toContain('protocols:approve');

      // Noto‘g‘ri ruxsat kaliti yuborilsa — 400 VALIDATION_ERROR
      const badKeyRes = await request(app)
        .put(`/api/v1/admin/users/${chemistA.id}/permissions`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({ permissions: ['invalid:action_test'] });
      expect(badKeyRes.status).toBe(400);
      expect(badKeyRes.body.error.code).toBe('VALIDATION_ERROR');

      // Ruxsatni bekor qilish (bo‘sh ro‘yxat yuborish)
      const clearRes = await request(app)
        .put(`/api/v1/admin/users/${chemistA.id}/permissions`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({ permissions: [] });
      expect(clearRes.status).toBe(200);
      expect(clearRes.body.data.individualPermissions).toEqual([]);
      expect(clearRes.body.data.effectivePermissions).not.toContain('protocols:approve');
    });
  });

  describe('GET /api/v1/admin/users/:id/logs va GET /stats', () => {
    it('audit logs paginated ro‘yxatini qaytaradi', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/users/${chemistA.id}/logs`)
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.meta.total).toBeDefined();
    });

    it('statistika ma‘lumotlari to‘g‘ri hisoblanadi', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users/stats')
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBeGreaterThanOrEqual(5);
      expect(res.body.data.active).toBeGreaterThanOrEqual(1);
      expect(res.body.data.byRole).toBeDefined();
    });
  });
});
