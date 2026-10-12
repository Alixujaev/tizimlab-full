import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { query, withTransaction } from '../src/config/database.js';
import { sanitizeAuditValues, writeAudit } from '../src/modules/audit/audit.service.js';
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

describe('sanitizeAuditValues (D-62, D-147)', () => {
  it('password_hash, token, token_hash, apiKey, sensorKey va boshqa sezgir kalitlarni rekursiv olib tashlaydi', () => {
    const input = {
      id: 'u1',
      email: 'a@b.uz',
      password_hash: '$2b$10$abc',
      passwordHash: 'x',
      apiKey: 'secret-api-key',
      sensorKey: 'secret-sensor-key',
      keyHash: 'hash123',
      nested: {
        token: 't',
        token_hash: 'h',
        refreshToken: 'r',
        secret: 's3cr3t',
        authorization: 'Bearer 123',
        keep: 1,
      },
      list: [{ password: 'p', name: 'n', apikey: 'k1' }],
      at: new Date(0),
    };
    const out = sanitizeAuditValues(input);
    expect(out).toEqual({
      id: 'u1',
      email: 'a@b.uz',
      nested: { keep: 1 },
      list: [{ name: 'n' }],
      at: new Date(0),
    });
    expect(input.password_hash).toBe('$2b$10$abc'); // asl ob'ekt o'zgarmaydi
    expect(sanitizeAuditValues(null)).toBeNull();
    expect(sanitizeAuditValues('matn')).toBe('matn');
  });
});

describeDb('writeAudit + withTransaction (D-64)', () => {
  let db: Db;
  beforeAll(async () => {
    db = await setupAuthDb();
  });
  afterAll(async () => {
    await db.teardown();
  });

  const count = async (action: string) =>
    Number(
      (
        await query<{ n: string }>('SELECT count(*) AS n FROM audit_log WHERE action = $1', [
          action,
        ])
      ).rows[0]!.n,
    );

  it("o'zgartirish bilan bir tranzaksiyada: commit — ikkalasi ham bor", async () => {
    const company = await createCompany();
    await withTransaction(async (client) => {
      await client.query('UPDATE companies SET name = $1 WHERE id = $2', ['Yangi nom', company.id]);
      await writeAudit(client, {
        tableName: 'companies',
        recordId: company.id,
        action: 'update',
        companyId: company.id,
        oldValues: { name: company.name },
        newValues: { name: 'Yangi nom', token: 'sir', apiKey: 'maxfiy' },
      });
    });
    const row = await query<{ new_values: unknown }>(
      `SELECT new_values FROM audit_log WHERE action = 'update' AND record_id = $1`,
      [company.id],
    );
    expect(row.rows[0]!.new_values).toEqual({ name: 'Yangi nom' });
  });

  it("rollback bo'lsa audit yozuvi ham yozilmaydi", async () => {
    const company = await createCompany();
    await expect(
      withTransaction(async (client) => {
        await writeAudit(client, {
          tableName: 'companies',
          recordId: company.id,
          action: 'rolled_back',
        });
        await client.query('UPDATE companies SET name = $1 WHERE id = $2', ['Bekor', company.id]);
        throw new Error('biznes xatosi');
      }),
    ).rejects.toThrow('biznes xatosi');
    expect(await count('rolled_back')).toBe(0);
    const { rows } = await query<{ name: string }>('SELECT name FROM companies WHERE id = $1', [
      company.id,
    ]);
    expect(rows[0]!.name).toBe(company.name);
  });

  it("auth bo'lmagan hodisada record_id NULL — DB rad etadi (D-80)", async () => {
    await expect(
      writeAudit(undefined, { tableName: 'companies', action: 'update' }),
    ).rejects.toMatchObject({
      constraint: 'audit_log_record_id_check',
    });
    await writeAudit(undefined, {
      tableName: 'auth',
      action: 'login_failed',
      newValues: { email: 'x@y.uz' },
    });
    expect(await count('login_failed')).toBe(1);
  });
});

