import type express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { query } from '../src/config/database.js';
import { correctConsumptionSchema } from '../src/modules/consumptions/consumptions.schemas.js';
import { setNotificationChannel } from '../src/modules/notifications/notifications.service.js';
import type { NotificationDto } from '../src/modules/notifications/notifications.types.js';
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
import { fixtures, MemoryStorage } from './helpers/memoryStorage.js';

/** P17 / TZ §3.2 — ND normasi bo'yicha avto-sarf, FEFO, tasdiqlash/tuzatish (D-177). */

describe('correctConsumptionSchema', () => {
  it('miqdor ≥ 0, sabab ≥ 5 belgi', () => {
    expect(
      correctConsumptionSchema.safeParse({ quantity: 0, reason: 'Hammasi qaytdi' }).success,
    ).toBe(true);
    expect(correctConsumptionSchema.safeParse({ quantity: -1, reason: 'Sabab bor' }).success).toBe(
      false,
    );
    expect(correctConsumptionSchema.safeParse({ quantity: 1, reason: 'abcd' }).success).toBe(false);
  });
});

describeDb('avto-sarf (API)', () => {
  let db: Awaited<ReturnType<typeof setupAuthDb>>;
  let app: express.Express;
  const storage = new MemoryStorage();
  let a: TestCompany;
  const users: Record<string, TestUser> = {};
  const tokens: Record<string, string> = {};
  let pushed: { userId: string; n: NotificationDto }[] = [];
  let item = '';
  let ndId = '';
  let ndDraft = '';

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp({ storage }).app;
    a = await createCompany({ name: 'Cons A' });
    const b = await createCompany({ name: 'Cons B' });
    for (const [n, role, c] of [
      ['kontrolyor', 'kontrolyor', a],
      ['chemist1', 'chemist', a],
      ['chemist2', 'chemist', a],
      ['labHead', 'lab_head', a],
      ['director', 'director', a],
      ['labHeadB', 'lab_head', b],
    ] as const) {
      users[n] = await createUser({ role, company: c });
      tokens[n] = (await loginAs(app, users[n]!)).accessToken;
    }
    item = (
      await query<{ id: string }>(
        `INSERT INTO reagent_items (company_id, name, name_key, unit_family) VALUES ($1, 'Sulfat kislota', 'sulfat kislota', 'volume') RETURNING id`,
        [a.id],
      )
    ).rows[0]!.id;
    // Tasdiqlangan ND: Sulfated ash → 2 ml sulfat kislota / tahlil
    const mk = async (status: string) =>
      (
        await query<{ id: string }>(
          `INSERT INTO normative_documents (company_id, code, name, status, approved_at)
           VALUES ($1, $2, 'ND', $3::nd_status, CASE WHEN $3 = 'approved' THEN now() END) RETURNING id`,
          [a.id, `ND-${status}`, status],
        )
      ).rows[0]!.id;
    ndId = await mk('approved');
    ndDraft = await mk('draft');
    for (const id of [ndId, ndDraft]) {
      await query(
        `INSERT INTO nd_requirements (company_id, nd_id, kind, method_name, reagent_item_id, quantity_per_analysis, unit)
         VALUES ($1, $2, 'reagent', 'Sulfated ash', $3, 2, 'ml')`,
        [a.id, id, item],
      );
    }
  });
  afterAll(() => db.teardown());

  beforeEach(async () => {
    storage.reset();
    pushed = [];
    setNotificationChannel('t', (userId, n) => pushed.push({ userId, n }));
    await query('DELETE FROM reagent_consumptions');
    await query('DELETE FROM reagent_transactions');
    await query('DELETE FROM reagents');
  });
  afterEach(() => setNotificationChannel('t', null));

  const auth = (w: string) => ({ Authorization: `Bearer ${tokens[w]}` });

  /** Lot: tasdiqlangan (yoki boshqa holat), birlik va muddat bilan */
  async function lotRow(
    name: string,
    qty: number,
    unit: string,
    expires: string | null,
    status = 'approved',
  ): Promise<string> {
    const { rows } = await query<{ id: string }>(
      `INSERT INTO reagents (company_id, name, unit, quantity, expires_at, approval_status, approved_at, reagent_item_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::reagent_approval_status, CASE WHEN $6 = 'pending' THEN NULL ELSE now() END, $7, now())
       RETURNING id`,
      [a.id, name, unit, qty, expires, status, item],
    );
    return rows[0]!.id;
  }
  const qty = async (id: string) =>
    Number(
      (await query<{ q: string }>(`SELECT quantity::text AS q FROM reagents WHERE id = $1`, [id]))
        .rows[0]!.q,
    );
  const todayStr = async () =>
    (await query<{ d: string }>(`SELECT (now() AT TIME ZONE 'Asia/Tashkent')::date::text AS d`))
      .rows[0]!.d;

  async function readyProtocol(): Promise<{ sampleId: string; protocolId: string }> {
    const s = await request(app)
      .post('/api/v1/samples')
      .set(auth('kontrolyor'))
      .send({ type: 'raw_material', substanceName: 'Paratsetamol' });
    const sampleId = s.body.data.id as string;
    await request(app)
      .post(`/api/v1/samples/${sampleId}/assign`)
      .set(auth('labHead'))
      .send({ chemistId: users.chemist1!.id })
      .expect(200);
    const list = await request(app)
      .get(`/api/v1/protocols/sample/${sampleId}`)
      .set(auth('chemist1'));
    const protocolId = list.body.data[0].id as string;
    await request(app)
      .post(`/api/v1/protocols/${protocolId}/file`)
      .set(auth('chemist1'))
      .attach('file', fixtures.pdf(), 'p.pdf')
      .expect(200);
    return { sampleId, protocolId };
  }
  const submit = (protocolId: string, body: Record<string, unknown>) =>
    request(app).post(`/api/v1/protocols/${protocolId}/submit`).set(auth('chemist1')).send(body);
  const consumptions = async (protocolId: string) =>
    (await request(app).get(`/api/v1/consumptions/protocol/${protocolId}`).set(auth('labHead')))
      .body.data as {
      id: string;
      protocolId: string;
      requiredQty: number;
      consumedQty: number;
      shortfallQty: number;
      status: string;
      lots: { reagentId: string; quantity: number }[];
    }[];

  it('FEFO: eng yaqin muddatli lotdan; muddati o‘tgan va tasdiqlanmagan lot o‘tkaziladi; bugun tugaydigani ishlatiladi', async () => {
    const today = await todayStr();
    const expired = await lotRow('L-expired', 100, 'ml', '2000-01-01');
    const pending = await lotRow('L-pending', 100, 'ml', today, 'pending');
    const lToday = await lotRow('L-today', 3, 'ml', today);
    const lLater = await lotRow('L-later', 100, 'ml', '2099-01-01');
    const lNoExp = await lotRow('L-noexp', 100, 'ml', null);
    const { protocolId } = await readyProtocol();

    const res = await submit(protocolId, { ndId, nAnalyses: 2 }); // 4 ml
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'submitted', ndId, nAnalyses: 2 });
    expect([await qty(lToday), await qty(lLater), await qty(lNoExp)]).toEqual([0, 99, 100]);
    expect([await qty(expired), await qty(pending)]).toEqual([100, 100]);

    const [c] = await consumptions(protocolId);
    expect(c).toMatchObject({ requiredQty: 4, consumedQty: 4, shortfallQty: 0, status: 'auto' });
    expect(c!.lots.map((l) => [l.reagentId, l.quantity])).toEqual([
      [lToday, 3],
      [lLater, 1],
    ]);
    const tx = await query<{ type: string; protocol_id: string }>(
      `SELECT type::text, protocol_id FROM reagent_transactions WHERE reagent_id = ANY($1::uuid[])`,
      [[lToday, lLater]],
    );
    expect(tx.rows.every((t) => t.type === 'out' && t.protocol_id === protocolId)).toBe(true);
  });

  it('birlik konvertatsiyasi: lot litrda, norma ml da', async () => {
    const lot = await lotRow('L-l', 0.5, 'l', null);
    const { protocolId } = await readyProtocol();
    await submit(protocolId, { ndId, nAnalyses: 3 }).expect(200); // 6 ml
    expect(await qty(lot)).toBe(0.494);
  });

  it('qoldiq aynan yetganda — shortfall 0, lot 0; xabar yo‘q', async () => {
    const lot = await lotRow('L', 2, 'ml', null);
    const { protocolId } = await readyProtocol();
    await submit(protocolId, { ndId }).expect(200);
    expect(await qty(lot)).toBe(0);
    expect((await consumptions(protocolId))[0]).toMatchObject({ consumedQty: 2, shortfallQty: 0 });
    expect(pushed.some((p) => p.n.type === 'reagent_shortfall')).toBe(false);
  });

  it('1 birlik yetmaganda — mavjudi ayiriladi, shortfall 1, lab_head ga xabar, yuborish bloklanmaydi, manfiy qoldiq yo‘q', async () => {
    const lot = await lotRow('L', 1, 'ml', null);
    const { protocolId } = await readyProtocol();
    const res = await submit(protocolId, { ndId });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('submitted');
    expect(await qty(lot)).toBe(0);
    expect((await consumptions(protocolId))[0]).toMatchObject({
      requiredQty: 2,
      consumedQty: 1,
      shortfallQty: 1,
    });
    const n = pushed.filter((p) => p.n.type === 'reagent_shortfall');
    expect(n.map((p) => p.userId)).toEqual([users.labHead!.id]);
    expect(n[0]!.n.message).toContain('yetmadi 1 ml');
  });

  it('idempotent: parallel ikki yuborish — sarf bir marta; rad etilib qayta yuborilganda dublikat yo‘q', async () => {
    const lot = await lotRow('L', 100, 'ml', null);
    const { protocolId } = await readyProtocol();
    const results = await Promise.all([submit(protocolId, { ndId }), submit(protocolId, { ndId })]);
    // Biri o'tadi, ikkinchisi holat tekshiruvida (allaqachon submitted) 4xx bilan to'xtaydi
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    const other = results.find((r) => r.status !== 200)!;
    expect(other.status).toBeGreaterThanOrEqual(400);
    expect(other.status).toBeLessThan(500);
    expect(await qty(lot)).toBe(98);

    await request(app)
      .post(`/api/v1/protocols/${protocolId}/reject`)
      .set(auth('labHead'))
      .send({ reason: 'Qayta tekshiring' })
      .expect(200);
    await submit(protocolId, {}).expect(200); // ND avvalgisidan olinadi
    expect(await qty(lot)).toBe(98);
    expect(await consumptions(protocolId)).toHaveLength(1);
  });

  it('ND tasdiqlanmagan — 422 va hech narsa ayirilmaydi; boshqa kompaniya ND si — 404', async () => {
    const lot = await lotRow('L', 100, 'ml', null);
    const { protocolId } = await readyProtocol();
    const r = await submit(protocolId, { ndId: ndDraft });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('ND_NOT_APPROVED');
    expect(await qty(lot)).toBe(100);
    const { rows } = await query<{ id: string }>(
      `INSERT INTO normative_documents (company_id, code, name, status, approved_at) VALUES ($1, 'B-ND', 'B', 'approved', now()) RETURNING id`,
      [users.labHeadB!.companyId],
    );
    expect((await submit(protocolId, { ndId: rows[0]!.id })).status).toBe(404);
    const p = await query<{ status: string }>(`SELECT status::text FROM protocols WHERE id = $1`, [
      protocolId,
    ]);
    expect(p.rows[0]!.status).toBe('draft');
  });

  it('ND siz yuborish — sarf yo‘q (avvalgi oqim o‘zgarmaydi)', async () => {
    await lotRow('L', 100, 'ml', null);
    const { protocolId } = await readyProtocol();
    await submit(protocolId, {}).expect(200);
    expect(await consumptions(protocolId)).toEqual([]);
  });

  describe('tasdiqlash va tuzatish', () => {
    async function consumed(lots: [number, string | null][], n = 1) {
      const ids: string[] = [];
      for (const [i, [q, exp]] of lots.entries()) ids.push(await lotRow(`L${i}`, q, 'ml', exp));
      const { protocolId } = await readyProtocol();
      await submit(protocolId, { ndId, nAnalyses: n }).expect(200);
      const [c] = await consumptions(protocolId);
      return { ids, protocolId, c: c! };
    }

    it('tasdiqlash: biriktirilgan kimyogar — 200, takror — 409; boshqa kimyogar — 403; kontrolyor/director — 403', async () => {
      const { c } = await consumed([[10, null]]);
      for (const w of ['chemist2', 'kontrolyor', 'director']) {
        expect(
          (await request(app).post(`/api/v1/consumptions/${c.id}/confirm`).set(auth(w))).status,
        ).toBe(403);
      }
      const ok = await request(app)
        .post(`/api/v1/consumptions/${c.id}/confirm`)
        .set(auth('chemist1'));
      expect(ok.status).toBe(200);
      expect(ok.body.data).toMatchObject({ status: 'confirmed', reviewedBy: users.chemist1!.id });
      expect(
        (await request(app).post(`/api/v1/consumptions/${c.id}/confirm`).set(auth('labHead')))
          .status,
      ).toBe(409);
    });

    it('kamaytirish: farq oxirgi olingan lotlarga qaytariladi; balans: boshlang‘ich = qoldiq + sof sarf', async () => {
      // 2 ml × 4 = 8 ml: L0 (5, yaqin muddat) to'liq + L1 (100) dan 3
      const { ids, c } = await consumed(
        [
          [5, '2098-01-01'],
          [100, '2099-01-01'],
        ],
        4,
      );
      expect([await qty(ids[0]!), await qty(ids[1]!)]).toEqual([0, 97]);
      const res = await request(app)
        .post(`/api/v1/consumptions/${c.id}/correct`)
        .set(auth('labHead'))
        .send({ quantity: 4, reason: 'Ikki tahlil bekor qilindi' });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        status: 'corrected',
        requiredQty: 4,
        consumedQty: 4,
        shortfallQty: 0,
        correctionReason: 'Ikki tahlil bekor qilindi',
      });
      // 4 ml qaytdi: avval L1 ga (oxirgi olingan) 3, keyin L0 ga 1
      expect([await qty(ids[0]!), await qty(ids[1]!)]).toEqual([1, 100]);
      expect(105 - ((await qty(ids[0]!)) + (await qty(ids[1]!)))).toBe(res.body.data.consumedQty);
      const audit = await query(
        `SELECT 1 FROM audit_log WHERE table_name = 'reagent_consumptions' AND record_id = $1 AND action = 'update'`,
        [c.id],
      );
      expect(audit.rows).toHaveLength(1);
      const inTx = await query<{ c: string }>(
        `SELECT count(*) AS c FROM reagent_transactions WHERE type = 'in' AND reagent_id = ANY($1::uuid[])`,
        [ids],
      );
      expect(Number(inTx.rows[0]!.c)).toBe(2);
    });

    it('oshirish: FEFO bo‘yicha qo‘shimcha ayiriladi; yetmasa shortfall va xabar; 0 ga tuzatish — hammasi qaytadi', async () => {
      const { ids, c } = await consumed([[5, null]]); // 2 ml olindi, 3 qoldi
      pushed = [];
      const up = await request(app)
        .post(`/api/v1/consumptions/${c.id}/correct`)
        .set(auth('chemist1'))
        .send({ quantity: 6, reason: 'Qayta tahlil qilindi' });
      expect(up.body.data).toMatchObject({ consumedQty: 5, shortfallQty: 1 });
      expect(await qty(ids[0]!)).toBe(0);
      expect(pushed.filter((p) => p.n.type === 'reagent_shortfall').map((p) => p.userId)).toEqual([
        users.labHead!.id,
      ]);

      const zero = await request(app)
        .post(`/api/v1/consumptions/${c.id}/correct`)
        .set(auth('labHead'))
        .send({ quantity: 0, reason: 'Tahlil o‘tkazilmadi' });
      expect(zero.body.data).toMatchObject({ consumedQty: 0, shortfallQty: 0, lots: [] });
      expect(await qty(ids[0]!)).toBe(5);
    });

    it('sababsiz tuzatish — 400; boshqa kompaniya — 404, holat o‘zgarmaydi', async () => {
      const { ids, c } = await consumed([[10, null]]);
      expect(
        (
          await request(app)
            .post(`/api/v1/consumptions/${c.id}/correct`)
            .set(auth('labHead'))
            .send({ quantity: 1 })
        ).status,
      ).toBe(400);
      expect(
        (
          await request(app)
            .post(`/api/v1/consumptions/${c.id}/correct`)
            .set(auth('labHeadB'))
            .send({ quantity: 1, reason: 'Boshqa kompaniya' })
        ).status,
      ).toBe(404);
      expect(
        (
          await request(app)
            .get(`/api/v1/consumptions/protocol/${c.protocolId}`)
            .set(auth('labHeadB'))
        ).body.data,
      ).toEqual([]);
      expect(await qty(ids[0]!)).toBe(8);
    });
  });
});
