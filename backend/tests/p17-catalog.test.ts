import type express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { query } from '../src/config/database.js';
import { roleHasPermission } from '../src/config/permissions.js';
import { convertUnit, KNOWN_UNIT_NAMES, normalizeUnit, roundQty } from '../src/utils/units.js';
import { testApp } from './helpers/app.js';
import { createCompany, createUser, loginAs, setupAuthDb, type TestUser } from './helpers/auth.js';
import { describeDb } from './helpers/db.js';

/** P17 — birliklar (D-174), reaktiv katalogi (D-174), kontrolyor reaktiv yaratadi (D-178). */

describe('units: normalizeUnit / convertUnit', () => {
  it('ma’lum birliklar va oilalar; registr, probel va oxirgi nuqta e’tiborsiz', () => {
    expect(normalizeUnit(' ML ')).toMatchObject({ family: 'volume', factor: 1 });
    expect(normalizeUnit('л')).toMatchObject({ family: 'volume', factor: 1000 });
    expect(normalizeUnit('Kg.')).toMatchObject({ family: 'mass', factor: 1000 });
    expect(normalizeUnit('dona')).toMatchObject({ family: 'count', factor: 1 });
    expect(normalizeUnit('flakon')).toMatchObject({ family: 'other:flakon', factor: 1 });
    expect(normalizeUnit('')).toBeNull();
  });

  it('konvertatsiya: ml↔l, g↔kg, mg↔g; oilalar farq qilsa null; boshqa birlik faqat o‘ziga', () => {
    expect(convertUnit(2, 'ml', 'l')).toBe(0.002);
    expect(convertUnit(1.5, 'l', 'ml')).toBe(1500);
    expect(convertUnit(250, 'g', 'kg')).toBe(0.25);
    expect(convertUnit(500, 'mg', 'g')).toBe(0.5);
    expect(convertUnit(1, 'ml', 'g')).toBeNull();
    expect(convertUnit(3, 'flakon', 'Flakon')).toBe(3);
    expect(convertUnit(3, 'flakon', 'dona')).toBeNull();
    expect(roundQty(0.1 + 0.2)).toBe(0.3);
  });

  it('ruxsatlar (D-178): reagents:create — kontrolyor, lab_head, admin; chemist va director da yo‘q', () => {
    for (const r of ['kontrolyor', 'lab_head', 'admin'] as const)
      expect(roleHasPermission(r, 'reagents:create')).toBe(true);
    for (const r of ['chemist', 'director', 'super_admin'] as const)
      expect(roleHasPermission(r, 'reagents:create')).toBe(false);
    // Tasdiqlash huquqi o'zgarmadi (D-169)
    expect(roleHasPermission('kontrolyor', 'reagents:approve')).toBe(false);
  });
});