describeDb('Audit and Activity APIs (P10, D-147)', () => {
  let db: Db;
  let app: express.Express;
  let companyA: TestCompany;
  let companyB: TestCompany;

  let superAdmin: TestUser;
  let adminA: TestUser;
  let labHeadA: TestUser;
  let directorA: TestUser;
  let chemistA: TestUser;
  let kontrolyorA: TestUser;

  let adminB: TestUser;

  let tokenSuperAdmin: string;
  let tokenAdminA: string;
  let tokenLabHeadA: string;
  let tokenDirectorA: string;
  let tokenChemistA: string;
  let tokenKontrolyorA: string;

  let sampleAuditAId: string;
  let sampleAuditBId: string;

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp().app;

    companyA = await createCompany({ name: 'Kompaniya A' });
    companyB = await createCompany({ name: 'Kompaniya B' });

    superAdmin = await createUser({ role: 'super_admin' });
    adminA = await createUser({ role: 'admin', company: companyA });
    labHeadA = await createUser({ role: 'lab_head', company: companyA });
    directorA = await createUser({ role: 'director', company: companyA });
    chemistA = await createUser({ role: 'chemist', company: companyA });
    kontrolyorA = await createUser({ role: 'kontrolyor', company: companyA });

    adminB = await createUser({ role: 'admin', company: companyB });

    tokenSuperAdmin = (await loginAs(app, superAdmin)).accessToken;
    tokenAdminA = (await loginAs(app, adminA)).accessToken;
    tokenLabHeadA = (await loginAs(app, labHeadA)).accessToken;
    tokenDirectorA = (await loginAs(app, directorA)).accessToken;
    tokenChemistA = (await loginAs(app, chemistA)).accessToken;
    tokenKontrolyorA = (await loginAs(app, kontrolyorA)).accessToken;

    // Seed test audit entries
    await writeAudit(undefined, {
      tableName: 'samples',
      recordId: '11111111-1111-1111-1111-111111111111',
      action: 'create',
      companyId: companyA.id,
      userId: adminA.id,
      oldValues: null,
      newValues: { name: 'Namuna A' },
    });
    const resA = await query<{ id: string }>(
      `SELECT id FROM audit_log WHERE record_id = '11111111-1111-1111-1111-111111111111'`,
    );
    sampleAuditAId = resA.rows[0]!.id;

    await writeAudit(undefined, {
      tableName: 'samples',
      recordId: '22222222-2222-2222-2222-222222222222',
      action: 'create',
      companyId: companyB.id,
      userId: adminB.id,
      oldValues: null,
      newValues: { name: 'Namuna B' },
    });
    const resB = await query<{ id: string }>(
      `SELECT id FROM audit_log WHERE record_id = '22222222-2222-2222-2222-222222222222'`,
    );
    sampleAuditBId = resB.rows[0]!.id;
  });

  afterAll(async () => {
    await db.teardown();
  });

  describe('GET /api/v1/audit', () => {
    it('super_admin barcha kompaniyalar auditini global ko‘ra oladi', async () => {
      const res = await request(app)
        .get('/api/v1/audit')
        .set('Authorization', `Bearer ${tokenSuperAdmin}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();

      const ids = res.body.data.map((r: { id: string }) => r.id);
      expect(ids).toContain(sampleAuditAId);
      expect(ids).toContain(sampleAuditBId);
    });

    it('company admin faqat o‘z kompaniyasining auditini ko‘radi (tenant isolation)', async () => {
      const res = await request(app)
        .get('/api/v1/audit')
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((r: { id: string }) => r.id);
      expect(ids).toContain(sampleAuditAId);
      expect(ids).not.toContain(sampleAuditBId);

      // Har bir qator kompaniya A ga tegishli ekanligini tekshirish
      for (const row of res.body.data) {
        if (row.companyId) {
          expect(row.companyId).toBe(companyA.id);
        }
      }
    });

    it('company admin boshqa company_id ni filtr qilib yuborsa ham o‘z kompaniyasi bilan cheklanadi', async () => {
      const res = await request(app)
        .get(`/api/v1/audit?companyId=${companyB.id}`)
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((r: { id: string }) => r.id);
      expect(ids).not.toContain(sampleAuditBId);
    });

    it('lab_head, director, chemist, kontrolyor rollariga /api/v1/audit taqiqlanadi (403)', async () => {
      for (const [role, token] of [
        ['lab_head', tokenLabHeadA],
        ['director', tokenDirectorA],
        ['chemist', tokenChemistA],
        ['kontrolyor', tokenKontrolyorA],
      ] as const) {
        const res = await request(app)
          .get('/api/v1/audit')
          .set('Authorization', `Bearer ${token}`);
        expect(res.status, `role: ${role}`).toBe(403);
      }
    });

    it('filtrlar: action, tableName, search to‘g‘ri ishlaydi', async () => {
      const res = await request(app)
        .get('/api/v1/audit?action=create&tableName=samples')
        .set('Authorization', `Bearer ${tokenSuperAdmin}`);
      expect(res.status).toBe(200);
      for (const row of res.body.data) {
        expect(row.action).toBe('create');
        expect(row.tableName).toBe('samples');
      }
    });

    it('GET /api/v1/audit/:id — super_admin har qanday yozuvni ko‘radi', async () => {
      const res = await request(app)
        .get(`/api/v1/audit/${sampleAuditBId}`)
        .set('Authorization', `Bearer ${tokenSuperAdmin}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(sampleAuditBId);
    });

    it('GET /api/v1/audit/:id — company admin boshqa kompaniya yozuvini ko‘ra olmaydi (404)', async () => {
      const res = await request(app)
        .get(`/api/v1/audit/${sampleAuditBId}`)
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/activity', () => {
    it('kompaniya menejerlari (admin, lab_head, director) o‘z kompaniyasi faoliyatini ko‘radi', async () => {
      for (const [role, token] of [
        ['admin', tokenAdminA],
        ['lab_head', tokenLabHeadA],
        ['director', tokenDirectorA],
      ] as const) {
        const res = await request(app)
          .get('/api/v1/activity')
          .set('Authorization', `Bearer ${token}`);
        expect(res.status, `role: ${role}`).toBe(200);
        const ids = res.body.data.map((r: { id: string }) => r.id);
        expect(ids).toContain(sampleAuditAId);
        expect(ids).not.toContain(sampleAuditBId);
      }
    });

    it('super_admin kompaniyaga tegishli bo‘lmagani uchun /api/v1/activity ga 403 oladi', async () => {
      const res = await request(app)
        .get('/api/v1/activity')
        .set('Authorization', `Bearer ${tokenSuperAdmin}`);
      expect(res.status).toBe(403);
    });

    it('chemist va kontrolyor rollariga /api/v1/activity taqiqlanadi (403)', async () => {
      const resChemist = await request(app)
        .get('/api/v1/activity')
        .set('Authorization', `Bearer ${tokenChemistA}`);
      expect(resChemist.status).toBe(403);

      const resKontrolyor = await request(app)
        .get('/api/v1/activity')
        .set('Authorization', `Bearer ${tokenKontrolyorA}`);
      expect(resKontrolyor.status).toBe(403);
    });

    it('GET /api/v1/activity/:id — o‘z kompaniyasi uchun 200, boshqa kompaniya uchun 404', async () => {
      const resOwn = await request(app)
        .get(`/api/v1/activity/${sampleAuditAId}`)
        .set('Authorization', `Bearer ${tokenLabHeadA}`);
      expect(resOwn.status).toBe(200);
      expect(resOwn.body.data.id).toBe(sampleAuditAId);

      const resOther = await request(app)
        .get(`/api/v1/activity/${sampleAuditBId}`)
        .set('Authorization', `Bearer ${tokenLabHeadA}`);
      expect(resOther.status).toBe(404);
    });
  });

  describe('O‘zgarmaslik (Immutability): UPDATE/DELETE yo‘qligi', () => {
    it('/audit va /activity uchun PUT, PATCH, DELETE yo‘llari mavjud emas (404/405)', async () => {
      const putAudit = await request(app)
        .put(`/api/v1/audit/${sampleAuditAId}`)
        .set('Authorization', `Bearer ${tokenSuperAdmin}`)
        .send({ action: 'tampered' });
      expect([404, 405]).toContain(putAudit.status);

      const deleteAudit = await request(app)
        .delete(`/api/v1/audit/${sampleAuditAId}`)
        .set('Authorization', `Bearer ${tokenSuperAdmin}`);
      expect([404, 405]).toContain(deleteAudit.status);

      const putActivity = await request(app)
        .put(`/api/v1/activity/${sampleAuditAId}`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({ action: 'tampered' });
      expect([404, 405]).toContain(putActivity.status);

      const deleteActivity = await request(app)
        .delete(`/api/v1/activity/${sampleAuditAId}`)
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect([404, 405]).toContain(deleteActivity.status);
    });
  });

  describe('Maxfiy maydonlar logga tushmasligi (Security)', () => {
    it('writeAudit orqali kiritilgan barcha parollar, tokenlar va apiKeylar filtrlanadi', async () => {
      await writeAudit(undefined, {
        tableName: 'sensor_configs',
        recordId: '33333333-3333-3333-3333-333333333333',
        action: 'create',
        companyId: companyA.id,
        userId: adminA.id,
        newValues: {
          name: 'Sensor 1',
          apiKey: 'super-secret-api-key',
          sensorKey: 'sensor-secret',
          keyHash: 'hash-secret',
          password: 'pass',
          token: 'tok',
        },
      });

      const res = await request(app)
        .get('/api/v1/audit?tableName=sensor_configs')
        .set('Authorization', `Bearer ${tokenSuperAdmin}`);
      expect(res.status).toBe(200);
      const row = res.body.data.find(
        (r: { recordId: string }) => r.recordId === '33333333-3333-3333-3333-333333333333',
      );
      expect(row).toBeDefined();
      expect(row.newValues).toEqual({ name: 'Sensor 1' });
      expect(JSON.stringify(row.newValues)).not.toContain('super-secret-api-key');
      expect(JSON.stringify(row.newValues)).not.toContain('sensor-secret');
      expect(JSON.stringify(row.newValues)).not.toContain('hash-secret');
    });
  });

  describe('Audit qamrovi tekshiruvi (P2..P9)', () => {
    it('P8 (harorat sensori) va P9 (stabilizatsiya) amallari audit logga yoziladi', async () => {
      // 1. P8 sensor yaratish
      const sensorRes = await request(app)
        .post('/api/v1/temperature/sensors')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          sensorId: 'SNS-AUDIT-01',
          locationName: 'Audit Xona 1',
          tempMin: 15,
          tempMax: 25,
        });
      expect(sensorRes.status).toBe(201);
      const sensorId = sensorRes.body.data.id;

      // Audit_log da sensor_configs yozuvi borligini tekshirish
      const auditSensor = await query<{ count: string }>(
        `SELECT count(*) FROM audit_log WHERE table_name = 'sensor_configs' AND record_id = $1`,
        [sensorId],
      );
      expect(Number(auditSensor.rows[0]!.count)).toBeGreaterThanOrEqual(1);

      // 2. P9 stabilizatsiya tadqiqoti uchun namuna yaratish va tadqiqot ochish
      // Namuna yaratish
      const sampleRes = await query<{ id: string }>(
        `INSERT INTO samples (company_id, type, substance_name, status, created_by)
         VALUES ($1, 'raw_material', 'Audit Test Modda', 'approved', $2)
         RETURNING id`,
        [companyA.id, adminA.id],
      );
      const sampleId = sampleRes.rows[0]!.id;

      const studyRes = await request(app)
        .post('/api/v1/stability')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          sampleId,
          storageConditions: '25C / 60% RH',
          parameters: [{ parameter: 'Assay', initialValue: '99.5%' }],
        });
      expect(studyRes.status).toBe(201);
      const studyId = studyRes.body.id || studyRes.body.data?.id;

      const auditStudy = await query<{ count: string }>(
        `SELECT count(*) FROM audit_log WHERE table_name = 'stability_studies' AND record_id = $1`,
        [studyId],
      );
      expect(Number(auditStudy.rows[0]!.count)).toBeGreaterThanOrEqual(1);
    });

    it('samples (assign) audit_log ga yoziladi', async () => {
      const sampleRes = await query<{ id: string }>(
        `INSERT INTO samples (company_id, type, substance_name, status, created_by)
         VALUES ($1, 'raw_material', 'Namuna Assign Test', 'pending_assignment', $2)
         RETURNING id`,
        [companyA.id, adminA.id],
      );
      const sampleId = sampleRes.rows[0]!.id;

      const assignRes = await request(app)
        .post(`/api/v1/samples/${sampleId}/assign`)
        .set('Authorization', `Bearer ${tokenLabHeadA}`)
        .send({ chemistId: chemistA.id });
      expect(assignRes.status).toBe(200);

      const auditRes = await query<{ count: string }>(
        `SELECT count(*) FROM audit_log
         WHERE table_name = 'samples' AND record_id = $1 AND action = 'update'
           AND (new_values->>'assigned_to') = $2`,
        [sampleId, chemistA.id],
      );
      expect(Number(auditRes.rows[0]!.count)).toBeGreaterThanOrEqual(1);
    });

    it('protocols (submit/approve) audit_log ga yoziladi', async () => {
      const sampleRes = await query<{ id: string }>(
        `INSERT INTO samples (company_id, type, substance_name, status, created_by)
         VALUES ($1, 'raw_material', 'Protokol Modda', 'pending_assignment', $2)
         RETURNING id`,
        [companyA.id, adminA.id],
      );
      const sampleId = sampleRes.rows[0]!.id;

      await request(app)
        .post(`/api/v1/samples/${sampleId}/assign`)
        .set('Authorization', `Bearer ${tokenLabHeadA}`)
        .send({ chemistId: chemistA.id });

      const protoRes = await query<{ id: string }>(
        `SELECT id FROM protocols WHERE sample_id = $1 AND company_id = $2`,
        [sampleId, companyA.id],
      );
      const protocolId = protoRes.rows[0]!.id;

      await query(
        `UPDATE protocols SET file_path = 'protocols/test.pdf' WHERE id = $1`,
        [protocolId],
      );

      const submitRes = await request(app)
        .post(`/api/v1/protocols/${protocolId}/submit`)
        .set('Authorization', `Bearer ${tokenChemistA}`);
      expect(submitRes.status).toBe(200);

      const submitAudit = await query<{ count: string }>(
        `SELECT count(*) FROM audit_log
         WHERE table_name = 'protocols' AND record_id = $1 AND action = 'submit'`,
        [protocolId],
      );
      expect(Number(submitAudit.rows[0]!.count)).toBeGreaterThanOrEqual(1);

      const approveRes = await request(app)
        .post(`/api/v1/protocols/${protocolId}/approve`)
        .set('Authorization', `Bearer ${tokenLabHeadA}`);
      expect(approveRes.status).toBe(200);

      const approveAudit = await query<{ count: string }>(
        `SELECT count(*) FROM audit_log
         WHERE table_name = 'protocols' AND record_id = $1 AND action = 'approve'`,
        [protocolId],
      );
      expect(Number(approveAudit.rows[0]!.count)).toBeGreaterThanOrEqual(1);
    });

    it('reagents (tranzaksiya) audit_log ga yoziladi', async () => {
      const createRes = await request(app)
        .post('/api/v1/reagents')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          name: 'Audit Reagent HCl',
          unit: 'litr',
          quantity: 10,
          lowStockThreshold: 2,
        });
      expect(createRes.status).toBe(201);
      const reagentId = createRes.body.data.id;

      const txRes = await request(app)
        .post(`/api/v1/reagents/${reagentId}/transactions`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          type: 'in',
          quantity: 5,
          note: 'Yangi partiya keldi',
        });
      expect(txRes.status).toBe(201);

      const auditRes = await query<{ count: string }>(
        `SELECT count(*) FROM audit_log
         WHERE table_name = 'reagent_transactions' AND record_id = $1 AND action = 'create'`,
        [txRes.body.data.id],
      );
      expect(Number(auditRes.rows[0]!.count)).toBeGreaterThanOrEqual(1);
    });

    it('auth (login) audit_log ga yoziladi', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: adminA.email,
          password: 'Parol12345',
        });
      expect(loginRes.status).toBe(200);

      const auditRes = await query<{ count: string }>(
        `SELECT count(*) FROM audit_log
         WHERE table_name = 'sessions' AND action = 'login_success' AND user_id = $1`,
        [adminA.id],
      );
      expect(Number(auditRes.rows[0]!.count)).toBeGreaterThanOrEqual(1);
    });
  });
});
