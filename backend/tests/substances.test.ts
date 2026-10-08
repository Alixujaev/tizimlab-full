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

describeDb('substances: backend RBAC, transactions, validation, isolation and audit', () => {
  let db: Db;
  let app: express.Express;
  let companyA: TestCompany;
  let companyB: TestCompany;

  let kontrolyorA: TestUser;
  let chemistA: TestUser;
  let labHeadA: TestUser;
  let directorA: TestUser;
  let adminA: TestUser;
  let superAdmin: TestUser;

  let tokenKontrolyorA: string;
  let tokenChemistA: string;
  let tokenLabHeadA: string;
  let tokenDirectorA: string;
  let tokenAdminA: string;
  let tokenSuperAdmin: string;

  let adminB: TestUser;
  let tokenAdminB: string;

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp().app;

    companyA = await createCompany({ name: 'Pharm A' });
    companyB = await createCompany({ name: 'Pharm B' });

    kontrolyorA = await createUser({ role: 'kontrolyor', company: companyA });
    chemistA = await createUser({ role: 'chemist', company: companyA });
    labHeadA = await createUser({ role: 'lab_head', company: companyA });
    directorA = await createUser({ role: 'director', company: companyA });
    adminA = await createUser({ role: 'admin', company: companyA });
    superAdmin = await createUser({ role: 'super_admin' });

    tokenKontrolyorA = (await loginAs(app, kontrolyorA)).accessToken;
    tokenChemistA = (await loginAs(app, chemistA)).accessToken;
    tokenLabHeadA = (await loginAs(app, labHeadA)).accessToken;
    tokenDirectorA = (await loginAs(app, directorA)).accessToken;
    tokenAdminA = (await loginAs(app, adminA)).accessToken;
    tokenSuperAdmin = (await loginAs(app, superAdmin)).accessToken;

    adminB = await createUser({ role: 'admin', company: companyB });
    tokenAdminB = (await loginAs(app, adminB)).accessToken;
  });

  afterAll(async () => {
    await db.teardown();
  });

  describe('RBAC matritsasi (R-ROLE-43..47, R-SUBST-06, R-SUBST-07, R-SUBST-10)', () => {
    let createdSubstanceId: string;

    it('lab_head yangi modda va parametrlar yarata oladi (201)', async () => {
      const res = await request(app)
        .post('/api/v1/substances')
        .set('Authorization', `Bearer ${tokenLabHeadA}`)
        .send({
          nameUz: 'Paratsetamol',
          nameRu: 'Парацетамол',
          nameEn: 'Paracetamol',
          pharmacopoeia: 'USP',
          casNumber: '103-90-2',
          description: 'Ogriq qoldiruvchi',
          parameters: [
            {
              parameterName: 'Tashqi ko‘rinishi',
              method: 'Vizual',
              sortOrder: 0,
            },
            {
              parameterName: 'Erish harorati',
              unit: '°C',
              specMin: 168.0,
              specMax: 172.0,
              method: 'Kapillyar usul',
              sortOrder: 1,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.nameUz).toBe('Paratsetamol');
      expect(res.body.data.pharmacopoeia).toBe('USP');
      expect(res.body.data.parameters).toHaveLength(2);
      expect(res.body.data.parameters[1].specMin).toBe(168);
      createdSubstanceId = res.body.data.id;
    });

    it('barcha kompaniya rollari (kontrolyor, chemist, lab_head, director, admin) moddani ko‘ra oladi', async () => {
      for (const token of [
        tokenKontrolyorA,
        tokenChemistA,
        tokenLabHeadA,
        tokenDirectorA,
        tokenAdminA,
      ]) {
        const listRes = await request(app)
          .get('/api/v1/substances')
          .set('Authorization', `Bearer ${token}`);
        expect(listRes.status).toBe(200);
        expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);

        const getRes = await request(app)
          .get(`/api/v1/substances/${createdSubstanceId}`)
          .set('Authorization', `Bearer ${token}`);
        expect(getRes.status).toBe(200);
        expect(getRes.body.data.nameUz).toBe('Paratsetamol');
        expect(getRes.body.data.parameters).toHaveLength(2);
      }
    });

    it('kontrolyor, chemist va director modda yarata olmaydi (403)', async () => {
      for (const token of [tokenKontrolyorA, tokenChemistA, tokenDirectorA]) {
        const res = await request(app)
          .post('/api/v1/substances')
          .set('Authorization', `Bearer ${token}`)
          .send({
            nameUz: 'Aspirin',
            pharmacopoeia: 'EP',
          });
        expect(res.status).toBe(403);
      }
    });

    it('kontrolyor, chemist va director moddani tahrirlay olmaydi (403)', async () => {
      for (const token of [tokenKontrolyorA, tokenChemistA, tokenDirectorA]) {
        const res = await request(app)
          .put(`/api/v1/substances/${createdSubstanceId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            nameUz: 'Yangi nom',
          });
        expect(res.status).toBe(403);
      }
    });

    it('lab_head moddani tahrirlay oladi (200)', async () => {
      const res = await request(app)
        .put(`/api/v1/substances/${createdSubstanceId}`)
        .set('Authorization', `Bearer ${tokenLabHeadA}`)
        .send({
          nameUz: 'Paratsetamol moddasi',
          description: 'Yangilangan tavsif',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.nameUz).toBe('Paratsetamol moddasi');
      expect(res.body.data.description).toBe('Yangilangan tavsif');
    });

    it('lab_head moddani o‘chira olmaydi (403, D-30, R-SUBST-10)', async () => {
      const res = await request(app)
        .delete(`/api/v1/substances/${createdSubstanceId}`)
        .set('Authorization', `Bearer ${tokenLabHeadA}`);
      expect(res.status).toBe(403);
    });

    it('kontrolyor, chemist va director moddani o‘chira olmaydi (403)', async () => {
      for (const token of [tokenKontrolyorA, tokenChemistA, tokenDirectorA]) {
        const res = await request(app)
          .delete(`/api/v1/substances/${createdSubstanceId}`)
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
      }
    });

    it('super_admin kompaniya moddalar endpointlariga kira olmaydi (400/403 CompanyRequired)', async () => {
      const res = await request(app)
        .get('/api/v1/substances')
        .set('Authorization', `Bearer ${tokenSuperAdmin}`);
      expect([400, 403]).toContain(res.status);
    });

    it('admin moddani o‘chira oladi (204, D-30, R-SUBST-10)', async () => {
      const res = await request(app)
        .delete(`/api/v1/substances/${createdSubstanceId}`)
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(res.status).toBe(204);

      // O'chirilganini tekshirish
      const getRes = await request(app)
        .get(`/api/v1/substances/${createdSubstanceId}`)
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(getRes.status).toBe(404);
    });
  });

  describe('Validatsiya va Tranzaksiya (R-SUBST-01..05)', () => {
    it('nameUz majburiy — bo‘sh bo‘lsa 400', async () => {
      const res = await request(app)
        .post('/api/v1/substances')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          nameUz: '',
          pharmacopoeia: 'EP',
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('farmakopiya faqat EP, BP, UzDSt, USP, OTHER qabul qilinadi — boshqasi 400 (R-SUBST-03)', async () => {
      const res = await request(app)
        .post('/api/v1/substances')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          nameUz: 'Analgin',
          pharmacopoeia: 'INVALID_PHARM',
        });
      expect(res.status).toBe(400);
    });

    it('specMin > specMax bo‘lsa rad etiladi (400)', async () => {
      const res = await request(app)
        .post('/api/v1/substances')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          nameUz: 'Ibuprofen',
          pharmacopoeia: 'BP',
          parameters: [
            {
              parameterName: 'Zichlik',
              specMin: 15.0,
              specMax: 10.0, // xato!
            },
          ],
        });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.error)).toContain('Minimal');
    });

    it('takror parametr nomi bo‘lsa rad etiladi (400)', async () => {
      const res = await request(app)
        .post('/api/v1/substances')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          nameUz: 'Ibuprofen',
          pharmacopoeia: 'BP',
          parameters: [
            { parameterName: 'Erish harorati' },
            { parameterName: 'erish harorati ' }, // bir xil nom!
          ],
        });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.error)).toContain('Takror');
    });

    it('parametr xatosi bo‘lganda tranzaksiya to‘liq bekor qilinadi (modda ham saqlanmaydi)', async () => {
      const countBefore = await query<{ count: string }>(
        `SELECT count(*)::text FROM substances WHERE company_id = $1`,
        [companyA.id],
      );

      const res = await request(app)
        .post('/api/v1/substances')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          nameUz: 'Tranzaksiya test moddasi',
          pharmacopoeia: 'BP',
          parameters: [
            {
              parameterName: 'Xato parametr',
              specMin: 50,
              specMax: 10,
            },
          ],
        });
      expect(res.status).toBe(400);

      const countAfter = await query<{ count: string }>(
        `SELECT count(*)::text FROM substances WHERE company_id = $1`,
        [companyA.id],
      );
      expect(countAfter.rows[0]?.count).toBe(countBefore.rows[0]?.count);
    });
  });

  describe('Qidiruv, filtr va sahifalash', () => {
    let sub1Id: string;
    let sub2Id: string;

    beforeAll(async () => {
      const res1 = await request(app)
        .post('/api/v1/substances')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          nameUz: 'Atsetilsalitsil kislotasi',
          nameRu: 'Ацетилсалициловая кислота',
          nameEn: 'Acetylsalicylic acid',
          pharmacopoeia: 'EP',
          casNumber: '50-78-2',
        });
      sub1Id = res1.body.data.id;

      const res2 = await request(app)
        .post('/api/v1/substances')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          nameUz: 'Amoksitsillin trigidrat',
          nameRu: 'Амоксициллин тригидрат',
          nameEn: 'Amoxicillin trihydrate',
          pharmacopoeia: 'UzDSt',
          casNumber: '61336-70-7',
        });
      sub2Id = res2.body.data.id;
    });

    it('nom va CAS bo‘yicha qidiruv uch tilda ishlaydi', async () => {
      // O'zbekcha qidiruv
      const uzRes = await request(app)
        .get('/api/v1/substances?search=kislotasi')
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(uzRes.status).toBe(200);
      expect(uzRes.body.data.some((s: { id: string }) => s.id === sub1Id)).toBe(true);
      expect(uzRes.body.data.some((s: { id: string }) => s.id === sub2Id)).toBe(false);

      // Ruscha qidiruv
      const ruRes = await request(app)
        .get('/api/v1/substances?search=Амоксициллин')
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(ruRes.status).toBe(200);
      expect(ruRes.body.data.some((s: { id: string }) => s.id === sub2Id)).toBe(true);

      // Inglizcha qidiruv
      const enRes = await request(app)
        .get('/api/v1/substances?search=Acetylsalicylic')
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(enRes.status).toBe(200);
      expect(enRes.body.data.some((s: { id: string }) => s.id === sub1Id)).toBe(true);

      // CAS bo'yicha qidiruv
      const casRes = await request(app)
        .get('/api/v1/substances?search=61336-70-7')
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(casRes.status).toBe(200);
      expect(casRes.body.data.some((s: { id: string }) => s.id === sub2Id)).toBe(true);
    });

    it('farmakopiya bo‘yicha filtr ishlaydi', async () => {
      const epRes = await request(app)
        .get('/api/v1/substances?pharmacopoeia=EP')
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(epRes.status).toBe(200);
      expect(epRes.body.data.every((s: { pharmacopoeia: string }) => s.pharmacopoeia === 'EP')).toBe(true);
    });
  });

  describe('Tenant izolyatsiyasi', () => {
    let substanceAId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/substances')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          nameUz: 'Kompaniya A maxfiy moddasi',
          pharmacopoeia: 'OTHER',
        });
      substanceAId = res.body.data.id;
    });

    it('Kompaniya B foydalanuvchisi Kompaniya A moddasini ko‘ra olmaydi (404)', async () => {
      const res = await request(app)
        .get(`/api/v1/substances/${substanceAId}`)
        .set('Authorization', `Bearer ${tokenAdminB}`);
      expect(res.status).toBe(404);
    });

    it('Kompaniya B foydalanuvchisi Kompaniya A moddasini ro‘yxatda ko‘rmaydi', async () => {
      const res = await request(app)
        .get('/api/v1/substances')
        .set('Authorization', `Bearer ${tokenAdminB}`);
      expect(res.status).toBe(200);
      expect(res.body.data.some((s: { id: string }) => s.id === substanceAId)).toBe(false);
    });

    it('Kompaniya B foydalanuvchisi Kompaniya A moddasini tahrirlay olmaydi (404)', async () => {
      const res = await request(app)
        .put(`/api/v1/substances/${substanceAId}`)
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .send({ nameUz: 'B tomonidan buzilgan nom' });
      expect(res.status).toBe(404);
    });

    it('Kompaniya B foydalanuvchisi Kompaniya A moddasini o‘chira olmaydi (404)', async () => {
      const res = await request(app)
        .delete(`/api/v1/substances/${substanceAId}`)
        .set('Authorization', `Bearer ${tokenAdminB}`);
      expect(res.status).toBe(404);
    });
  });

  describe('Audit jurnali (D-62, D-64)', () => {
    it('modda yaratish, tahrirlash va o‘chirish audit_log ga yoziladi', async () => {
      // 1. Create
      const createRes = await request(app)
        .post('/api/v1/substances')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          nameUz: 'Audit tekshiruv moddasi',
          pharmacopoeia: 'USP',
        });
      const subId = createRes.body.data.id;

      // 2. Update
      await request(app)
        .put(`/api/v1/substances/${subId}`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          description: 'Audit tavsifi',
        });

      // 3. Delete
      await request(app)
        .delete(`/api/v1/substances/${subId}`)
        .set('Authorization', `Bearer ${tokenAdminA}`);

      // Check audit_log records
      const logsRes = await query<{ action: string; table_name: string; record_id: string }>(
        `SELECT action, table_name, record_id FROM audit_log
         WHERE table_name = 'substances' AND record_id = $1
         ORDER BY created_at ASC`,
        [subId],
      );

      expect(logsRes.rows.map((r) => r.action)).toEqual(['create', 'update', 'delete']);
    });
  });
});