describeDb('reaktiv katalogi va kontrolyor (API)', () => {
  let db: Awaited<ReturnType<typeof setupAuthDb>>;
  let app: express.Express;
  const users: Record<string, TestUser> = {};
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp().app;
    const a = await createCompany({ name: 'Cat A' });
    const b = await createCompany({ name: 'Cat B' });
    for (const [n, role, c] of [
      ['kontrolyor', 'kontrolyor', a],
      ['chemist', 'chemist', a],
      ['labHead', 'lab_head', a],
      ['director', 'director', a],
      ['labHeadB', 'lab_head', b],
    ] as const) {
      users[n] = await createUser({ role, company: c });
      tokens[n] = (await loginAs(app, users[n]!)).accessToken;
    }
  });
  afterAll(() => db.teardown());

  const auth = (w: string) => ({ Authorization: `Bearer ${tokens[w]}` });
  const create = (w: string, body: Record<string, unknown>) =>
    request(app).post('/api/v1/reagents').set(auth(w)).send(body);

  it('SQL reagent_unit_family() TS normalizeUnit() bilan paritet', async () => {
    const samples = [...KNOWN_UNIT_NAMES, 'Flakon', ' ML.', 'Litr', 'xyz'];
    for (const u of samples) {
      const { rows } = await query<{ f: string }>(`SELECT reagent_unit_family($1) AS f`, [u]);
      expect(rows[0]!.f, u).toBe(normalizeUnit(u)!.family);
    }
  });

  it('D-178: kontrolyor reaktiv yaratadi (pending, created_by = kontrolyor); chemist/director — 403', async () => {
    const res = await create('kontrolyor', { name: 'Sulfat kislota', unit: 'ml', quantity: 100 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      approvalStatus: 'pending',
      createdBy: users.kontrolyor!.id,
    });
    for (const w of ['chemist', 'director']) {
      expect((await create(w, { name: 'X', unit: 'g' })).status).toBe(403);
    }
    // Kontrolyor tahrirlay/sarf qila olmaydi (reagents:write yo'q)
    const id = res.body.data.id as string;
    expect(
      (await request(app).put(`/api/v1/reagents/${id}`).set(auth('kontrolyor')).send({ name: 'Y' }))
        .status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post(`/api/v1/reagents/${id}/transactions`)
          .set(auth('kontrolyor'))
          .send({ type: 'in', quantity: 1 })
      ).status,
    ).toBe(403);
    // Tasdiqlash: kontrolyor — 403 (rol), chemist — 200 (o'zi kiritmagan)
    expect(
      (await request(app).post(`/api/v1/reagents/${id}/approve`).set(auth('kontrolyor'))).status,
    ).toBe(403);
    expect(
      (await request(app).post(`/api/v1/reagents/${id}/approve`).set(auth('chemist'))).status,
    ).toBe(200);
  });

  it('D-174: bir xil nom (registr/probel farqi bilan) — bitta katalog elementi, har biri alohida lot', async () => {
    const a = await create('labHead', { name: 'Natriy  xlorid', unit: 'g', quantity: 10 });
    const b = await create('kontrolyor', { name: ' natriy xlorid ', unit: 'kg', quantity: 1 });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.data.reagentItemId).toBe(b.body.data.reagentItemId);
    expect(a.body.data.id).not.toBe(b.body.data.id);
  });

  it('D-174: element boshqa o‘lchov oilasida bo‘lsa — 422 UNIT_MISMATCH, lot yaratilmaydi', async () => {
    await create('labHead', { name: 'Etanol', unit: 'l', quantity: 5 });
    const bad = await create('labHead', { name: 'ETANOL', unit: 'kg', quantity: 1 });
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('UNIT_MISMATCH');
    const { rows } = await query(`SELECT 1 FROM reagents WHERE reagent_name_key(name) = 'etanol'`);
    expect(rows).toHaveLength(1);
  });

  it('GET /reagents/items: qidiruv, faqat o‘z kompaniyasi, yaroqli lotlar soni', async () => {
    const r = await create('labHead', { name: 'Xlorid kislota', unit: 'ml', quantity: 50 });
    await request(app)
      .post(`/api/v1/reagents/${r.body.data.id}/approve`)
      .set(auth('chemist'))
      .expect(200);
    await request(app)
      .post('/api/v1/reagents')
      .set(auth('labHeadB'))
      .send({ name: 'Xlorid kislota B', unit: 'ml' });

    const res = await request(app)
      .get('/api/v1/reagents/items?search=kislota')
      .set(auth('chemist'));
    expect(res.status).toBe(200);
    // "Sulfat kislota" (avvalgi testda, tasdiqlangan) va "Xlorid kislota"; B kompaniyasiniki yo'q
    expect(res.body.data.map((i: { name: string }) => i.name)).toEqual([
      'Sulfat kislota',
      'Xlorid kislota',
    ]);
    const all = await request(app).get('/api/v1/reagents/items?search=xlorid').set(auth('chemist'));
    // Nom normallashtiriladi: "Natriy  xlorid" → "Natriy xlorid"
    expect(all.body.data.map((i: { name: string }) => i.name)).toEqual([
      'Natriy xlorid',
      'Xlorid kislota',
    ]);
    expect(res.body.data[1]).toMatchObject({ unitFamily: 'volume', usableLots: 1 });
  });

  it('trigger: reagent_item_id berilmagan INSERT (ETL/eski oqim) ham elementga bog‘lanadi', async () => {
    const company = users.labHead!.companyId!;
    const { rows } = await query<{ reagent_item_id: string }>(
      `INSERT INTO reagents (company_id, name, unit) VALUES ($1, 'Aseton', 'ml') RETURNING reagent_item_id`,
      [company],
    );
    expect(rows[0]!.reagent_item_id).toBeTruthy();
  });
});
