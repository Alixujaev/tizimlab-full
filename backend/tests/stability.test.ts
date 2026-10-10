import type express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { query } from '../src/config/database.js';
import { runStabilityReminderJob } from '../src/modules/stability/stability.job.js';
import { setNotificationChannel } from '../src/modules/notifications/notifications.service.js';
import type { NotificationDto } from '../src/modules/notifications/notifications.types.js';
import { testApp } from './helpers/app.js';
import { createCompany, createUser, loginAs, setupAuthDb, type TestUser } from './helpers/auth.js';
import { describeDb } from './helpers/db.js';

type Db = Awaited<ReturnType<typeof setupAuthDb>>;

describeDb('P9: Stabilizatsiya tekshiruvlari (spec §8, SCHEMA_DIFF P9, D-05, D-53..D-58, D-77, D-81, D-142..D-145)', () => {
  let db: Db;
  let app: express.Express;
  const tokens: Record<string, string> = {};
  const users: Record<string, TestUser> = {};
  let companyAId: string;
  let pushed: { userId: string; n: NotificationDto }[] = [];

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp().app;

    const a = await createCompany({ name: 'Alpha Stability Lab' });
    const b = await createCompany({ name: 'Beta Stability Lab' });
    companyAId = a.id;

    const specs: [string, TestUser['role'], typeof a | null][] = [
      ['admin', 'admin', a],
      ['labHead', 'lab_head', a],
      ['chemist', 'chemist', a],
      ['chemist2', 'chemist', a],
      ['kontrolyor', 'kontrolyor', a],
      ['director', 'director', a],
      ['adminB', 'admin', b],
      ['chemistB', 'chemist', b],
      ['superAdmin', 'super_admin', null],
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
    await query('DELETE FROM stability_results');
    await query('DELETE FROM stability_checkpoints');
    await query('DELETE FROM stability_studies');
    await query('DELETE FROM notifications');
  });

  afterEach(() => setNotificationChannel('test', null));

  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  // Helper to create sample
  async function createSample(
    companyId: string,
    createdBy: string,
    status = 'approved',
    type = 'raw_material',
  ) {
    const serial = `SN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const { rows } = await query<{ id: string }>(
      `INSERT INTO samples (company_id, serial_number, type, substance_name, status, created_by)
       VALUES ($1, $2, $3, 'Aspirin Substance', $4, $5)
       RETURNING id`,
      [companyId, serial, type, status, createdBy],
    );
    return rows[0]!.id;
  }

  describe('1. RBAC ruxsatlar matritsasi', () => {
    it('stability:view — barcha ichki rollar ko‘ra oladi, super_admin taqiqlanadi', async () => {
      for (const role of ['kontrolyor', 'chemist', 'labHead', 'director', 'admin']) {
        const res = await request(app).get('/api/v1/stability').set(auth(role));
        expect(res.status, `${role} 200 bo'lishi kerak`).toBe(200);
      }
      const saRes = await request(app).get('/api/v1/stability').set(auth('superAdmin'));
      expect(saRes.status).toBe(403);
    });

    it('stability:start — faqat lab_head, director, admin boshlay oladi; kontrolyor va chemist 403 (R-ROLE-58..62)', async () => {
      const sampleId = await createSample(companyAId, users.kontrolyor!.id, 'approved');

      const kRes = await request(app)
        .post('/api/v1/stability')
        .set(auth('kontrolyor'))
        .send({ sampleId });
      expect(kRes.status).toBe(403);

      const chRes = await request(app)
        .post('/api/v1/stability')
        .set(auth('chemist'))
        .send({ sampleId });
      expect(chRes.status).toBe(403);

      const lhRes = await request(app)
        .post('/api/v1/stability')
        .set(auth('labHead'))
        .send({ sampleId });
      expect(lhRes.status).toBe(201);
      expect(lhRes.body.status).toBe('active');
    });

    it('stability:record — kontrolyor taqiqlanadi (403), lab_head/admin/director ruxsat etiladi (R-ROLE-63..67)', async () => {
      const sampleId = await createSample(companyAId, users.kontrolyor!.id, 'approved');
      const studyRes = await request(app)
        .post('/api/v1/stability')
        .set(auth('admin'))
        .send({
          sampleId,
          checkpoints: [{ intervalTag: 'T3', dueDate: '2026-11-01', assignedTo: users.chemist!.id }],
        });
      const checkpointId = studyRes.body.checkpoints[0].id;

      // kontrolyor -> 403
      const kRes = await request(app)
        .post(`/api/v1/stability/checkpoints/${checkpointId}/results`)
        .set(auth('kontrolyor'))
        .send({
          results: [{ parameter: 'Assay', currentValue: '99.5%', resultStatus: 'pass' }],
        });
      expect(kRes.status).toBe(403);

      // lab_head -> 200
      const lhRes = await request(app)
        .post(`/api/v1/stability/checkpoints/${checkpointId}/results`)
        .set(auth('labHead'))
        .send({
          results: [{ parameter: 'Assay', currentValue: '99.5%', resultStatus: 'pass' }],
        });
      expect(lhRes.status).toBe(200);
    });

    it('R-ROLE-64: chemist faqat o‘ziga biriktirilgan checkpointga natija kirita oladi (D-53)', async () => {
      const sampleId = await createSample(companyAId, users.kontrolyor!.id, 'approved');
      const studyRes = await request(app)
        .post('/api/v1/stability')
        .set(auth('admin'))
        .send({
          sampleId,
          checkpoints: [
            { intervalTag: 'T3', dueDate: '2026-11-01', assignedTo: users.chemist!.id },
            { intervalTag: 'T6', dueDate: '2026-12-01', assignedTo: users.chemist2!.id },
          ],
        });
      const cp1Id = studyRes.body.checkpoints[0].id;
      const cp2Id = studyRes.body.checkpoints[1].id;

      // chemist cp1 ga biriktirilgan -> 200
      const okRes = await request(app)
        .post(`/api/v1/stability/checkpoints/${cp1Id}/results`)
        .set(auth('chemist'))
        .send({
          results: [{ parameter: 'Assay', currentValue: '98.9%', resultStatus: 'pass' }],
        });
      expect(okRes.status).toBe(200);

      // chemist cp2 ga biriktirilmagan -> 403 (R-ROLE-64)
      const forbiddenRes = await request(app)
        .post(`/api/v1/stability/checkpoints/${cp2Id}/results`)
        .set(auth('chemist'))
        .send({
          results: [{ parameter: 'Assay', currentValue: '98.9%', resultStatus: 'pass' }],
        });
      expect(forbiddenRes.status).toBe(403);
    });
  });

  describe('2. Stabilizatsiya tekshiruvini yaratish va shartlar', () => {
    it('R-STAB-01, R-STAB-02: faqat approved namunalar uchun boshlanadi; approved bo‘lmasa 400', async () => {
      const pendingSampleId = await createSample(
        companyAId,
        users.kontrolyor!.id,
        'pending_assignment',
      );
      const res = await request(app)
        .post('/api/v1/stability')
        .set(auth('admin'))
        .send({ sampleId: pendingSampleId });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SAMPLE_NOT_APPROVED');
    });

    it('R-STAB-03: barcha namuna turlari uchun ruxsat etiladi (finished_product, reagent, other, va h.k.)', async () => {
      for (const t of ['finished_product', 'reagent', 'standard_substance', 'other']) {
        const sId = await createSample(companyAId, users.kontrolyor!.id, 'approved', t);
        const res = await request(app)
          .post('/api/v1/stability')
          .set(auth('labHead'))
          .send({ sampleId: sId });
        expect(res.status, `${t} uchun 201 bo'lishi kerak`).toBe(201);
      }
    });

    it('R-STAB-36, D-58: bitta namunada bir vaqtda faqat bitta faol (active) study; ikkinchisi 409', async () => {
      const sId = await createSample(companyAId, users.kontrolyor!.id, 'approved');
      const res1 = await request(app)
        .post('/api/v1/stability')
        .set(auth('admin'))
        .send({ sampleId: sId });
      expect(res1.status).toBe(201);

      const res2 = await request(app)
        .post('/api/v1/stability')
        .set(auth('admin'))
        .send({ sampleId: sId });
      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('ACTIVE_STABILITY_EXISTS');
    });

    it('R-STAB-20, D-05, D-77: 5 ta standart parametr oldindan to‘ldiriladi', async () => {
      const sId = await createSample(companyAId, users.kontrolyor!.id, 'approved');
      const res = await request(app)
        .post('/api/v1/stability')
        .set(auth('admin'))
        .send({
          sampleId: sId,
          checkpoints: [{ intervalTag: 'T0-start', dueDate: '2026-10-15' }],
        });
      expect(res.status).toBe(201);
      const cp = res.body.checkpoints[0];
      expect(cp.results.length).toBe(5);
      const paramNames = cp.results.map((r: { parameter: string }) => r.parameter);
      expect(paramNames).toContain('Tavsif (Description)');
      expect(paramNames).toContain('Assay');
      expect(paramNames).toContain('Namlik miqdori (Water content)');
      expect(paramNames).toContain("Qo'shimcha aralashmalar (Related substances)");
      expect(paramNames).toContain('Eruvchanlik (Dissolution)');
    });
  });

  describe('3. Checkpointlar boshqaruvi va natijalar kiritish', () => {
    it('R-STAB-07: bir study ichida bir xil nomli checkpoint qo‘shish rad etiladi (400/409)', async () => {
      const sId = await createSample(companyAId, users.kontrolyor!.id, 'approved');
      const studyRes = await request(app)
        .post('/api/v1/stability')
        .set(auth('admin'))
        .send({
          sampleId: sId,
          checkpoints: [{ intervalTag: 'T3', dueDate: '2026-11-01' }],
        });
      const studyId = studyRes.body.id;

      const dupRes = await request(app)
        .post(`/api/v1/stability/${studyId}/checkpoints`)
        .set(auth('admin'))
        .send({ intervalTag: 'T3', dueDate: '2026-11-15' });
      expect(dupRes.status).toBe(409);
    });

    it('R-STAB-10, R-STAB-14, D-55: pending → in_progress natija kiritilganda avtomatik o‘tadi', async () => {
      const sId = await createSample(companyAId, users.kontrolyor!.id, 'approved');
      const studyRes = await request(app)
        .post('/api/v1/stability')
        .set(auth('admin'))
        .send({
          sampleId: sId,
          checkpoints: [{ intervalTag: 'T6', dueDate: '2026-12-01' }],
        });
      const cpId = studyRes.body.checkpoints[0].id;
      expect(studyRes.body.checkpoints[0].status).toBe('pending');

      const recRes = await request(app)
        .post(`/api/v1/stability/checkpoints/${cpId}/results`)
        .set(auth('admin'))
        .send({
          results: [{ parameter: 'Assay', currentValue: '99.1%', resultStatus: 'pass' }],
        });
      expect(recRes.status).toBe(200);
      expect(recRes.body.status).toBe('in_progress');
    });

    it('R-STAB-31, D-54: natijasi bor checkpointni o‘chirib bo‘lmaydi (409)', async () => {
      const sId = await createSample(companyAId, users.kontrolyor!.id, 'approved');
      const studyRes = await request(app)
        .post('/api/v1/stability')
        .set(auth('admin'))
        .send({
          sampleId: sId,
          checkpoints: [{ intervalTag: 'T9', dueDate: '2027-01-01' }],
        });
      const cpId = studyRes.body.checkpoints[0].id;

      // Natija kiritish
      await request(app)
        .post(`/api/v1/stability/checkpoints/${cpId}/results`)
        .set(auth('admin'))
        .send({
          results: [{ parameter: 'Assay', currentValue: '99.0%', resultStatus: 'pass' }],
        });

      // O'chirishga urinish -> 409
      const delRes = await request(app)
        .delete(`/api/v1/stability/checkpoints/${cpId}`)
        .set(auth('admin'));
      expect(delRes.status).toBe(409);
      expect(delRes.body.error.code).toBe('CHECKPOINT_HAS_RESULTS');
    });

    it('R-STAB-32, D-55, R-STAB-34, D-56: barcha parametrlar to‘ldirilgach completed bo‘ladi va barcha checkpointlar tugasa study completed bo‘ladi', async () => {
      const sId = await createSample(companyAId, users.kontrolyor!.id, 'approved');
      const studyRes = await request(app)
        .post('/api/v1/stability')
        .set(auth('admin'))
        .send({
          sampleId: sId,
          parameters: [
            { parameter: 'Assay', initialValue: '99.8%' },
            { parameter: 'Namlik', initialValue: '0.5%' },
          ],
          checkpoints: [{ intervalTag: 'T3', dueDate: '2026-11-01' }],
        });
      const studyId = studyRes.body.id;
      const cpId = studyRes.body.checkpoints[0].id;

      // 1-ta parametr kiritildi, 2-chisi yo'q -> complete rad etiladi
      await request(app)
        .post(`/api/v1/stability/checkpoints/${cpId}/results`)
        .set(auth('admin'))
        .send({
          results: [{ parameter: 'Assay', currentValue: '99.5%', resultStatus: 'pass' }],
        });

      const failedComplete = await request(app)
        .post(`/api/v1/stability/checkpoints/${cpId}/complete`)
        .set(auth('admin'));
      expect(failedComplete.status).toBe(400);
      expect(failedComplete.body.error.code).toBe('INCOMPLETE_RESULTS');

      // 2-chi parametr ham to'ldiriladi
      await request(app)
        .post(`/api/v1/stability/checkpoints/${cpId}/results`)
        .set(auth('admin'))
        .send({
          results: [{ parameter: 'Namlik', currentValue: '0.6%', resultStatus: 'pass' }],
        });

      const successComplete = await request(app)
        .post(`/api/v1/stability/checkpoints/${cpId}/complete`)
        .set(auth('admin'));
      expect(successComplete.status).toBe(200);
      expect(successComplete.body.status).toBe('completed');

      // Barcha checkpointlar yakunlangani sababli study ham avtomatik completed bo'lishi kerak (R-STAB-34, D-56)
      const stRes = await request(app).get(`/api/v1/stability/${studyId}`).set(auth('admin'));
      expect(stRes.body.status).toBe('completed');
    });
  });

  describe('4. R-REG-15: Faol stabilizatsiyasi bor namunani reyestrdan o‘chirish taqiqlanadi (D-43)', () => {
    it('namunada active study bo‘lsa soft-delete 409 qaytaradi, study yakunlangach ruxsat etiladi', async () => {
      const sId = await createSample(companyAId, users.kontrolyor!.id, 'approved');
      const studyRes = await request(app)
        .post('/api/v1/stability')
        .set(auth('admin'))
        .send({
          sampleId: sId,
          parameters: [{ parameter: 'Assay' }],
          checkpoints: [{ intervalTag: 'T1', dueDate: '2026-11-01' }],
        });
      const cpId = studyRes.body.checkpoints[0].id;

      // Active study bor -> delete 409
      const delSampleRes = await request(app).delete(`/api/v1/registry/${sId}`).set(auth('admin'));
      expect(delSampleRes.status).toBe(409);
      expect(delSampleRes.body.error.code).toBe('ACTIVE_STABILITY');

      // Checkpointni yakunlaymiz -> study completed bo'ladi
      await request(app)
        .post(`/api/v1/stability/checkpoints/${cpId}/results`)
        .set(auth('admin'))
        .send({ results: [{ parameter: 'Assay', currentValue: '99%', resultStatus: 'pass' }] });
      await request(app).post(`/api/v1/stability/checkpoints/${cpId}/complete`).set(auth('admin'));

      // Endi soft-delete o'tadi
      const okDel = await request(app).delete(`/api/v1/registry/${sId}`).set(auth('admin'));
      expect(okDel.status).toBe(204);
    });
  });

  describe('5. 6-soatlik Job va Idempotentlik (R-STAB-23..28)', () => {
    it('muddati yaqin (<= 14 kun) bo‘lgan checkpoint uchun stability_due_soon yuboriladi va 24 soatda takrorlanmaydi', async () => {
      const sId = await createSample(companyAId, users.kontrolyor!.id, 'approved');
      // Due in 5 days
      const now = new Date('2026-10-10T10:00:00Z');
      const dueDate = '2026-10-15';

      await request(app)
        .post('/api/v1/stability')
        .set(auth('admin'))
        .send({
          sampleId: sId,
          checkpoints: [{ intervalTag: 'T-Soon', dueDate, assignedTo: users.chemist!.id }],
        });

      // 1-marta ishlatamiz
      const res1 = await runStabilityReminderJob({ now });
      expect(res1.executed).toBe(true);
      expect(res1.dueSoonNotifiedCount).toBe(1);
      expect(pushed.filter((p) => p.n.type === 'stability_due_soon').length).toBeGreaterThan(0);

      // 2-marta 2 soatdan keyin ishlatamiz -> 0 ta yangi xabarnoma (idempotent!)
      const nowPlus2h = new Date('2026-10-10T12:00:00Z');
      const res2 = await runStabilityReminderJob({ now: nowPlus2h });
      expect(res2.dueSoonNotifiedCount).toBe(0);

      // 25 soatdan keyin ishlatamiz -> qayta yuboriladi
      const nowPlus25h = new Date('2026-10-11T12:00:00Z');
      const res3 = await runStabilityReminderJob({ now: nowPlus25h });
      expect(res3.dueSoonNotifiedCount).toBe(1);
    });

    it('muddati o‘tgan (< now) checkpoint overdue qilinadi va stability_overdue faqat 1 marta yuboriladi', async () => {
      const sId = await createSample(companyAId, users.kontrolyor!.id, 'approved');
      const now = new Date('2026-10-10T10:00:00Z');
      const dueDate = '2026-10-01'; // past date

      const studyRes = await request(app)
        .post('/api/v1/stability')
        .set(auth('admin'))
        .send({
          sampleId: sId,
          checkpoints: [{ intervalTag: 'T-Past', dueDate, assignedTo: users.chemist!.id }],
        });
      const cpId = studyRes.body.checkpoints[0].id;

      // 1-marta job ishga tushadi
      const res1 = await runStabilityReminderJob({ now });
      expect(res1.executed).toBe(true);
      expect(res1.overdueCount).toBe(1);
      expect(res1.overdueNotifiedCount).toBe(1);

      // Checkpoint statusi overdue bo'lganini tekshiramiz (R-STAB-24)
      const cpRes = await request(app).get(`/api/v1/stability/checkpoints/${cpId}`).set(auth('admin'));
      expect(cpRes.body.status).toBe('overdue');

      // 2-marta ishga tushganda takroriy xabarnoma bo'lmaydi (Q-46, idempotent)
      const res2 = await runStabilityReminderJob({ now: new Date('2026-10-10T16:00:00Z') });
      expect(res2.overdueNotifiedCount).toBe(0);
    });

    it('R-STAB-17: completed bo‘lgan checkpoint hech qachon overdue deb belgilanmaydi', async () => {
      const sId = await createSample(companyAId, users.kontrolyor!.id, 'approved');
      const now = new Date('2026-10-10T10:00:00Z');
      const dueDate = '2026-10-01';

      const studyRes = await request(app)
        .post('/api/v1/stability')
        .set(auth('admin'))
        .send({
          sampleId: sId,
          parameters: [{ parameter: 'Assay' }],
          checkpoints: [{ intervalTag: 'T-Completed', dueDate }],
        });
      const cpId = studyRes.body.checkpoints[0].id;

      // Yakunlaymiz
      await request(app)
        .post(`/api/v1/stability/checkpoints/${cpId}/results`)
        .set(auth('admin'))
        .send({ results: [{ parameter: 'Assay', currentValue: '100%', resultStatus: 'pass' }] });
      await request(app).post(`/api/v1/stability/checkpoints/${cpId}/complete`).set(auth('admin'));

      // Job ishga tushganda overdue qilmaydi
      const jobRes = await runStabilityReminderJob({ now });
      expect(jobRes.overdueCount).toBe(0);

      const cpRes = await request(app).get(`/api/v1/stability/checkpoints/${cpId}`).set(auth('admin'));
      expect(cpRes.body.status).toBe('completed');
    });
  });

  describe('6. Tenant izolyatsiyasi', () => {
    it('Boshqa kompaniyaning stabilizatsiya tekshiruviga murojaat 404 beradi (D-102)', async () => {
      const sId = await createSample(companyAId, users.kontrolyor!.id, 'approved');
      const studyRes = await request(app)
        .post('/api/v1/stability')
        .set(auth('admin'))
        .send({
          sampleId: sId,
          checkpoints: [{ intervalTag: 'T-Iso', dueDate: '2026-11-01' }],
        });
      const studyId = studyRes.body.id;
      const cpId = studyRes.body.checkpoints[0].id;

      // Company B admin so'raydi -> 404
      const resStudy = await request(app).get(`/api/v1/stability/${studyId}`).set(auth('adminB'));
      expect(resStudy.status).toBe(404);

      const resCp = await request(app).get(`/api/v1/stability/checkpoints/${cpId}`).set(auth('adminB'));
      expect(resCp.status).toBe(404);

      const resRec = await request(app)
        .post(`/api/v1/stability/checkpoints/${cpId}/results`)
        .set(auth('chemistB'))
        .send({ results: [{ parameter: 'Assay', currentValue: '99%', resultStatus: 'pass' }] });
      expect(resRec.status).toBe(404);
    });
  });
});
