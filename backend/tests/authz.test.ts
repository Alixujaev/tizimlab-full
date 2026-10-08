import express, { Router } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as database from '../src/config/database.js';
import { query } from '../src/config/database.js';
import type { RolePermissionCatalog } from '../src/config/permissions.js';
import {
  createAuthMiddleware,
  requireCompany,
  requirePermission,
  requireRole,
} from '../src/middleware/authenticate.js';
import { ROLES, type Role } from '../src/modules/auth/auth.types.js';
import { TEST_AUTH_CONFIG, miniApp, testApp } from './helpers/app.js';
import {
  createCompany,
  createUser,
  loginAs,
  setupAuthDb,
  type TestCompany,
} from './helpers/auth.js';
import { describeDb } from './helpers/db.js';

type Db = Awaited<ReturnType<typeof setupAuthDb>>;

// Sinov katalogi (haqiqiy katalog P2b da — D-10)
const FAKE_CATALOG: RolePermissionCatalog = { lab_head: ['samples:approve'] };

/** Haqiqiy auth zanjiri bilan soxta route'lar. */
function protectedApp() {
  const auth = createAuthMiddleware(TEST_AUTH_CONFIG);
  const r = Router();
  r.get('/any', ...auth.requireAuth, (_req, res) => res.json({ ok: true }));
  r.get('/company', ...auth.requireAuth, requireCompany, (_req, res) => res.json({ ok: true }));
  r.get(
    '/managers',
    ...auth.requireAuth,
    requireCompany,
    requireRole('lab_head', 'director', 'admin'),
    (_q, s) => s.json({ ok: true }),
  );
  r.get('/super', ...auth.requireAuth, requireRole('super_admin'), (_q, s) => s.json({ ok: true }));
  r.get(
    '/approve',
    ...auth.requireAuth,
    requireCompany,
    requirePermission('samples', 'approve', FAKE_CATALOG),
    // Kesh: ikkinchi tekshiruv DB'ga murojaat qilmaydi
    requirePermission('samples', 'approve', FAKE_CATALOG),
    (_q, s) => s.json({ ok: true }),
  );
  return miniApp(r).app;
}

describeDb('authenticate / requireCompany / requireRole / requirePermission', () => {
  let db: Db;
  let app: express.Express;
  let login: express.Express;
  let company: TestCompany;
  const tokens = {} as Record<Role, string>;

  beforeAll(async () => {
    db = await setupAuthDb();
    app = protectedApp();
    login = testApp().app;
    company = await createCompany();
    for (const role of ROLES) {
      const user = await createUser({ role, company });
      tokens[role] = (await loginAs(login, user)).accessToken;
    }
  });
  afterAll(async () => {
    await db.teardown();
  });

  const get = (path: string, role: Role) =>
    request(app).get(path).set('Authorization', `Bearer ${tokens[role]}`);

  it("tokensiz — 401; har rol requireAuth'dan o'tadi", async () => {
    expect((await request(app).get('/any')).status).toBe(401);
    for (const role of ROLES) expect((await get('/any', role)).status, role).toBe(200);
  });

  it("requireCompany: super_admin company-scoped route'ga kira olmaydi (403 COMPANY_REQUIRED)", async () => {
    const res = await get('/company', 'super_admin');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('COMPANY_REQUIRED');
    for (const role of ROLES.filter((r) => r !== 'super_admin')) {
      expect((await get('/company', role)).status, role).toBe(200);
    }
  });

  it('requireRole: ruxsat va taqiq har rol uchun', async () => {
    const expected: Record<Role, number> = {
      chemist: 403,
      kontrolyor: 403,
      lab_head: 200,
      director: 200,
      admin: 200,
      super_admin: 403, // requireCompany
    };
    for (const role of ROLES)
      expect((await get('/managers', role)).status, role).toBe(expected[role]);
    for (const role of ROLES) {
      expect((await get('/super', role)).status, role).toBe(role === 'super_admin' ? 200 : 403);
    }
  });

  it("requirePermission: rol katalogi ∪ individual grant; boshqa kompaniya grant'i hisobga olinmaydi", async () => {
    // lab_head — katalog orqali
    expect((await get('/approve', 'lab_head')).status).toBe(200);
    // chemist — katalogda yo'q, grant yo'q
    expect((await get('/approve', 'chemist')).status).toBe(403);

    const chemist = await createUser({ role: 'chemist', company });
    const admin = await createUser({ role: 'admin', company });
    const t = (await loginAs(login, chemist)).accessToken;
    await query(
      `INSERT INTO user_permissions (user_id, resource, action, granted_by, company_id) VALUES ($1, 'samples', 'approve', $2, $3)`,
      [chemist.id, admin.id, company.id],
    );
    expect((await request(app).get('/approve').set('Authorization', `Bearer ${t}`)).status).toBe(
      200,
    );

    // Grant boshqa kompaniya nomidan yozilgan bo'lsa — tenant filtri uni e'tiborsiz qoldiradi
    const other = await createCompany();
    const chemist2 = await createUser({ role: 'chemist', company });
    const t2 = (await loginAs(login, chemist2)).accessToken;
    await query(
      `INSERT INTO user_permissions (user_id, resource, action, granted_by, company_id) VALUES ($1, 'samples', 'approve', $2, $3)`,
      [chemist2.id, admin.id, other.id],
    );
    expect((await request(app).get('/approve').set('Authorization', `Bearer ${t2}`)).status).toBe(
      403,
    );
  });

  it("grant'lar so'rov davomida keshlanadi — bitta so'rovda bitta user_permissions so'rovi (R-USER-10)", async () => {
    const spy = vi.spyOn(database, 'query');
    await get('/approve', 'chemist');
    const permQueries = spy.mock.calls.filter(([sql]) =>
      String(sql).includes('FROM user_permissions'),
    );
    expect(permQueries).toHaveLength(1);
    spy.mockRestore();
  });
});

describe("requireRole / requireCompany — req.auth yo'q bo'lsa 401", () => {
  it("authenticate qo'yilmagan route", async () => {
    const r = Router();
    r.get('/x', requireRole('admin'), (_q, s) => s.json({}));
    r.get('/y', requireCompany, (_q, s) => s.json({}));
    const { app } = miniApp(r);
    expect((await request(app).get('/x')).status).toBe(401);
    expect((await request(app).get('/y')).status).toBe(401);
  });
});
