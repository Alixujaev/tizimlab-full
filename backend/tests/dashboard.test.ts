import type express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { query } from '../src/config/database.js';
import { testApp } from './helpers/app.js';
import { createCompany, createUser, loginAs, setupAuthDb, type TestUser } from './helpers/auth.js';
import { describeDb } from './helpers/db.js';

type Db = Awaited<ReturnType<typeof setupAuthDb>>;

describeDb('dashboard: rol bo‘yicha statistika (P6, D-33)', () => {
  let db: Db;
  let app: express.Express;
  const tokens: Record<string, string> = {};
  const users: Record<string, TestUser> = {};

  const ZERO = {
    pending_assignment: 0,
    in_progress: 0,
    stopped: 0,
    submitted: 0,
    approved: 0,
    rejected: 0,
  };

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp().app;
    const a = await createCompany();
    const b = await createCompany();
    const specs: [string, TestUser['role'], typeof a | null][] = [
      ['kontrolyor', 'kontrolyor', a],
      ['kontrolyor2', 'kontrolyor', a],
      ['chemist1', 'chemist', a],
      ['chemist2', 'chemist', a],
      ['labHead', 'lab_head', a],
      ['director', 'director', a],
      ['admin', 'admin', a],
      ['kontrolyorB', 'kontrolyor', b],
      ['superAdmin', 'super_admin', null],
    ];
    for (const [name, role, company] of specs) {
      users[name] = await createUser({ role, company });
      tokens[name] = (await loginAs(app, users[name]!)).accessToken;
    }

    // Namunalar to'g'ridan-to'g'ri SQL bilan: statistika hisoblashini oqimdan ajratib tekshiramiz
    const sample = async (
      companyId: string,
      status: string,
      createdBy: string,
      assignedTo: string | null,
      deleted = false,
    ) => {
      const { rows } = await query<{ id: string }>(
        `INSERT INTO samples (company_id, type, status, substance_name, created_by, assigned_to, deleted_at)
         VALUES ($1, 'raw_material', $2, 'X', $3, $4, CASE WHEN $5 THEN now() END) RETURNING id`,
        [companyId, status, createdBy, assignedTo, deleted],
      );
      return rows[0]!.id;
    };
    const k = users.kontrolyor!.id;
    const k2 = users.kontrolyor2!.id;
    const c1 = users.chemist1!.id;
    const c2 = users.chemist2!.id;
    await sample(a.id, 'pending_assignment', k, null);
    await sample(a.id, 'pending_assignment', k2, null);
    await sample(a.id, 'in_progress', k, c1);
    const s4 = await sample(a.id, 'submitted', k, c1);
    const s5 = await sample(a.id, 'approved', k2, c2);
    await sample(a.id, 'rejected', k, c1, true); // o'chirilgan — hisoblanmaydi
    await sample(b.id, 'in_progress', users.kontrolyorB!.id, null);

    const protocol = async (sampleId: string, status: string) =>
      query(
        `INSERT INTO protocols (company_id, sample_id, status, protocol_role, created_by)
         VALUES ($1, $2, $3, 'standard', $4)`,
        [a.id, sampleId, status, c1],
      );
    await protocol(s4, 'submitted');
    await protocol(s5, 'finalized');
  });

  afterAll(() => db.teardown());

  const get = (who: string) =>
    request(app).get('/api/v1/dashboard').set('Authorization', `Bearer ${tokens[who]}`);

  it('chemist — faqat o‘ziga biriktirilganlar statuslar bo‘yicha (R-FE-43)', async () => {
    const res = await get('chemist1');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      view: 'chemist',
      samplesByStatus: { ...ZERO, in_progress: 1, submitted: 1 },
      totalSamples: 2,
    });
  });

  it('kontrolyor — faqat o‘zi yaratganlar (InspectorDashboard, R-FE-43, Q-65)', async () => {
    const res = await get('kontrolyor');
    expect(res.body.data).toEqual({
      view: 'inspector',
      samplesByStatus: { ...ZERO, pending_assignment: 1, in_progress: 1, submitted: 1 },
      totalSamples: 3,
    });
  });

  it('lab_head va admin — bir xil LabHead ko‘rinishi: biriktirish/tasdiq kutayotganlar (R-FE-44)', async () => {
    const expected = {
      view: 'lab_head',
      samplesByStatus: {
        ...ZERO,
        pending_assignment: 2,
        in_progress: 1,
        submitted: 1,
        approved: 1,
      },
      totalSamples: 5,
      pendingAssignment: 2,
      awaitingApproval: 1,
    };
    expect((await get('labHead')).body.data).toEqual(expected);
    expect((await get('admin')).body.data).toEqual(expected);
  });

  it('director — kompaniya bo‘yicha umumiy sonlar va yakunlanmagan protokollar (R-FE-45)', async () => {
    const res = await get('director');
    expect(res.body.data).toEqual({
      view: 'director',
      samplesByStatus: {
        ...ZERO,
        pending_assignment: 2,
        in_progress: 1,
        submitted: 1,
        approved: 1,
      },
      totalSamples: 5,
      openProtocolsByStatus: { draft: 0, submitted: 1, approved: 0, rejected: 0 },
      openProtocolsTotal: 1,
    });
  });

  it('boshqa kompaniya ma’lumoti aralashmaydi; super_admin — 403; tokensiz — 401 (R-FE-24)', async () => {
    expect((await get('kontrolyorB')).body.data.totalSamples).toBe(1);
    expect((await get('superAdmin')).status).toBe(403);
    expect((await request(app).get('/api/v1/dashboard')).status).toBe(401);
  });
});
