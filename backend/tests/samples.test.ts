import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { query } from '../src/config/database.js';
import * as auditService from '../src/modules/audit/audit.service.js';
import { sampleHooks } from '../src/modules/samples/samples.hooks.js';
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

describeDb('samples: core, tracking, state machine, RBAC, isolation and hooks', () => {
  let db: Db;
  let app: express.Express;
  let companyA: TestCompany;
  let companyB: TestCompany;

  let kontrolyorA1: TestUser;
  let kontrolyorA2: TestUser;
  let chemistA1: TestUser;
  let chemistA2: TestUser;
  let chemistAInactive: TestUser;
  let labHeadA: TestUser;
  let directorA: TestUser;
  let adminA: TestUser;
  let superAdmin: TestUser;

  let tokenKontrolyorA1: string;
  let tokenKontrolyorA2: string;
  let tokenChemistA1: string;
  let tokenChemistA2: string;
  let tokenLabHeadA: string;
  let tokenDirectorA: string;
  let tokenAdminA: string;
  let tokenSuperAdmin: string;

  let chemistB: TestUser;
  let labHeadB: TestUser;
  let adminB: TestUser;
  let tokenLabHeadB: string;
  let tokenAdminB: string;

  let substanceIdA: string;

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp().app;

    companyA = await createCompany({ name: 'Pharm Alpha' });
    companyB = await createCompany({ name: 'Pharm Beta' });

    kontrolyorA1 = await createUser({ role: 'kontrolyor', company: companyA });
    kontrolyorA2 = await createUser({ role: 'kontrolyor', company: companyA });
    chemistA1 = await createUser({ role: 'chemist', company: companyA });
    chemistA2 = await createUser({ role: 'chemist', company: companyA });
    chemistAInactive = await createUser({
      role: 'chemist',
      company: companyA,
      isActive: false,
    });
    labHeadA = await createUser({ role: 'lab_head', company: companyA });
    directorA = await createUser({ role: 'director', company: companyA });
    adminA = await createUser({ role: 'admin', company: companyA });
    superAdmin = await createUser({ role: 'super_admin' });

    chemistB = await createUser({ role: 'chemist', company: companyB });
    labHeadB = await createUser({ role: 'lab_head', company: companyB });
    adminB = await createUser({ role: 'admin', company: companyB });

    tokenKontrolyorA1 = (await loginAs(app, kontrolyorA1)).accessToken;
    tokenKontrolyorA2 = (await loginAs(app, kontrolyorA2)).accessToken;
    tokenChemistA1 = (await loginAs(app, chemistA1)).accessToken;
    tokenChemistA2 = (await loginAs(app, chemistA2)).accessToken;
    tokenLabHeadA = (await loginAs(app, labHeadA)).accessToken;
    tokenDirectorA = (await loginAs(app, directorA)).accessToken;
    tokenAdminA = (await loginAs(app, adminA)).accessToken;
    tokenSuperAdmin = (await loginAs(app, superAdmin)).accessToken;
    tokenLabHeadB = (await loginAs(app, labHeadB)).accessToken;
    tokenAdminB = (await loginAs(app, adminB)).accessToken;

    // Kompaniya A uchun bitta modda yaratamiz
    const subRes = await query<{ id: string }>(
      `INSERT INTO substances (name_uz, pharmacopoeia, company_id, created_by)
       VALUES ('Paratsetamol', 'USP', $1, $2) RETURNING id`,
      [companyA.id, adminA.id],
    );
    substanceIdA = subRes.rows[0]!.id;
  });

  afterAll(async () => {
    await db.teardown();
  });

  describe('RBAC: Namuna yaratish (R-ROLE-08..12, R-SAMPLE-13, 14)', () => {
    it('kontrolyor muvaffaqiyatli namuna yaratadi (201), status pending_assignment bo‘ladi', async () => {
      const res = await request(app)
        .post('/api/v1/samples')
        .set('Authorization', `Bearer ${tokenKontrolyorA1}`)
        .send({
          type: 'raw_material',
          substanceId: substanceIdA,
          substanceName: 'Paratsetamol',
          lotNumber: 'LOT-101',
          serialNumber: 'SN-001',
          quantity: '50 kg',
          manufacturer: 'BioPharm',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        type: 'raw_material',
        status: 'pending_assignment',
        substanceName: 'Paratsetamol',
        lotNumber: 'LOT-101',
        serialNumber: 'SN-001',
        createdBy: kontrolyorA1.id,
      });

      // sample_tracking tekshiruvi (R-SAMPLE-31)
      const trackRes = await query<{ event_type: string; to_status: string; user_id: string }>(
        `SELECT event_type, to_status, user_id FROM sample_tracking WHERE sample_id = $1`,
        [res.body.data.id],
      );
      expect(trackRes.rows.length).toBe(1);
      expect(trackRes.rows[0]).toMatchObject({
        event_type: 'sample_created',
        to_status: 'pending_assignment',
        user_id: kontrolyorA1.id,
      });

      // audit log tekshiruvi (D-64)
      const auditRes = await query<{ action: string; table_name: string }>(
        `SELECT action, table_name FROM audit_log WHERE record_id = $1`,
        [res.body.data.id],
      );
      expect(auditRes.rows.length).toBeGreaterThanOrEqual(1);
      expect(auditRes.rows[0]).toMatchObject({
        action: 'create',
        table_name: 'samples',
      });
    });

    it('boshqa rollar (chemist, lab_head, director, admin) namuna yarata olmaydi (403)', async () => {
      const payload = {
        type: 'raw_material',
        substanceName: 'Aspirin',
      };

      for (const token of [
        tokenChemistA1,
        tokenLabHeadA,
        tokenDirectorA,
        tokenAdminA,
      ]) {
        const res = await request(app)
          .post('/api/v1/samples')
          .set('Authorization', `Bearer ${token}`)
          .send(payload);
        expect(res.status).toBe(403);
      }
    });

    it('super_admin namuna yarata olmaydi (403 CompanyRequired)', async () => {
      const res = await request(app)
        .post('/api/v1/samples')
        .set('Authorization', `Bearer ${tokenSuperAdmin}`)
        .send({ type: 'raw_material', substanceName: 'Aspirin' });
      expect(res.status).toBe(403);
    });

    it('noto‘g‘ri namuna turi rad etiladi (in_process yo‘q — D-72, R-SAMPLE-06)', async () => {
      const res = await request(app)
        .post('/api/v1/samples')
        .set('Authorization', `Bearer ${tokenKontrolyorA1}`)
        .send({
          type: 'in_process',
          substanceName: 'Paratsetamol',
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Ko‘rinish qoidalari (spec §1, Q-04, R-ROLE-13..17, R-SAMPLE-28)', () => {
    let sampleK1: string;
    let sampleK2: string;

    beforeAll(async () => {
      // kontrolyorA1 namuna yaratadi
      const res1 = await request(app)
        .post('/api/v1/samples')
        .set('Authorization', `Bearer ${tokenKontrolyorA1}`)
        .send({ type: 'raw_material', substanceName: 'Namuna K1' });
      sampleK1 = res1.body.data.id;

      // kontrolyorA2 namuna yaratadi
      const res2 = await request(app)
        .post('/api/v1/samples')
        .set('Authorization', `Bearer ${tokenKontrolyorA2}`)
        .send({ type: 'finished_product', substanceName: 'Namuna K2' });
      sampleK2 = res2.body.data.id;

      // sampleK1 ni chemistA1 ga biriktiramiz
      await request(app)
        .post(`/api/v1/samples/${sampleK1}/assign`)
        .set('Authorization', `Bearer ${tokenLabHeadA}`)
        .send({ chemistId: chemistA1.id });
    });

    it('kontrolyor faqat o‘zi yaratgan namunalarni ko‘radi (R-ROLE-13)', async () => {
      const listRes = await request(app)
        .get('/api/v1/samples')
        .set('Authorization', `Bearer ${tokenKontrolyorA1}`);
      expect(listRes.status).toBe(200);
      const names = listRes.body.data.map((s: { substanceName: string }) => s.substanceName);
      expect(names).toContain('Namuna K1');
      expect(names).not.toContain('Namuna K2');

      // Boshqa kontrolyorning namunasiga to'g'ridan-to'g'ri GET qilsa 404 qaytadi (D-102)
      const detailRes = await request(app)
        .get(`/api/v1/samples/${sampleK2}`)
        .set('Authorization', `Bearer ${tokenKontrolyorA1}`);
      expect(detailRes.status).toBe(404);
    });

    it('kimyogar faqat o‘ziga biriktirilgan namunalarni ko‘radi (R-ROLE-14, R-SAMPLE-28)', async () => {
      const listRes = await request(app)
        .get('/api/v1/samples')
        .set('Authorization', `Bearer ${tokenChemistA1}`);
      expect(listRes.status).toBe(200);
      const names = listRes.body.data.map((s: { substanceName: string }) => s.substanceName);
      expect(names).toContain('Namuna K1');
      expect(names).not.toContain('Namuna K2');

      // chemistA2 o'ziga biriktirilmagan namunaK1 ga murojaat qilsa 404
      const detailRes = await request(app)
        .get(`/api/v1/samples/${sampleK1}`)
        .set('Authorization', `Bearer ${tokenChemistA2}`);
      expect(detailRes.status).toBe(404);
    });

    it('lab_head, director va admin kompaniyaning barcha namunalarini ko‘radi (R-ROLE-15..17)', async () => {
      for (const token of [tokenLabHeadA, tokenDirectorA, tokenAdminA]) {
        const listRes = await request(app)
          .get('/api/v1/samples')
          .set('Authorization', `Bearer ${token}`);
        expect(listRes.status).toBe(200);
        const names = listRes.body.data.map((s: { substanceName: string }) => s.substanceName);
        expect(names).toContain('Namuna K1');
        expect(names).toContain('Namuna K2');

        const detailRes = await request(app)
          .get(`/api/v1/samples/${sampleK1}`)
          .set('Authorization', `Bearer ${token}`);
        expect(detailRes.status).toBe(200);
        expect(detailRes.body.data.tracking.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('Biriktirish va Qayta biriktirish (R-ROLE-18..22, R-SAMPLE-15, 18, 35, 36, R-PASS-23)', () => {
    let sampleForAssign: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/samples')
        .set('Authorization', `Bearer ${tokenKontrolyorA1}`)
        .send({ type: 'raw_material', substanceName: 'Xom ashyo X' });
      sampleForAssign = res.body.data.id;
    });

    it('faqat lab_head biriktira oladi (R-ROLE-18..22)', async () => {
      for (const token of [
        tokenKontrolyorA1,
        tokenChemistA1,
        tokenDirectorA,
        tokenAdminA,
      ]) {
        const res = await request(app)
          .post(`/api/v1/samples/${sampleForAssign}/assign`)
          .set('Authorization', `Bearer ${token}`)
          .send({ chemistId: chemistA1.id });
        expect(res.status).toBe(403);
      }
    });

    it('lab_head biriktirganda pending_assignment -> in_progress bo‘ladi va hooklar chaqiriladi', async () => {
      const assignedSpy = vi.spyOn(sampleHooks, 'onSampleAssigned');
      const statusSpy = vi.spyOn(sampleHooks, 'onSampleStatusChanged');

      const res = await request(app)
        .post(`/api/v1/samples/${sampleForAssign}/assign`)
        .set('Authorization', `Bearer ${tokenLabHeadA}`)
        .send({ chemistId: chemistA1.id });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('in_progress');
      expect(res.body.data.assignedTo).toBe(chemistA1.id);

      expect(assignedSpy).toHaveBeenCalledTimes(1);
      expect(statusSpy).toHaveBeenCalledWith(
        expect.anything(),
        'pending_assignment',
        'in_progress',
        labHeadA.id,
        expect.anything(),
      );

      assignedSpy.mockRestore();
      statusSpy.mockRestore();

      // Tracking'ga 'assigned' yozilganini tekshirish
      const trackRes = await query<{ event_type: string; from_status: string; to_status: string }>(
        `SELECT event_type, from_status, to_status FROM sample_tracking WHERE sample_id = $1 AND event_type = 'assigned'`,
        [sampleForAssign],
      );
      expect(trackRes.rows.length).toBe(1);
      expect(trackRes.rows[0]).toMatchObject({
        event_type: 'assigned',
        from_status: 'pending_assignment',
        to_status: 'in_progress',
      });
    });

    it('in_progress holatida boshqa kimyogarga qayta biriktirish (reassign) ruxsat etiladi (Q-15, D-37, R-SAMPLE-35)', async () => {
      // 1. Dastlabki biriktirish
      await request(app)
        .post(`/api/v1/samples/${sampleForAssign}/assign`)
        .set('Authorization', `Bearer ${tokenLabHeadA}`)
        .send({ chemistId: chemistA1.id });

      // 2. Qayta biriktirish
      const res = await request(app)
        .post(`/api/v1/samples/${sampleForAssign}/assign`)
        .set('Authorization', `Bearer ${tokenLabHeadA}`)
        .send({ chemistId: chemistA2.id });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('in_progress');
      expect(res.body.data.assignedTo).toBe(chemistA2.id);

      const trackRes = await query<{ event_type: string }>(
        `SELECT event_type FROM sample_tracking WHERE sample_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [sampleForAssign],
      );
      expect(trackRes.rows[0]!.event_type).toBe('reassigned');
    });

    it('reagent va standard_substance ga kimyogar biriktirib bo‘lmaydi (422, R-PASS-23, D-39)', async () => {
      const resReagent = await request(app)
        .post('/api/v1/samples')
        .set('Authorization', `Bearer ${tokenKontrolyorA1}`)
        .send({ type: 'reagent', substanceName: 'Reaktiv 1' });

      const assignRes = await request(app)
        .post(`/api/v1/samples/${resReagent.body.data.id}/assign`)
        .set('Authorization', `Bearer ${tokenLabHeadA}`)
        .send({ chemistId: chemistA1.id });

      expect(assignRes.status).toBe(422);
      expect(assignRes.body.error.code).toBe('INVALID_SAMPLE_TYPE_FOR_ASSIGNMENT');
    });

    it('boshqa kompaniya kimyogariga biriktirib bo‘lmaydi (404)', async () => {
      const res = await request(app)
        .post(`/api/v1/samples/${sampleForAssign}/assign`)
        .set('Authorization', `Bearer ${tokenLabHeadA}`)
        .send({ chemistId: chemistB.id });
      expect(res.status).toBe(404);
    });

    it('roli chemist bo‘lmagan foydalanuvchiga biriktirib bo‘lmaydi (422)', async () => {
      const res = await request(app)
        .post(`/api/v1/samples/${sampleForAssign}/assign`)
        .set('Authorization', `Bearer ${tokenLabHeadA}`)
        .send({ chemistId: adminA.id });
      expect(res.status).toBe(422);
    });

    it('nofaol kimyogarga biriktirib bo‘lmaydi (422 ACCOUNT_INACTIVE)', async () => {
      const res = await request(app)
        .post(`/api/v1/samples/${sampleForAssign}/assign`)
        .set('Authorization', `Bearer ${tokenLabHeadA}`)
        .send({ chemistId: chemistAInactive.id });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
    });
  });

  describe('Tahlilni to‘xtatish va davom ettirish (R-SAMPLE-19..22, 27, 37, 38)', () => {
    let sampleAssigned: string;

    beforeEach(async () => {
      const createRes = await request(app)
        .post('/api/v1/samples')
        .set('Authorization', `Bearer ${tokenKontrolyorA1}`)
        .send({ type: 'raw_material', substanceName: 'Namuna Stop Test' });
      sampleAssigned = createRes.body.data.id;

      await request(app)
        .post(`/api/v1/samples/${sampleAssigned}/assign`)
        .set('Authorization', `Bearer ${tokenLabHeadA}`)
        .send({ chemistId: chemistA1.id });
    });

    it('faqat biriktirilgan kimyogar to‘xtata oladi (lab_head va boshqalar taqiq — R-SAMPLE-37)', async () => {
      for (const token of [
        tokenLabHeadA,
        tokenAdminA,
        tokenChemistA2,
        tokenDirectorA,
      ]) {
        const res = await request(app)
          .post(`/api/v1/samples/${sampleAssigned}/stop`)
          .set('Authorization', `Bearer ${token}`)
          .send({ reason: 'Reaktiv yetishmadi' });
        expect(res.status).toBe(403);
      }
    });

    it('sabab 5 belgidan kam bo‘lsa rad etiladi (400, R-SAMPLE-20, 21)', async () => {
      const res = await request(app)
        .post(`/api/v1/samples/${sampleAssigned}/stop`)
        .set('Authorization', `Bearer ${tokenChemistA1}`)
        .send({ reason: '1234' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('sabab kamida 5 belgi bo‘lganda status stopped bo‘ladi va tracking yoziladi (R-SAMPLE-19, 21)', async () => {
      const statusSpy = vi.spyOn(sampleHooks, 'onSampleStatusChanged');

      const res = await request(app)
        .post(`/api/v1/samples/${sampleAssigned}/stop`)
        .set('Authorization', `Bearer ${tokenChemistA1}`)
        .send({ reason: 'Reagent yetishmadi' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('stopped');
      expect(res.body.data.stopReason).toBe('Reagent yetishmadi');

      expect(statusSpy).toHaveBeenCalledWith(
        expect.anything(),
        'in_progress',
        'stopped',
        chemistA1.id,
        expect.anything(),
      );
      statusSpy.mockRestore();

      // Qayta to'xtatishga urinish 409 INVALID_TRANSITION bo'ladi
      const resAgain = await request(app)
        .post(`/api/v1/samples/${sampleAssigned}/stop`)
        .set('Authorization', `Bearer ${tokenChemistA1}`)
        .send({ reason: 'Yana to‘xtatish' });
      expect(resAgain.status).toBe(409);
      expect(resAgain.body.error.code).toBe('INVALID_TRANSITION');
    });

    it('to‘xtatilgan namunani lab_head boshqa kimyogarga qayta biriktira oladi (R-SAMPLE-35)', async () => {
      await request(app)
        .post(`/api/v1/samples/${sampleAssigned}/stop`)
        .set('Authorization', `Bearer ${tokenChemistA1}`)
        .send({ reason: 'Vaqt yetmadi' });

      const reassignRes = await request(app)
        .post(`/api/v1/samples/${sampleAssigned}/assign`)
        .set('Authorization', `Bearer ${tokenLabHeadA}`)
        .send({ chemistId: chemistA2.id });
      expect(reassignRes.status).toBe(200);
      expect(reassignRes.body.data.assignedTo).toBe(chemistA2.id);
      expect(reassignRes.body.data.status).toBe('stopped');
    });

    it('biriktirilgan kimyogar to‘xtatilgan namunani davom ettiradi (stopped -> in_progress, R-SAMPLE-22, 38)', async () => {
      await request(app)
        .post(`/api/v1/samples/${sampleAssigned}/stop`)
        .set('Authorization', `Bearer ${tokenChemistA1}`)
        .send({ reason: 'To‘xtatildi sabab' });

      // Boshqa kimyogar davom ettira olmaydi
      const failResume = await request(app)
        .post(`/api/v1/samples/${sampleAssigned}/resume`)
        .set('Authorization', `Bearer ${tokenChemistA2}`)
        .send({});
      expect(failResume.status).toBe(403);

      // Biriktirilgan kimyogar muvaffaqiyatli davom ettiradi
      const resumeRes = await request(app)
        .post(`/api/v1/samples/${sampleAssigned}/resume`)
        .set('Authorization', `Bearer ${tokenChemistA1}`)
        .send({ reason: 'Ish qayta boshlandi' });

      expect(resumeRes.status).toBe(200);
      expect(resumeRes.body.data.status).toBe('in_progress');
      expect(resumeRes.body.data.stopReason).toBeNull();
    });
  });

  describe('Multi-tenant izolyatsiyasi', () => {
    let sampleA: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/samples')
        .set('Authorization', `Bearer ${tokenKontrolyorA1}`)
        .send({ type: 'raw_material', substanceName: 'Kompaniya A maxfiy namunasi' });
      sampleA = res.body.data.id;
    });

    it('boshqa kompaniya foydalanuvchisi namunani ko‘ra olmaydi (404)', async () => {
      const res = await request(app)
        .get(`/api/v1/samples/${sampleA}`)
        .set('Authorization', `Bearer ${tokenAdminB}`);
      expect(res.status).toBe(404);
    });

    it('boshqa kompaniya foydalanuvchisi namunaga biriktira olmaydi (404)', async () => {
      const res = await request(app)
        .post(`/api/v1/samples/${sampleA}/assign`)
        .set('Authorization', `Bearer ${tokenLabHeadB}`)
        .send({ chemistId: chemistB.id });
      expect(res.status).toBe(404);
    });
  });

  describe('P3 dagi R-SUBST-11 talabi: namuna bog‘langan moddani o‘chirish 409 xatosi beradi', () => {
    it('namuna bog‘langan moddani o‘chirish 409 CONFLICT beradi va modda saqlanib qoladi', async () => {
      // 1. Modda yaratamiz
      const createSubRes = await request(app)
        .post('/api/v1/substances')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          nameUz: 'Sinov Moddasi Bog‘langan',
          pharmacopoeia: 'BP',
        });
      expect(createSubRes.status).toBe(201);
      const testSubId = createSubRes.body.data.id;

      // 2. Shu moddaga bog'langan namuna yaratamiz
      const createSampleRes = await request(app)
        .post('/api/v1/samples')
        .set('Authorization', `Bearer ${tokenKontrolyorA1}`)
        .send({
          type: 'raw_material',
          substanceId: testSubId,
          substanceName: 'Sinov Moddasi Bog‘langan',
        });
      expect(createSampleRes.status).toBe(201);

      // 3. Moddani o'chirishga urinish -> 409 Conflict
      const deleteSubRes = await request(app)
        .delete(`/api/v1/substances/${testSubId}`)
        .set('Authorization', `Bearer ${tokenAdminA}`);

      expect(deleteSubRes.status).toBe(409);
      expect(deleteSubRes.body.error.code).toBe('CONFLICT');
      expect(deleteSubRes.body.error.message).toContain('namunalar mavjud');

      // 4. Modda bazada o'chirilmaganini tasdiqlaymiz
      const getSubRes = await request(app)
        .get(`/api/v1/substances/${testSubId}`)
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(getSubRes.status).toBe(200);
    });
  });

  describe('Tranzaksiya va rollback (D-64, withTransaction)', () => {
    it('namuna yaratishda xatolik yuz bersa, sample, tracking va audit butunlay rollback qilinadi', async () => {
      const spy = vi
        .spyOn(auditService, 'writeAudit')
        .mockRejectedValueOnce(new Error('Simulyatsiya qilingan audit xatosi'));

      const res = await request(app)
        .post('/api/v1/samples')
        .set('Authorization', `Bearer ${tokenKontrolyorA1}`)
        .send({
          type: 'raw_material',
          substanceName: 'Rollback Sinov Namunasi',
          lotNumber: 'RB-001',
        });

      expect(res.status).toBe(500);

      // Bazada namuna saqlanmaganini tasdiqlaymiz
      const sampleCheck = await query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM samples WHERE substance_name = 'Rollback Sinov Namunasi'`,
      );
      expect(Number(sampleCheck.rows[0]?.count ?? '0')).toBe(0);

      // sample_tracking ga ham yozilmagan
      const trackingCheck = await query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM sample_tracking WHERE metadata::text LIKE '%Rollback Sinov Namunasi%'`,
      );
      expect(Number(trackingCheck.rows[0]?.count ?? '0')).toBe(0);

      spy.mockRestore();
    });
  });

  describe('assigned_to_name va tenant izolyatsiyasi', () => {
    it('namuna biriktirilganda assigned_to_name kimyogar ismini qaytaradi, tenant izolyatsiyasi saqlanadi', async () => {
      // 1. Namuna yaratish
      const createRes = await request(app)
        .post('/api/v1/samples')
        .set('Authorization', `Bearer ${tokenKontrolyorA1}`)
        .send({
          type: 'raw_material',
          substanceName: 'Assigned Name Test Sample',
        });
      expect(createRes.status).toBe(201);
      const sampleId = createRes.body.data.id;

      // 2. Biriktirilmaganda assigned_to_name null
      const getInitial = await request(app)
        .get(`/api/v1/samples/${sampleId}`)
        .set('Authorization', `Bearer ${tokenLabHeadA}`);
      expect(getInitial.status).toBe(200);
      expect(getInitial.body.data.assignedToName).toBeNull();
      expect(getInitial.body.data.assigned_to_name).toBeNull();

      // 3. Kimyogarga biriktirish
      const assignRes = await request(app)
        .post(`/api/v1/samples/${sampleId}/assign`)
        .set('Authorization', `Bearer ${tokenLabHeadA}`)
        .send({ chemistId: chemistA1.id });
      expect(assignRes.status).toBe(200);
      expect(assignRes.body.data.assignedToName).toBe(chemistA1.fullName);
      expect(assignRes.body.data.assigned_to_name).toBe(chemistA1.fullName);

      // 4. listSamples (GET /api/v1/samples) da ham assigned_to_name chiqadi
      const listRes = await request(app)
        .get('/api/v1/samples')
        .set('Authorization', `Bearer ${tokenLabHeadA}`)
        .query({ search: 'Assigned Name Test Sample' });
      expect(listRes.status).toBe(200);
      const item = listRes.body.data.find((s: { id: string }) => s.id === sampleId);
      expect(item).toBeDefined();
      expect(item.assignedToName).toBe(chemistA1.fullName);
      expect(item.assigned_to_name).toBe(chemistA1.fullName);
    });
  });
});
