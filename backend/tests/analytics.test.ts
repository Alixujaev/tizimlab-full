import type express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { query } from '../src/config/database.js';
import { clearAnalyticsCache } from '../src/modules/analytics/analytics.cache.js';
import { testApp } from './helpers/app.js';
import { createCompany, createUser, loginAs, setupAuthDb, type TestUser } from './helpers/auth.js';
import { describeDb } from './helpers/db.js';

type Db = Awaited<ReturnType<typeof setupAuthDb>>;

/** Mart 2025 (Toshkent) — barcha fixture vaqtlari UTC, mahalliy = UTC+5. */
const MARCH = 'period=custom&from=2025-03-01&to=2025-03-31';
const EMPTY = 'period=custom&from=2024-01-01&to=2024-01-31';

describeDb('analytics: P13 xodimlar analitikasi (D-159..D-165)', () => {
  let db: Db;
  let app: express.Express;
  const u: Record<string, TestUser> = {};
  const tk: Record<string, string> = {};
  const ids: Record<string, string> = {};

  const get = (who: string, path: string) =>
    request(app).get(`/api/v1/analytics${path}`).set('Authorization', `Bearer ${tk[who]}`);

  async function sample(opts: {
    company: string;
    createdBy: string;
    createdAt: string;
    status: string;
    assignedTo?: string;
    assignedAt?: string;
    type?: string;
    analysisEnd?: string;
  }): Promise<string> {
    const { rows } = await query<{ id: string }>(
      `INSERT INTO samples (company_id, type, status, substance_name, created_by, assigned_to,
                            assigned_at, created_at, analysis_end, lot_number)
       VALUES ($1, $2, $3, 'Paracetamol', $4, $5, $6, $7, $8, 'L-1') RETURNING id`,
      [
        opts.company,
        opts.type ?? 'raw_material',
        opts.status,
        opts.createdBy,
        opts.assignedTo ?? null,
        opts.assignedAt ?? null,
        opts.createdAt,
        opts.analysisEnd ?? null,
      ],
    );
    return rows[0]!.id;
  }

  async function track(
    company: string,
    sampleId: string,
    event: string,
    userId: string,
    at: string,
    extra: { reason?: string | null; protocolId?: string } = {},
  ) {
    await query(
      `INSERT INTO sample_tracking (company_id, sample_id, event_type, user_id, reason, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        company,
        sampleId,
        event,
        userId,
        extra.reason ?? null,
        JSON.stringify(extra.protocolId ? { protocolId: extra.protocolId } : {}),
        at,
      ],
    );
  }

  async function protocol(
    company: string,
    sampleId: string,
    createdBy: string,
    status: string,
    rejectionReason: string | null = null,
  ): Promise<string> {
    const { rows } = await query<{ id: string }>(
      `INSERT INTO protocols (company_id, sample_id, created_by, status, file_path, file_name, rejection_reason)
       VALUES ($1, $2, $3, $4, 'k/f.pdf', 'f.pdf', $5) RETURNING id`,
      [company, sampleId, createdBy, status, rejectionReason],
    );
    return rows[0]!.id;
  }

  async function sign(
    company: string,
    protocolId: string,
    user: TestUser,
    action: string,
    at: string,
  ) {
    await query(
      `INSERT INTO protocol_signatures (company_id, protocol_id, user_id, role, action, signature_hash, signed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [company, protocolId, user.id, user.role, action, 'x'.repeat(64), at],
    );
  }

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp().app;
    const a = await createCompany();
    const b = await createCompany();
    ids.a = a.id;
    ids.b = b.id;
    const specs: [string, TestUser['role'], typeof a | null][] = [
      ['k', 'kontrolyor', a],
      ['c1', 'chemist', a],
      ['c2', 'chemist', a],
      ['lh', 'lab_head', a],
      ['lh2', 'lab_head', a],
      ['d', 'director', a],
      ['d2', 'director', a],
      ['adm', 'admin', a],
      ['cGrant', 'chemist', a],
      ['admGrant', 'admin', a],
      ['kB', 'kontrolyor', b],
      ['cB', 'chemist', b],
      ['lhB', 'lab_head', b],
      ['dB', 'director', b],
      ['sa', 'super_admin', null],
    ];
    for (const [name, role, company] of specs) u[name] = await createUser({ role, company });

    // Individual grant'lar: chemist'ga team (lab_head doirasi), admin'ga company (baribir 403)
    for (const [who, action] of [
      ['cGrant', 'team'],
      ['admGrant', 'company'],
    ] as const) {
      await query(
        `INSERT INTO user_permissions (user_id, resource, action, granted_by, company_id)
         VALUES ($1, 'analytics', $2, $3, $4)`,
        [u[who]!.id, action, u.adm!.id, a.id],
      );
    }
    for (const name of Object.keys(u)) tk[name] = (await loginAs(app, u[name]!)).accessToken;

    const A = a.id;
    const pick = (n: string): TestUser => u[n]!;
    const k = pick('k');
    const c1 = pick('c1');
    const c2 = pick('c2');
    const lh = pick('lh');
    const d = pick('d');

    // S0: fevral (oldingi davr) — biriktirilmagan
    await sample({
      company: A,
      createdBy: k.id,
      createdAt: '2025-02-20T05:00:00Z',
      status: 'pending_assignment',
    });

    // S1: c1, 24 soat to'xtatilgan, bir marta rad → qayta yuborish → tasdiq → yakunlash
    const s1 = await sample({
      company: A,
      createdBy: k.id,
      createdAt: '2025-03-02T05:00:00Z',
      status: 'approved',
      assignedTo: c1.id,
      assignedAt: '2025-03-03T05:00:00Z',
    });
    ids.s1 = s1;
    const p1 = await protocol(A, s1, c1.id, 'finalized');
    await track(A, s1, 'passport_uploaded', k.id, '2025-03-02T06:00:00Z');
    await track(A, s1, 'assigned', lh.id, '2025-03-03T05:00:00Z');
    await track(A, s1, 'stopped', c1.id, '2025-03-04T05:00:00Z');
    await track(A, s1, 'resumed', c1.id, '2025-03-05T05:00:00Z');
    await sign(A, p1, c1, 'submitted', '2025-03-06T05:00:00Z');
    await track(A, s1, 'submitted', c1.id, '2025-03-06T05:00:00Z', { protocolId: p1 });
    await sign(A, p1, lh, 'rejected', '2025-03-06T11:00:00Z');
    await track(A, s1, 'rejected', lh.id, '2025-03-06T11:00:00Z', {
      reason: "Noto'g'ri hisob",
      protocolId: p1,
    });
    await sign(A, p1, c1, 'submitted', '2025-03-07T05:00:00Z');
    await track(A, s1, 'submitted', c1.id, '2025-03-07T05:00:00Z', { protocolId: p1 });
    await sign(A, p1, lh, 'approved', '2025-03-07T08:00:00Z');
    await track(A, s1, 'approved', lh.id, '2025-03-07T08:00:00Z', { protocolId: p1 });
    await sign(A, p1, d, 'finalized', '2025-03-08T08:00:00Z');

    // S2: c1, birinchi urinishda tasdiq (finished_product)
    const s2 = await sample({
      company: A,
      createdBy: k.id,
      createdAt: '2025-03-10T05:00:00Z',
      status: 'approved',
      assignedTo: c1.id,
      assignedAt: '2025-03-10T07:00:00Z',
      type: 'finished_product',
    });
    const p2 = await protocol(A, s2, c1.id, 'approved');
    await track(A, s2, 'assigned', lh.id, '2025-03-10T07:00:00Z');
    await sign(A, p2, c1, 'submitted', '2025-03-11T05:00:00Z');
    await track(A, s2, 'submitted', c1.id, '2025-03-11T05:00:00Z', { protocolId: p2 });
    await sign(A, p2, lh, 'approved', '2025-03-11T09:00:00Z');
    await track(A, s2, 'approved', lh.id, '2025-03-11T09:00:00Z', { protocolId: p2 });

    // S3: c1, rad etilgan (sabab bo'shliq/registr farqi bilan), muddati o'tgan
    const s3 = await sample({
      company: A,
      createdBy: k.id,
      createdAt: '2025-03-12T05:00:00Z',
      status: 'rejected',
      assignedTo: c1.id,
      assignedAt: '2025-03-12T06:00:00Z',
      analysisEnd: '2025-03-20',
    });
    ids.s3 = s3;
    const p3 = await protocol(A, s3, c1.id, 'rejected');
    await track(A, s3, 'assigned', lh.id, '2025-03-12T06:00:00Z');
    await sign(A, p3, c1, 'submitted', '2025-03-13T05:00:00Z');
    await track(A, s3, 'submitted', c1.id, '2025-03-13T05:00:00Z', { protocolId: p3 });
    await sign(A, p3, lh, 'rejected', '2025-03-13T07:00:00Z');
    await track(A, s3, 'rejected', lh.id, '2025-03-13T07:00:00Z', {
      reason: "  noto'g'ri   HISOB ",
      protocolId: p3,
    });

    // S4: c1, jarayonda
    const s4 = await sample({
      company: A,
      createdBy: k.id,
      createdAt: '2025-03-14T05:00:00Z',
      status: 'in_progress',
      assignedTo: c1.id,
      assignedAt: '2025-03-14T06:00:00Z',
    });
    ids.s4 = s4;
    await track(A, s4, 'assigned', lh.id, '2025-03-14T06:00:00Z');

    // S5: c2, sababsiz rad etilgan
    const s5 = await sample({
      company: A,
      createdBy: k.id,
      createdAt: '2025-03-15T05:00:00Z',
      status: 'rejected',
      assignedTo: c2.id,
      assignedAt: '2025-03-15T07:00:00Z',
    });
    const p5 = await protocol(A, s5, c2.id, 'rejected');
    await track(A, s5, 'assigned', lh.id, '2025-03-15T07:00:00Z');
    await sign(A, p5, c2, 'submitted', '2025-03-16T05:00:00Z');
    await track(A, s5, 'submitted', c2.id, '2025-03-16T05:00:00Z', { protocolId: p5 });
    await sign(A, p5, lh, 'rejected', '2025-03-16T06:00:00Z');
    await track(A, s5, 'rejected', lh.id, '2025-03-16T06:00:00Z', { reason: null, protocolId: p5 });

    // O'chirilgan namuna — hech qayerda hisoblanmaydi
    const sDel = await sample({
      company: A,
      createdBy: k.id,
      createdAt: '2025-03-20T05:00:00Z',
      status: 'in_progress',
      assignedTo: c1.id,
      assignedAt: '2025-03-20T06:00:00Z',
    });
    await query(`UPDATE samples SET deleted_at = now() WHERE id = $1`, [sDel]);

    // Stabilizatsiya: c1 ga muddati o'tgan checkpoint
    const { rows: st } = await query<{ id: string }>(
      `INSERT INTO stability_studies (company_id, sample_id, created_by) VALUES ($1, $2, $3) RETURNING id`,
      [A, s2, lh.id],
    );
    await query(
      `INSERT INTO stability_checkpoints (company_id, study_id, interval_tag, due_date, assigned_to)
       VALUES ($1, $2, 'T3', '2025-03-01', $3)`,
      [A, st[0]!.id, c1.id],
    );

    // Kompaniya B: tasdiqlangan namuna (A sonlariga tushmasligi kerak)
    const sb = await sample({
      company: b.id,
      createdBy: u.kB!.id,
      createdAt: '2025-03-05T05:00:00Z',
      status: 'approved',
      assignedTo: u.cB!.id,
      assignedAt: '2025-03-05T06:00:00Z',
    });
    const pb = await protocol(b.id, sb, u.cB!.id, 'approved');
    await track(b.id, sb, 'assigned', u.lhB!.id, '2025-03-05T06:00:00Z');
    await sign(b.id, pb, u.cB!, 'submitted', '2025-03-06T05:00:00Z');
    await sign(b.id, pb, u.lhB!, 'rejected', '2025-03-06T06:00:00Z');
    await track(b.id, sb, 'rejected', u.lhB!.id, '2025-03-06T06:00:00Z', {
      reason: 'B sababi',
      protocolId: pb,
    });
    await sign(b.id, pb, u.cB!, 'submitted', '2025-03-06T07:00:00Z');
    await sign(b.id, pb, u.lhB!, 'approved', '2025-03-06T08:00:00Z');
    await track(b.id, sb, 'approved', u.lhB!.id, '2025-03-06T08:00:00Z', { protocolId: pb });
  });

  beforeEach(() => clearAnalyticsCache());
  afterAll(async () => {
    await db.teardown();
  });

  const kpi = (
    body: { data: { kpis: { key: string; value: unknown; previous: unknown }[] } },
    key: string,
  ) => body.data.kpis.find((x) => x.key === key);

  describe('ruxsat matritsasi (D-159)', () => {
    const cases: [string, string, number][] = [];
    const roles = ['k', 'c1', 'lh', 'd', 'adm', 'sa'];
    const expect200 = {
      overview: ['d'],
      team: ['lh', 'd'],
      me: ['k', 'c1', 'lh', 'd'],
      user: ['c1', 'lh', 'd'],
      samples: ['c1', 'lh', 'd'],
    } as const;
    for (const [ep, ok] of Object.entries(expect200)) {
      for (const r of roles) cases.push([ep, r, (ok as readonly string[]).includes(r) ? 200 : 403]);
    }
    it.each(cases)('%s — %s → %i', async (ep, who, status) => {
      const path = {
        overview: `/overview?${MARCH}`,
        team: `/team?${MARCH}`,
        me: `/me?${MARCH}`,
        user: `/users/${u.c1!.id}?${MARCH}`,
        samples: `/users/${u.c1!.id}/samples?${MARCH}`,
      }[ep]!;
      const res = await get(who, path);
      expect(res.status).toBe(status);
    });

    it('autentifikatsiyasiz — 401', async () => {
      const res = await request(app).get('/api/v1/analytics/me');
      expect(res.status).toBe(401);
    });

    it('admin individual grant bilan ham 403 (analytics:company)', async () => {
      expect((await get('admGrant', `/overview?${MARCH}`)).status).toBe(403);
      expect((await get('admGrant', `/me?${MARCH}`)).status).toBe(403);
    });

    it('chemist analytics:team grant bilan — jamoa doirasi (chemist/kontrolyor)', async () => {
      const res = await get('cGrant', `/team?${MARCH}&limit=100`);
      expect(res.status).toBe(200);
      const roles = new Set(res.body.data.map((r: { role: string }) => r.role));
      expect([...roles].sort()).toEqual(['chemist', 'kontrolyor']);
      expect((await get('cGrant', `/users/${u.c1!.id}?${MARCH}`)).status).toBe(200);
      expect((await get('cGrant', `/users/${u.lh!.id}?${MARCH}`)).status).toBe(403);
    });
  });

  describe('ierarxiya (D-160)', () => {
    it.each([
      ['lh', 'd', 403],
      ['lh', 'lh2', 403],
      ['lh', 'adm', 403],
      ['lh', 'lh', 200],
      ['lh', 'k', 200],
      ['lh', 'c2', 200],
      ['d', 'lh', 200],
      ['d', 'k', 200],
      ['d', 'd2', 403],
      ['d', 'adm', 403],
      ['d', 'd', 200],
      ['c2', 'c1', 403],
      ['c2', 'c2', 200],
      ['k', 'c1', 403],
      ['k', 'k', 200],
    ])('%s → %s : %i', async (viewer, target, status) => {
      expect((await get(viewer, `/users/${u[target]!.id}?${MARCH}`)).status).toBe(status);
      expect((await get(viewer, `/users/${u[target]!.id}/samples?${MARCH}`)).status).toBe(status);
    });

    it('lab_head jamoasi: faqat chemist/kontrolyor + o‘zi', async () => {
      const res = await get('lh', `/team?${MARCH}&limit=100`);
      const names = res.body.data.map((r: { id: string }) => r.id).sort();
      const expected = ['k', 'c1', 'c2', 'cGrant', 'lh'].map((n) => u[n]!.id).sort();
      expect(names).toEqual(expected);
    });

    it('director jamoasi: lab_head/chemist/kontrolyor + o‘zi (boshqa director va admin yo‘q)', async () => {
      const res = await get('d', `/team?${MARCH}&limit=100`);
      const got = res.body.data.map((r: { id: string }) => r.id).sort();
      const expected = ['k', 'c1', 'c2', 'cGrant', 'lh', 'lh2', 'd'].map((n) => u[n]!.id).sort();
      expect(got).toEqual(expected);
      expect(res.body.meta.total).toBe(7);
    });
  });

  describe('tenant izolyatsiyasi', () => {
    it('boshqa kompaniya xodimi — 404', async () => {
      expect((await get('d', `/users/${u.cB!.id}?${MARCH}`)).status).toBe(404);
      expect((await get('lh', `/users/${u.cB!.id}/samples?${MARCH}`)).status).toBe(404);
      expect((await get('dB', `/users/${u.c1!.id}?${MARCH}`)).status).toBe(404);
    });

    it('B direktori faqat B ma‘lumotini ko‘radi, keyin A direktori o‘zinikini (kesh kaliti tenant bo‘yicha)', async () => {
      const b = await get('dB', `/overview?${MARCH}`);
      expect(kpi(b.body, 'samplesCreated')!.value).toBe(1);
      expect(kpi(b.body, 'rejectionRate')!.value).toBe(50);
      expect(b.body.data.reasons).toEqual([{ key: 'b sababi', label: 'B sababi', value: 1 }]);
      const a = await get('d', `/overview?${MARCH}`);
      expect(kpi(a.body, 'samplesCreated')!.value).toBe(5);
      const team = await get('dB', `/team?${MARCH}&limit=100`);
      const teamIds = team.body.data.map((r: { id: string }) => r.id);
      expect(teamIds).not.toContain(u.c1!.id);
    });
  });

  describe('metrikalar (qo‘lda tuzilgan fixture)', () => {
    it('chemist c1: rad %, birinchi urinish %, qayta yuborish, bajarish muddati (stopped chiqarilgan)', async () => {
      const res = await get('c1', `/me?${MARCH}`);
      expect(res.status).toBe(200);
      const v = (key: string) => kpi(res.body, key)!.value;
      expect(v('assigned')).toBe(4);
      expect(v('completed')).toBe(2);
      expect(v('inProgress')).toBe(2);
      expect(v('rejected')).toBe(2);
      expect(v('rejectionRate')).toBe(50);
      expect(v('firstPassRate')).toBe(50);
      expect(v('resubmissions')).toBe(1);
      // S1: 99 soat − 24 soat to'xtatilgan = 75; S2: 26 → o'rtacha 50.5
      expect(v('avgCompletionHours')).toBe(50.5);
      expect(v('overdueCheckpoints')).toBe(1);
      expect(res.body.data.outcomes).toEqual([
        { key: 'approved', label: null, value: 2 },
        { key: 'rejected', label: null, value: 2 },
        { key: 'inProgress', label: null, value: 2 },
      ]);
      expect(res.body.data.reasons).toEqual([
        { key: "noto'g'ri hisob", label: "Noto'g'ri hisob", value: 2 },
      ]);
      // Trend: kunlik (31 kun), 7 va 11 martda bittadan bajarilgan
      const pts = res.body.data.trend.points as { date: string; value: number }[];
      expect(pts).toHaveLength(31);
      expect(pts.filter((p) => p.value > 0)).toEqual([
        { date: '2025-03-07', value: 1 },
        { date: '2025-03-11', value: 1 },
      ]);
      expect(res.body.data.period).toMatchObject({
        from: '2025-03-01',
        to: '2025-03-31',
        days: 31,
        bucket: 'day',
        previousFrom: '2025-01-29',
        previousTo: '2025-02-28',
      });
    });

    it('kontrolyor: kiritgan, pasport, tasdiq/rad, kiritish→biriktirish; oldingi davr', async () => {
      const res = await get('k', `/me?${MARCH}`);
      const m = (key: string) => kpi(res.body, key)!;
      expect(m('created').value).toBe(5);
      expect(m('created').previous).toBe(1);
      expect(m('passportsUploaded').value).toBe(1);
      expect(m('createdApproved').value).toBe(2);
      expect(m('createdRejected').value).toBe(3);
      expect(m('avgIntakeHours').value).toBe(6);
    });

    it('lab_head: ko‘rib chiqish, o‘rtacha vaqt, biriktirgan, navbat', async () => {
      const res = await get('lh', `/me?${MARCH}`);
      const v = (key: string) => kpi(res.body, key)!.value;
      expect(v('reviewedApproved')).toBe(2);
      expect(v('reviewedRejected')).toBe(3);
      expect(v('avgReviewHours')).toBe(3.2);
      expect(v('assignedByMe')).toBe(5);
      expect(v('queueApprovals')).toBe(0);
      expect(v('queueAssignments')).toBe(1);
      expect(kpi(res.body, 'queueAssignments')!.previous).toBeNull();
    });

    it('director: yakunlagan va yakunlash kechikishi', async () => {
      const res = await get('d', `/me?${MARCH}`);
      expect(kpi(res.body, 'finalized')!.value).toBe(1);
      expect(kpi(res.body, 'avgFinalizeHours')!.value).toBe(24);
    });

    it('overview: KPI, voronka, sabablar, turlar, TAT, kechikayotganlar, yuklama', async () => {
      const res = await get('d', `/overview?${MARCH}`);
      expect(res.status).toBe(200);
      const v = (key: string) => kpi(res.body, key)!.value;
      expect(v('samplesCreated')).toBe(5);
      expect(kpi(res.body, 'samplesCreated')!.previous).toBe(1);
      expect(v('samplesApproved')).toBe(2);
      expect(v('protocolsFinalized')).toBe(1);
      expect(v('rejectionRate')).toBe(60);
      expect(v('firstPassRate')).toBe(50);
      // TAT: S1 123 − 24 = 99, S2 28 → 63.5
      expect(v('avgTatHours')).toBe(63.5);
      expect(v('openSamples')).toBe(4);
      expect(v('lateSamples')).toBe(1);
      const data = res.body.data;
      expect(data.funnel.map((f: { value: number }) => f.value)).toEqual([5, 5, 4, 4, 2, 1]);
      expect(data.reasons).toEqual([
        { key: "noto'g'ri hisob", label: "Noto'g'ri hisob", value: 2 },
        { key: 'unspecified', label: null, value: 1 },
      ]);
      expect(data.byType).toEqual([
        { key: 'raw_material', label: null, value: 4 },
        { key: 'finished_product', label: null, value: 1 },
      ]);
      expect(data.lateSamples).toHaveLength(1);
      expect(data.lateSamples[0]).toMatchObject({ id: ids.s3, assigneeId: u.c1!.id });
      const load = Object.fromEntries(
        data.workload.map((w: { userId: string; open: number }) => [w.userId, w.open]),
      );
      expect(load[u.c1!.id]).toBe(2);
      expect(load[u.c2!.id]).toBe(1);
      expect(data.stability).toMatchObject({ activeStudies: 1, overdueCheckpoints: 1 });
      expect(data.trend).toHaveLength(31);
      expect(data.trend.reduce((s: number, t: { created: number }) => s + t.created, 0)).toBe(5);
    });

    it('team: saralash (rad etish foizi bo‘yicha kamayish, null oxirida) va sahifalash', async () => {
      const res = await get('lh', `/team?${MARCH}&role=chemist&sort=rejectionRate&order=desc`);
      const rows = res.body.data as {
        id: string;
        metrics: Record<string, number | null>;
        openSamples: number;
      }[];
      expect(rows.map((r) => r.id)).toEqual([u.c2!.id, u.c1!.id, u.cGrant!.id]);
      expect(rows[0]!.metrics.rejectionRate).toBe(100);
      expect(rows[2]!.metrics.rejectionRate).toBeNull();
      expect(rows[1]!.openSamples).toBe(2);
      const page2 = await get('d', `/team?${MARCH}&limit=2&page=2&sort=fullName`);
      expect(page2.body.meta).toEqual({ page: 2, limit: 2, total: 7 });
      expect(page2.body.data).toHaveLength(2);
    });

    it('users/:id/samples: muddat, natija, rad sababi, kechikish, filtrlar', async () => {
      const res = await get('lh', `/users/${u.c1!.id}/samples?${MARCH}&limit=50`);
      expect(res.body.meta.total).toBe(4);
      const s1 = res.body.data.find((s: { id: string }) => s.id === ids.s1);
      expect(s1).toMatchObject({
        result: 'approved',
        durationHours: 75,
        lastRejectionReason: "Noto'g'ri hisob",
        isLate: false,
      });
      expect(s1).not.toHaveProperty('code');
      const s3 = res.body.data.find((s: { id: string }) => s.id === ids.s3);
      expect(s3).toMatchObject({ result: 'rejected', isLate: true, durationHours: null });
      const open = await get('lh', `/users/${u.c1!.id}/samples?${MARCH}&result=open`);
      expect(open.body.data.map((s: { id: string }) => s.id)).toEqual([ids.s4]);
      const rej = await get('lh', `/users/${u.c1!.id}/samples?${MARCH}&status=rejected`);
      expect(rej.body.data.map((s: { id: string }) => s.id)).toEqual([ids.s3]);
    });

    it('oxirgi faoliyat: imzolar va tracking (takrorsiz)', async () => {
      const res = await get('c1', `/me?${MARCH}`);
      const acts = res.body.data.activity as { kind: string; action: string }[];
      expect(acts.length).toBeLessThanOrEqual(10);
      expect(acts.some((a) => a.kind === 'signature' && a.action === 'submitted')).toBe(true);
      expect(acts.some((a) => a.kind === 'tracking' && a.action === 'stopped')).toBe(true);
      expect(acts.some((a) => a.kind === 'tracking' && a.action === 'submitted')).toBe(false);
    });
  });

  describe('bo‘sh davr va nolga bo‘lish', () => {
    it('chemist: sonlar 0, foiz va muddatlar null', async () => {
      const res = await get('c1', `/me?${EMPTY}`);
      expect(res.status).toBe(200);
      const v = (key: string) => kpi(res.body, key)!.value;
      expect(v('assigned')).toBe(0);
      expect(v('completed')).toBe(0);
      expect(v('rejectionRate')).toBeNull();
      expect(v('firstPassRate')).toBeNull();
      expect(v('avgCompletionHours')).toBeNull();
      expect(res.body.data.reasons).toEqual([]);
      expect(res.body.data.trend.points.every((p: { value: number }) => p.value === 0)).toBe(true);
    });

    it('overview: bo‘sh davr', async () => {
      const res = await get('d', `/overview?${EMPTY}`);
      const v = (key: string) => kpi(res.body, key)!.value;
      expect(v('samplesCreated')).toBe(0);
      expect(v('rejectionRate')).toBeNull();
      expect(v('avgTatHours')).toBeNull();
      expect(res.body.data.funnel.every((f: { value: number }) => f.value === 0)).toBe(true);
      expect(res.body.data.reasons).toEqual([]);
    });

    it('90 kunlik davr — haftalik trend', async () => {
      const res = await get('c1', `/me?period=90d`);
      expect(res.body.data.period).toMatchObject({ days: 90, bucket: 'week' });
    });
  });

  describe('davr validatsiyasi (D-161)', () => {
    it.each([
      ['period=custom', 'from yo‘q'],
      ['period=custom&from=2025-03-10', 'to yo‘q'],
      ['period=custom&from=2025-03-10&to=2025-03-01', 'from > to'],
      ['period=custom&from=2023-01-01&to=2025-01-01', '> 366 kun'],
      ['period=custom&from=2025-13-01&to=2025-13-05', 'noto‘g‘ri sana'],
      ['period=custom&from=2025-02-30&to=2025-03-05', 'mavjud bo‘lmagan sana'],
      ['period=custom&from=2025-01-01&to=2999-01-01', 'kelajak'],
      ['period=1y', 'noma’lum preset'],
    ])('%s → 400 (%s)', async (qs) => {
      const res = await get('c1', `/me?${qs}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('team: noto‘g‘ri sort → 400; noto‘g‘ri uuid → 400', async () => {
      expect((await get('d', `/team?sort=score`)).status).toBe(400);
      expect((await get('d', `/users/not-a-uuid`)).status).toBe(400);
    });
  });
});
