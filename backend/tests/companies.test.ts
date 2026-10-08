import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { query } from '../src/config/database.js';
import { ROLES, type Role } from '../src/modules/auth/auth.types.js';
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

describeDb('companies: CRUD and management (super_admin only)', () => {
  let db: Db;
  let app: express.Express;
  let superAdmin: TestUser;
  let superToken: string;
  let testCo: TestCompany;
  const nonSuperTokens = {} as Record<Role, string>;

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp().app;
    testCo = await createCompany({ name: 'Dastlabki Zavod', isActive: true });
    superAdmin = await createUser({ role: 'super_admin' });
    superToken = (await loginAs(app, superAdmin)).accessToken;

    for (const role of ROLES.filter((r) => r !== 'super_admin')) {
      const u = await createUser({ role, company: testCo });
      nonSuperTokens[role] = (await loginAs(app, u)).accessToken;
    }
  });

  afterAll(async () => {
    await db.teardown();
  });

  describe('Ruxsatlar tekshiruvi', () => {
    it('tokensiz soxta so‘rov — 401', async () => {
      const res = await request(app).get('/api/v1/companies');
      expect(res.status).toBe(401);
    });

    it('super_admin bo‘lmagan har qanday rol — 403 Forbidden', async () => {
      for (const role of ROLES.filter((r) => r !== 'super_admin')) {
        const res = await request(app)
          .get('/api/v1/companies')
          .set('Authorization', `Bearer ${nonSuperTokens[role]}`);
        expect(res.status, role).toBe(403);
      }
    });
  });

  describe('GET /api/v1/companies', () => {
    it('kompaniyalar ro‘yxati, qidiruv va filtrlar', async () => {
      // Bir nechta kompaniyalar yaratamiz
      const co1 = await createCompany({ name: 'Farm Standart Alpha', isActive: true });
      const co2 = await createCompany({ name: 'Bio Texnika Beta', isActive: false });

      // Ro'yxat olish
      const listRes = await request(app)
        .get('/api/v1/companies')
        .set('Authorization', `Bearer ${superToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBeGreaterThanOrEqual(3);
      expect(listRes.body.meta.total).toBeGreaterThanOrEqual(3);

      // Qidiruv (search)
      const searchRes = await request(app)
        .get('/api/v1/companies?search=Alpha')
        .set('Authorization', `Bearer ${superToken}`);
      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data.some((c: { id: string }) => c.id === co1.id)).toBe(true);
      expect(searchRes.body.data.some((c: { id: string }) => c.id === co2.id)).toBe(false);

      // isActive filtri
      const activeRes = await request(app)
        .get('/api/v1/companies?isActive=false')
        .set('Authorization', `Bearer ${superToken}`);
      expect(activeRes.status).toBe(200);
      expect(activeRes.body.data.some((c: { id: string }) => c.id === co2.id)).toBe(true);
      expect(activeRes.body.data.some((c: { id: string }) => c.id === co1.id)).toBe(false);
    });

    it('usersCount to‘g‘ri hisoblanadi', async () => {
      const co = await createCompany({ name: 'Count Test Co' });
      await createUser({ role: 'chemist', company: co });
      await createUser({ role: 'admin', company: co });

      const res = await request(app)
        .get(`/api/v1/companies/${co.id}`)
        .set('Authorization', `Bearer ${superToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.usersCount).toBe(2);
    });
  });

  describe('POST /api/v1/companies', () => {
    it('kompaniya va birinchi admin bitta tranzaksiyada yaratiladi (Q-09, D-97)', async () => {
      const payload = {
        name: 'Zavod Medix',
        slug: 'zavod-medix-unique',
        admin: {
          email: 'admin@medix.uz',
          password: 'Password123!',
          fullName: 'Bosh Administrator',
        },
      };

      const res = await request(app)
        .post('/api/v1/companies')
        .set('Authorization', `Bearer ${superToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.data.company).toMatchObject({
        name: 'Zavod Medix',
        slug: 'zavod-medix-unique',
        isActive: true,
      });
      expect(res.body.data.adminUser).toMatchObject({
        email: 'admin@medix.uz',
        fullName: 'Bosh Administrator',
        role: 'admin',
        isActive: true,
      });

      // Yaratilgan admin tizimga muvaffaqiyatli kira olishi kerak
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@medix.uz', password: 'Password123!' });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.user.role).toBe('admin');
      expect(loginRes.body.data.user.companyId).toBe(res.body.data.company.id);

      // Audit log yozilganligini tekshirish
      const { rows } = await query<{ action: string; record_id: string }>(
        `SELECT action, record_id FROM audit_log WHERE action = 'company_create' AND record_id = $1`,
        [res.body.data.company.id],
      );
      expect(rows.length).toBe(1);
    });

    it('noto‘g‘ri slug formati — 400', async () => {
      const res = await request(app)
        .post('/api/v1/companies')
        .set('Authorization', `Bearer ${superToken}`)
        .send({
          name: 'Xato Slug Co',
          slug: 'Noto‘g‘ri Slug!@#',
          admin: {
            email: 'admin1@xato.uz',
            password: 'Password123!',
            fullName: 'Admin',
          },
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('mavjud slug qayta yuborilsa — 409 CONFLICT', async () => {
      const existing = await createCompany();
      const res = await request(app)
        .post('/api/v1/companies')
        .set('Authorization', `Bearer ${superToken}`)
        .send({
          name: 'Duplikat Slug',
          slug: existing.slug,
          admin: {
            email: 'admin2@slug.uz',
            password: 'Password123!',
            fullName: 'Admin',
          },
        });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('admin email band bo‘lsa — 409 va tranzaksiya rollback bo‘ladi (kompaniya saqlanmaydi)', async () => {
      const existingUser = await createUser({ role: 'chemist' });
      const uniqueSlug = 'rollback-test-slug';

      const res = await request(app)
        .post('/api/v1/companies')
        .set('Authorization', `Bearer ${superToken}`)
        .send({
          name: 'Rollback Test',
          slug: uniqueSlug,
          admin: {
            email: existingUser.email,
            password: 'Password123!',
            fullName: 'Admin',
          },
        });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');

      // Kompaniya DB'da saqlanmaganini tasdiqlash (atomiklik)
      const { rows } = await query('SELECT id FROM companies WHERE slug = $1', [uniqueSlug]);
      expect(rows.length).toBe(0);
    });
  });

  describe('GET /api/v1/companies/:id', () => {
    it('mavjud bo‘lmagan ID — 404', async () => {
      const res = await request(app)
        .get('/api/v1/companies/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${superToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('mavjud kompaniya ma‘lumotlarini qaytaradi', async () => {
      const res = await request(app)
        .get(`/api/v1/companies/${testCo.id}`)
        .set('Authorization', `Bearer ${superToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testCo.id);
      expect(res.body.data.usersCount).toBeDefined();
    });
  });

  describe('PATCH /api/v1/companies/:id', () => {
    it('nom va slug muvaffaqiyatli o‘zgartiriladi', async () => {
      const co = await createCompany({ name: 'Eski Nom' });
      const res = await request(app)
        .patch(`/api/v1/companies/${co.id}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ name: 'Yangi Nom', slug: 'yangi-slug-nom' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Yangi Nom');
      expect(res.body.data.slug).toBe('yangi-slug-nom');
    });

    it('boshqa kompaniyaning slug‘iga o‘zgartirishga urinsa — 409', async () => {
      const co1 = await createCompany();
      const co2 = await createCompany();

      const res = await request(app)
        .patch(`/api/v1/companies/${co2.id}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ slug: co1.slug });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('POST /api/v1/companies/:id/deactivate va activate', () => {
    it('deaktivatsiya: is_active=false bo‘ladi, kompaniyaning barcha sessiyalari bekor qilinadi (Q-08, D-34, D-98)', async () => {
      const co = await createCompany({ isActive: true });
      const user = await createUser({ role: 'chemist', company: co });
      const { accessToken } = await loginAs(app, user);

      // Foydalanuvchi hozir faol
      const meBefore = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(meBefore.status).toBe(200);

      // Super admin kompaniyani nofaol qiladi
      const deactRes = await request(app)
        .post(`/api/v1/companies/${co.id}/deactivate`)
        .set('Authorization', `Bearer ${superToken}`);
      expect(deactRes.status).toBe(200);
      expect(deactRes.body.data.isActive).toBe(false);

      // Kompaniya foydalanuvchisining sessiyasi bekor bo‘lgan bo‘lishi kerak (401)
      const meAfter = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(meAfter.status).toBe(401);

      // Allaqachon nofaol bo‘lsa — idempotent 200 qaytaradi
      const deactAgain = await request(app)
        .post(`/api/v1/companies/${co.id}/deactivate`)
        .set('Authorization', `Bearer ${superToken}`);
      expect(deactAgain.status).toBe(200);
      expect(deactAgain.body.data.isActive).toBe(false);

      // Endi qayta faollashtiramiz (activate)
      const actRes = await request(app)
        .post(`/api/v1/companies/${co.id}/activate`)
        .set('Authorization', `Bearer ${superToken}`);
      expect(actRes.status).toBe(200);
      expect(actRes.body.data.isActive).toBe(true);

      // Allaqachon faol bo‘lsa — idempotent 200 qaytaradi
      const actAgain = await request(app)
        .post(`/api/v1/companies/${co.id}/activate`)
        .set('Authorization', `Bearer ${superToken}`);
      expect(actAgain.status).toBe(200);
      expect(actAgain.body.data.isActive).toBe(true);
    });
  });
});
