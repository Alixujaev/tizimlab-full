import type express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { query } from '../src/config/database.js';
import { protocolListQuerySchema } from '../src/modules/protocols/protocols.schemas.js';
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

/**
 * P18 (D-184..D-189) — protokol metadata'si (apparat, tahlil sanasi), peak fayllari, rad etish tarixi,
 * harorat taklifi (Addendum 2-bosqich), global protokollar ro'yxati va reyestr apparat filtri, yagona tarix.
 */

describe('protocolListQuerySchema (unit)', () => {
  it('equipmentId: uuid yoki "unknown"; sana oralig‘i tartibi', () => {
    expect(protocolListQuerySchema.safeParse({ equipmentId: 'unknown' }).success).toBe(true);
    expect(protocolListQuerySchema.safeParse({ equipmentId: 'abc' }).success).toBe(false);
    expect(
      protocolListQuerySchema.safeParse({ dateFrom: '2026-03-02', dateTo: '2026-03-01' }).success,
    ).toBe(false);
    expect(protocolListQuerySchema.safeParse({ status: 'archived' }).success).toBe(false);
  });
});

describeDb('P18 protokollar (API)', () => {
  let db: Awaited<ReturnType<typeof setupAuthDb>>;
  let app: express.Express;
  const storage = new MemoryStorage();
  let a: TestCompany;
  let b: TestCompany;
  const users: Record<string, TestUser> = {};
  const tokens: Record<string, string> = {};
  let hplc: string;
  let hplcB: string;
  let room: string;

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp({ storage }).app;
    a = await createCompany({ name: 'Proto A' });
    b = await createCompany({ name: 'Proto B' });
    for (const [name, role, company] of [
      ['kontrolyor', 'kontrolyor', a],
      ['labHead', 'lab_head', a],
      ['chemist1', 'chemist', a],
      ['chemist2', 'chemist', a],
      ['director', 'director', a],
      ['kontrolyorB', 'kontrolyor', b],
      ['labHeadB', 'lab_head', b],
      ['chemistB', 'chemist', b],
    ] as const) {
      users[name] = await createUser({ role, company });
      tokens[name] = (await loginAs(app, users[name]!)).accessToken;
    }
    const eq = await request(app)
      .post('/api/v1/equipment')
      .set(auth('labHead'))
      .send({ name: 'HPLC-1', category: 'HPLC', serialNumber: 'H-001' });
    hplc = eq.body.data.id;
    const eqB = await request(app)
      .post('/api/v1/equipment')
      .set(auth('labHeadB'))
      .send({ name: 'HPLC-B', category: 'HPLC', serialNumber: 'HB-001' });
    hplcB = eqB.body.data.id;
    const s = await query<{ id: string }>(
      `INSERT INTO sensor_configs (company_id, sensor_id, location_name, temp_min, temp_max)
       VALUES ($1, 'S-1', 'Xona-1', 15, 25) RETURNING id`,
      [a.id],
    );
    room = s.rows[0]!.id;
    // Toshkent 2026-03-10 13:00 → 26.5 °C (me'yordan yuqori, 25)
    await query(
      `INSERT INTO temperature_readings (company_id, sensor_config_id, temperature, humidity, recorded_at, is_manual)
       VALUES ($1, $2, 26.5, 40, '2026-03-10T08:00:00Z', true), ($1, $2, 21, 40, '2026-03-12T07:00:00Z', true)`,
      [a.id, room],
    );
  });
  afterAll(() => db.teardown());
  beforeEach(() => storage.reset());

  function auth(who: string) {
    return { Authorization: `Bearer ${tokens[who]}` };
  }

  async function readyProtocol(
    opts: {
      substanceName?: string;
      serialNumber?: string;
      chemist?: string;
      analysisEnd?: string;
      company?: 'a' | 'b';
    } = {},
  ): Promise<{ protocolId: string; sampleId: string }> {
    const sfx = opts.company === 'b' ? 'B' : '';
    const chemist = opts.chemist ?? `chemist1`;
    const s = await request(app)
      .post('/api/v1/samples')
      .set(auth(`kontrolyor${sfx}`))
      .send({
        type: 'raw_material',
        substanceName: opts.substanceName ?? 'Ibuprofen',
        serialNumber: opts.serialNumber ?? null,
        analysisEnd: opts.analysisEnd ?? '2026-03-10',
      })
      .expect(201);
    const sampleId = s.body.data.id as string;
    await request(app)
      .post(`/api/v1/samples/${sampleId}/assign`)
      .set(auth(`labHead${sfx}`))
      .send({ chemistId: users[chemist]!.id })
      .expect(200);
    const list = await request(app).get(`/api/v1/protocols/sample/${sampleId}`).set(auth(chemist));
    const protocolId = list.body.data[0].id as string;
    await request(app)
      .post(`/api/v1/protocols/${protocolId}/file`)
      .set(auth(chemist))
      .attach('file', fixtures.pdf(), 'main.pdf')
      .expect(200);
    return { protocolId, sampleId };
  }

  describe('apparat va metadata (D-184)', () => {
    it('apparatsiz ("noma’lum", null) yuborish bloklanmaydi; tanlangan apparat saqlanadi', async () => {
      const p1 = await readyProtocol();
      const r1 = await request(app)
        .post(`/api/v1/protocols/${p1.protocolId}/submit`)
        .set(auth('chemist1'))
        .send({ equipmentId: null });
      expect(r1.status).toBe(200);
      expect(r1.body.data).toMatchObject({ equipmentId: null, analysisDate: '2026-03-10' });

      const p2 = await readyProtocol({ serialNumber: 'S-77' });
      const r2 = await request(app)
        .post(`/api/v1/protocols/${p2.protocolId}/submit`)
        .set(auth('chemist1'))
        .send({ equipmentId: hplc, analysisDate: '2026-03-12' });
      expect(r2.status).toBe(200);
      expect(r2.body.data).toMatchObject({ equipmentId: hplc, analysisDate: '2026-03-12' });

      // Asosiy fayl bog'i (kind=protocol) metadata bilan
      const files = await query<{
        kind: string;
        substance_name: string;
        series: string;
        analysis_date: Date;
        chemist_id: string;
        equipment_id: string;
      }>(
        `SELECT kind, substance_name, series, analysis_date, chemist_id, equipment_id FROM protocol_files WHERE protocol_id = $1`,
        [p2.protocolId],
      );
      expect(files.rows).toHaveLength(1);
      expect(files.rows[0]).toMatchObject({
        kind: 'protocol',
        substance_name: 'Ibuprofen',
        series: 'S-77',
        chemist_id: users.chemist1!.id,
        equipment_id: hplc,
      });
      const detail = await request(app)
        .get(`/api/v1/protocols/${p2.protocolId}`)
        .set(auth('labHead'))
        .expect(200);
      expect(detail.body.data).toMatchObject({ equipmentName: 'HPLC-1', files: [], peakFiles: [] });
    });

    it('boshqa kompaniya apparati → 404, holat o‘zgarmaydi', async () => {
      const p = await readyProtocol();
      const res = await request(app)
        .post(`/api/v1/protocols/${p.protocolId}/submit`)
        .set(auth('chemist1'))
        .send({ equipmentId: hplcB });
      expect(res.status).toBe(404);
      const st = await query<{ status: string }>(`SELECT status FROM protocols WHERE id = $1`, [
        p.protocolId,
      ]);
      expect(st.rows[0]!.status).toBe('draft');
    });

    it('asosiy fayl almashtirilsa/o‘chirilsa bog‘ ham yangilanadi', async () => {
      const p = await readyProtocol();
      await request(app)
        .post(`/api/v1/protocols/${p.protocolId}/file`)
        .set(auth('chemist1'))
        .attach('file', fixtures.docx(), 'v2.docx')
        .expect(200);
      let rows = await query<{ filename: string }>(
        `SELECT f.filename FROM protocol_files pf JOIN files f ON f.id = pf.file_id WHERE pf.protocol_id = $1 AND pf.kind = 'protocol'`,
        [p.protocolId],
      );
      expect(rows.rows.map((r) => r.filename)).toEqual(['v2.docx']);
      await request(app)
        .delete(`/api/v1/protocols/${p.protocolId}/file`)
        .set(auth('chemist1'))
        .expect(200);
      rows = await query(`SELECT 1 FROM protocol_files WHERE protocol_id = $1`, [p.protocolId]);
      expect(rows.rows).toHaveLength(0);
    });
  });

  describe('harorat taklifi (D-188)', () => {
    it('yagona xona avtomatik tanlanadi; me’yordan chiqqan qiymat outOfRange; yuborilganda aynan shu yoziladi', async () => {
      const p = await readyProtocol();
      const res = await request(app)
        .get(`/api/v1/protocols/${p.protocolId}/temperature-suggestion`)
        .set(auth('chemist1'))
        .expect(200);
      expect(res.body.data).toMatchObject({
        analysisDate: '2026-03-10',
        sensorConfigId: room,
        roomSource: 'single_room',
        status: 'ok',
        reading: { temperature: 26.5 },
        limits: { tempMin: 15, tempMax: 25 },
        outOfRange: true,
        locationName: 'Xona-1',
      });
      const sub = await request(app)
        .post(`/api/v1/protocols/${p.protocolId}/submit`)
        .set(auth('chemist1'))
        .send({
          sensorConfigId: res.body.data.sensorConfigId,
          analysisDate: res.body.data.analysisDate,
          equipmentId: null,
        })
        .expect(200);
      expect(sub.body.data.temperatureSnapshot.readingId).toBe(res.body.data.reading.readingId);
    });

    it('kimyogar sanani o‘zgartiradi → boshqa taklif (me’yorda); yozuv yo‘q → no_reading', async () => {
      const p = await readyProtocol();
      const ok = await request(app)
        .get(`/api/v1/protocols/${p.protocolId}/temperature-suggestion`)
        .query({ sensorConfigId: room, analysisDate: '2026-03-12' })
        .set(auth('chemist1'))
        .expect(200);
      expect(ok.body.data).toMatchObject({
        roomSource: 'request',
        status: 'ok',
        outOfRange: false,
        reading: { temperature: 21 },
      });
      const none = await request(app)
        .get(`/api/v1/protocols/${p.protocolId}/temperature-suggestion`)
        .query({ analysisDate: '2026-06-01' })
        .set(auth('chemist1'))
        .expect(200);
      expect(none.body.data).toMatchObject({
        status: 'no_reading',
        reading: null,
        outOfRange: false,
      });
    });

    it('xona yo‘q (kompaniyada sensor yo‘q) → no_room; boshqa kompaniya protokoli/sensori → 404; kontrolyor → 403', async () => {
      const pb = await readyProtocol({ company: 'b', chemist: 'chemistB' });
      const res = await request(app)
        .get(`/api/v1/protocols/${pb.protocolId}/temperature-suggestion`)
        .set(auth('chemistB'))
        .expect(200);
      expect(res.body.data).toMatchObject({ status: 'no_room', sensorConfigId: null });
      expect(
        (
          await request(app)
            .get(`/api/v1/protocols/${pb.protocolId}/temperature-suggestion`)
            .query({ sensorConfigId: room })
            .set(auth('chemistB'))
        ).status,
      ).toBe(404);
      expect(
        (
          await request(app)
            .get(`/api/v1/protocols/${pb.protocolId}/temperature-suggestion`)
            .set(auth('chemist1'))
        ).status,
      ).toBe(404);
      const pa = await readyProtocol();
      expect(
        (
          await request(app)
            .get(`/api/v1/protocols/${pa.protocolId}/temperature-suggestion`)
            .set(auth('chemist2'))
        ).status,
      ).toBe(404);
    });
  });

  describe('peak fayllari (D-185)', () => {
    it('PDF/Word yuklanadi, rasm 415; ro‘yxat va detail; yuborilgach qulf 409; o‘chirish', async () => {
      const p = await readyProtocol();
      const up = await request(app)
        .post(`/api/v1/protocols/${p.protocolId}/peaks`)
        .set(auth('chemist1'))
        .attach('file', fixtures.pdf(), 'peak-1.pdf');
      expect(up.status).toBe(201);
      expect(up.body.data).toMatchObject({
        kind: 'peak',
        fileName: 'peak-1.pdf',
        substanceName: 'Ibuprofen',
        chemistId: users.chemist1!.id,
      });
      await request(app)
        .post(`/api/v1/protocols/${p.protocolId}/peaks`)
        .set(auth('chemist1'))
        .attach('file', fixtures.docx(), 'peak-2.docx')
        .expect(201);
      expect(
        (
          await request(app)
            .post(`/api/v1/protocols/${p.protocolId}/peaks`)
            .set(auth('chemist1'))
            .attach('file', fixtures.png(), 'p.png')
        ).status,
      ).toBe(415);
      expect(
        (
          await request(app)
            .post(`/api/v1/protocols/${p.protocolId}/peaks`)
            .set(auth('chemist2'))
            .attach('file', fixtures.pdf(), 'p.pdf')
        ).status,
      ).toBeGreaterThanOrEqual(403);
      expect(
        (
          await request(app)
            .post(`/api/v1/protocols/${p.protocolId}/peaks`)
            .set(auth('kontrolyor'))
            .attach('file', fixtures.pdf(), 'p.pdf')
        ).status,
      ).toBe(403);

      const list = await request(app)
        .get(`/api/v1/protocols/${p.protocolId}/peaks`)
        .set(auth('labHead'))
        .expect(200);
      expect(list.body.data.map((f: { fileName: string }) => f.fileName)).toEqual([
        'peak-1.pdf',
        'peak-2.docx',
      ]);
      const dl = await request(app)
        .get(`/api/v1/protocols/${p.protocolId}/files/${up.body.data.id}`)
        .set(auth('labHead'))
        .expect(200);
      expect(dl.body.data.filename).toBe('peak-1.pdf');

      await request(app)
        .post(`/api/v1/protocols/${p.protocolId}/submit`)
        .set(auth('chemist1'))
        .send({ equipmentId: hplc })
        .expect(200);
      const peakRow = await query<{ equipment_id: string }>(
        `SELECT equipment_id FROM protocol_files WHERE id = $1`,
        [up.body.data.id],
      );
      expect(peakRow.rows[0]!.equipment_id).toBe(hplc);
      expect(
        (
          await request(app)
            .post(`/api/v1/protocols/${p.protocolId}/peaks`)
            .set(auth('chemist1'))
            .attach('file', fixtures.pdf(), 'late.pdf')
        ).status,
      ).toBe(409);
      expect(
        (
          await request(app)
            .delete(`/api/v1/protocols/${p.protocolId}/peaks/${up.body.data.id}`)
            .set(auth('chemist1'))
        ).status,
      ).toBe(409);

      // Asosiy fayl bog'ini peak/extra yo'li bilan o'chirib bo'lmaydi
      const main = await query<{ id: string }>(
        `SELECT id FROM protocol_files WHERE protocol_id = $1 AND kind = 'protocol'`,
        [p.protocolId],
      );
      expect(
        (
          await request(app)
            .delete(`/api/v1/protocols/${p.protocolId}/peaks/${main.rows[0]!.id}`)
            .set(auth('labHead'))
        ).status,
      ).toBe(404);
    });
  });

  describe('rad etish tarixi (D-186)', () => {
    it('qayta yuborishda joriy sabab tozalanadi, tarix saqlanadi; tarix ko‘rinishida', async () => {
      const p = await readyProtocol();
      await request(app)
        .post(`/api/v1/protocols/${p.protocolId}/submit`)
        .set(auth('chemist1'))
        .send({})
        .expect(200);
      await request(app)
        .post(`/api/v1/protocols/${p.protocolId}/reject`)
        .set(auth('labHead'))
        .send({ reason: 'Peak fayli yo‘q' })
        .expect(200);
      await request(app)
        .post(`/api/v1/protocols/${p.protocolId}/submit`)
        .set(auth('chemist1'))
        .send({})
        .expect(200);
      await request(app)
        .post(`/api/v1/protocols/${p.protocolId}/reject`)
        .set(auth('labHead'))
        .send({ reason: 'Harorat noto‘g‘ri' })
        .expect(200);
      const resub = await request(app)
        .post(`/api/v1/protocols/${p.protocolId}/submit`)
        .set(auth('chemist1'))
        .send({})
        .expect(200);
      expect(resub.body.data.rejectionReason).toBeNull(); // avvalgi xatti-harakat saqlangan
      const detail = await request(app)
        .get(`/api/v1/protocols/${p.protocolId}`)
        .set(auth('chemist1'))
        .expect(200);
      expect(detail.body.data.rejections.map((r: { reason: string }) => r.reason)).toEqual([
        'Peak fayli yo‘q',
        'Harorat noto‘g‘ri',
      ]);
      expect(detail.body.data.rejections[0].rejectedByName).toBe(users.labHead!.fullName);

      const hist = await request(app)
        .get(`/api/v1/history/sample/${p.sampleId}`)
        .set(auth('labHead'))
        .expect(200);
      const items = hist.body.data as { type: string; data: Record<string, unknown> }[];
      expect(items.filter((i) => i.type === 'protocol_rejected').map((i) => i.data.reason)).toEqual(
        ['Peak fayli yo‘q', 'Harorat noto‘g‘ri'],
      );
      expect(items.filter((i) => i.type === 'protocol_signed').map((i) => i.data.action)).toEqual([
        'submitted',
        'submitted',
        'submitted',
      ]);
      // Vaqt tartibi
      const times = items.map((i) => (i as unknown as { at: string }).at);
      expect([...times].sort()).toEqual(times);
      // Ko'rish qoidasi: biriktirilmagan kimyogar — 404; kontrolyor ruxsatli
      expect(
        (await request(app).get(`/api/v1/history/sample/${p.sampleId}`).set(auth('chemist2')))
          .status,
      ).toBe(404);
      expect(
        (await request(app).get(`/api/v1/history/sample/${p.sampleId}`).set(auth('kontrolyorB')))
          .status,
      ).toBe(404);
    });
  });

  describe('protokollar ro‘yxati va reyestr filtri (D-187)', () => {
    let pHplc: string;
    let pUnknown: string;
    let pOther: string;
    beforeAll(async () => {
      const x = await readyProtocol({ substanceName: 'Paratsetamol', serialNumber: 'PX-100' });
      await request(app)
        .post(`/api/v1/protocols/${x.protocolId}/peaks`)
        .set(auth('chemist1'))
        .attach('file', fixtures.pdf(), 'px-peak.pdf')
        .expect(201);
      await request(app)
        .post(`/api/v1/protocols/${x.protocolId}/submit`)
        .set(auth('chemist1'))
        .send({ equipmentId: hplc, analysisDate: '2026-04-05' })
        .expect(200);
      await request(app)
        .post(`/api/v1/protocols/${x.protocolId}/approve`)
        .set(auth('labHead'))
        .expect(200);
      pHplc = x.protocolId;
      const y = await readyProtocol({ substanceName: 'Paratsetamol', serialNumber: 'PY-200' });
      await request(app)
        .post(`/api/v1/protocols/${y.protocolId}/submit`)
        .set(auth('chemist1'))
        .send({ equipmentId: null, analysisDate: '2026-04-20' })
        .expect(200);
      await request(app)
        .post(`/api/v1/protocols/${y.protocolId}/approve`)
        .set(auth('labHead'))
        .expect(200);
      pUnknown = y.protocolId;
      const z = await readyProtocol({ substanceName: 'Paratsetamol', chemist: 'chemist2' });
      pOther = z.protocolId;
      await readyProtocol({ substanceName: 'Paratsetamol', company: 'b', chemist: 'chemistB' });
    });
    const list = (who: string, q: Record<string, string>) =>
      request(app)
        .get('/api/v1/protocols')
        .query({ substanceName: 'Paratsetamol', ...q })
        .set(auth(who));

    it('filtrlar: apparat, noma’lum apparat, seriya, sana oralig‘i, holat, peak; peak fayllari ko‘rinadi', async () => {
      const byEq = await list('labHead', { equipmentId: hplc }).expect(200);
      expect(byEq.body.data.map((r: { id: string }) => r.id)).toEqual([pHplc]);
      expect(byEq.body.data[0]).toMatchObject({
        equipmentName: 'HPLC-1',
        serialNumber: 'PX-100',
        analysisDate: '2026-04-05',
        status: 'approved',
        chemistName: users.chemist1!.fullName,
        peakFiles: [{ fileName: 'px-peak.pdf' }],
      });
      const unknown = await list('labHead', { equipmentId: 'unknown' }).expect(200);
      expect(unknown.body.data.map((r: { id: string }) => r.id).sort()).toEqual(
        [pUnknown, pOther].sort(),
      );
      expect(
        (await list('labHead', { series: 'py-2' })).body.data.map((r: { id: string }) => r.id),
      ).toEqual([pUnknown]);
      const range = await list('labHead', { dateFrom: '2026-04-01', dateTo: '2026-04-10' });
      expect(range.body.data.map((r: { id: string }) => r.id)).toEqual([pHplc]);
      expect(
        (await list('labHead', { status: 'draft' })).body.data.map((r: { id: string }) => r.id),
      ).toEqual([pOther]);
      expect(
        (await list('labHead', { hasPeaks: 'true' })).body.data.map((r: { id: string }) => r.id),
      ).toEqual([pHplc]);
      const paged = await list('labHead', { limit: '1', page: '2' });
      expect(paged.body.meta).toMatchObject({ page: 2, limit: 1, total: 3 });
    });

    it('kimyogar faqat o‘zinikini; kontrolyor 403; boshqa kompaniya ko‘rinmaydi', async () => {
      const c2 = await list('chemist2', {}).expect(200);
      expect(c2.body.data.map((r: { id: string }) => r.id)).toEqual([pOther]);
      expect((await list('kontrolyor', {})).status).toBe(403);
      const dir = await list('director', {}).expect(200);
      expect(dir.body.meta.total).toBe(3);
      const bList = await list('labHeadB', {}).expect(200);
      expect(
        bList.body.data.every((r: { id: string }) => ![pHplc, pUnknown, pOther].includes(r.id)),
      ).toBe(true);
    });

    it('reyestr: apparat bo‘yicha filtr va noma’lum', async () => {
      const r1 = await request(app)
        .get('/api/v1/registry')
        .query({ substanceName: 'Paratsetamol', equipmentId: hplc })
        .set(auth('director'))
        .expect(200);
      expect(r1.body.data.map((s: { serialNumber: string }) => s.serialNumber)).toEqual(['PX-100']);
      const r2 = await request(app)
        .get('/api/v1/registry')
        .query({ substanceName: 'Paratsetamol', equipmentId: 'unknown' })
        .set(auth('director'))
        .expect(200);
      expect(r2.body.data.map((s: { serialNumber: string }) => s.serialNumber)).toEqual(['PY-200']);
      expect(
        (
          await request(app)
            .get('/api/v1/registry')
            .query({ equipmentId: 'x' })
            .set(auth('director'))
        ).status,
      ).toBe(400);
    });
  });

  describe('ND metadata (Addendum §3)', () => {
    it('xomashyo nomi, seriya, sana, kimyogar, apparat saqlanadi; boshqa kompaniya apparati — 404', async () => {
      const res = await request(app)
        .post('/api/v1/nd')
        .set(auth('labHead'))
        .send({
          code: 'ND-META',
          name: 'Monografiya',
          substanceName: 'Ibuprofen',
          series: 'S-1',
          docDate: '2026-01-15',
          chemistId: users.chemist1!.id,
          equipmentId: hplc,
        });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        substanceName: 'Ibuprofen',
        series: 'S-1',
        docDate: '2026-01-15',
        chemistName: users.chemist1!.fullName,
        equipmentName: 'HPLC-1',
      });
      const upd = await request(app)
        .put(`/api/v1/nd/${res.body.data.id}`)
        .set(auth('labHead'))
        .send({ equipmentId: null });
      expect(upd.body.data).toMatchObject({ equipmentId: null, substanceName: 'Ibuprofen' });
      expect(
        (
          await request(app)
            .put(`/api/v1/nd/${res.body.data.id}`)
            .set(auth('labHead'))
            .send({ equipmentId: hplcB })
        ).status,
      ).toBe(404);
    });
  });
});
