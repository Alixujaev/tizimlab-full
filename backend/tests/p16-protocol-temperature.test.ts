import type express from 'express';
import JSZip from 'jszip';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { query } from '../src/config/database.js';
import { submitProtocolSchema } from '../src/modules/protocols/protocols.schemas.js';
import { temperatureText } from '../src/utils/docxExport.js';
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

/** P16 / TZ §3.5 — protokolga xona harorati snapshot'i (D-173, R-P16-22..25). */

describe('submitProtocolSchema va temperatureText (unit)', () => {
  it('body ixtiyoriy; sensorConfigId UUID, analysisDate mavjud sana', () => {
    expect(submitProtocolSchema.safeParse(undefined).success).toBe(true);
    expect(submitProtocolSchema.safeParse({}).success).toBe(true);
    expect(submitProtocolSchema.safeParse({ sensorConfigId: 'x' }).success).toBe(false);
    expect(submitProtocolSchema.safeParse({ analysisDate: '2026-02-30' }).success).toBe(false);
    expect(
      submitProtocolSchema.safeParse({
        sensorConfigId: '00000000-0000-4000-8000-000000000001',
        analysisDate: '2026-03-10',
      }).success,
    ).toBe(true);
  });

  it('matn: snapshot, no_reading, no_room, hech narsa', () => {
    expect(
      temperatureText({ temperatureSnapshot: null, temperatureWarning: 'no_reading' }, 'uz'),
    ).toBe('Tahlil sanasi uchun harorat yozuvi topilmadi');
    expect(
      temperatureText({ temperatureSnapshot: null, temperatureWarning: 'no_room' }, 'en'),
    ).toBe('No room selected — temperature not linked');
    expect(temperatureText({ temperatureSnapshot: null, temperatureWarning: null })).toBe('—');
    const text = temperatureText({
      temperatureSnapshot: {
        readingId: 'r',
        sensorConfigId: 's',
        sensorId: 'S-1',
        locationName: 'Xona-1',
        temperature: 22,
        humidity: 45,
        recordedAt: '2026-03-10T08:00:00.000Z',
        isManual: true,
        alertTriggered: false,
        analysisDate: '2026-03-10',
        capturedAt: '2026-03-10T09:00:00.000Z',
      },
      temperatureWarning: null,
    });
    expect(text).toMatch(/^22 °C, 45% — Xona-1 \(10\.03\.2026 \d{2}:\d{2}\)$/);
  });
});

describeDb('protokol harorat snapshot (API)', () => {
  let db: Awaited<ReturnType<typeof setupAuthDb>>;
  let app: express.Express;
  const storage = new MemoryStorage();
  let a: TestCompany;
  let b: TestCompany;
  const users: Record<string, TestUser> = {};
  const tokens: Record<string, string> = {};
  const sensors: Record<string, string> = {};
  const readings: Record<string, string> = {};

  async function sensor(company: TestCompany, sensorId: string, location: string): Promise<string> {
    const { rows } = await query<{ id: string }>(
      `INSERT INTO sensor_configs (company_id, sensor_id, location_name, temp_min, temp_max)
       VALUES ($1, $2, $3, 15, 25) RETURNING id`,
      [company.id, sensorId, location],
    );
    return rows[0]!.id;
  }
  async function reading(
    company: TestCompany,
    sensorConfigId: string,
    at: string,
    temp: number,
  ): Promise<string> {
    const { rows } = await query<{ id: string }>(
      `INSERT INTO temperature_readings (company_id, sensor_config_id, temperature, humidity, recorded_at, is_manual)
       VALUES ($1, $2, $3, 45, $4, true) RETURNING id`,
      [company.id, sensorConfigId, temp, at],
    );
    return rows[0]!.id;
  }

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp({ storage }).app;
    a = await createCompany({ name: 'Temp A' });
    b = await createCompany({ name: 'Temp B' });
    for (const [name, role, company] of [
      ['kontrolyor', 'kontrolyor', a],
      ['labHead', 'lab_head', a],
      ['chemist1', 'chemist', a],
      ['chemist2', 'chemist', a],
      ['director', 'director', a],
    ] as const) {
      users[name] = await createUser({ role, company });
      tokens[name] = (await loginAs(app, users[name]!)).accessToken;
    }
    sensors.room1 = await sensor(a, 'S-1', 'Xona-1');
    sensors.room2 = await sensor(a, 'S-2', 'Xona-2');
    sensors.roomB = await sensor(b, 'S-1', 'B xonasi');
    // Toshkent 2026-03-10: 09:00 (04:00Z) va 13:00 (08:00Z) — 12:00 ga 13:00 yaqinroq
    readings.r0900 = await reading(a, sensors.room1, '2026-03-10T04:00:00Z', 21.5);
    readings.r1300 = await reading(a, sensors.room1, '2026-03-10T08:00:00Z', 22.0);
    readings.far = await reading(a, sensors.room1, '2026-03-14T07:00:00Z', 24.0);
    await reading(a, sensors.room2, '2026-03-20T07:00:00Z', 19.0);
    await reading(b, sensors.roomB, '2026-03-10T07:00:00Z', 30.0);
  });
  afterAll(() => db.teardown());
  beforeEach(() => storage.reset());

  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  async function readyProtocol(analysisEnd = '2026-03-10'): Promise<string> {
    const s = await request(app)
      .post('/api/v1/samples')
      .set(auth('kontrolyor'))
      .send({ type: 'raw_material', substanceName: 'Ibuprofen', analysisEnd });
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
      .attach('file', fixtures.pdf(), 'main.pdf')
      .expect(200);
    return protocolId;
  }

  const submit = (protocolId: string, body?: Record<string, unknown>, who = 'chemist1') => {
    const req = request(app).post(`/api/v1/protocols/${protocolId}/submit`).set(auth(who));
    return body ? req.send(body) : req;
  };

  it('R-P16-22: tahlil sanasi 12:00 ga eng yaqin o‘qish snapshot sifatida saqlanadi', async () => {
    const id = await readyProtocol();
    const res = await submit(id, { sensorConfigId: sensors.room1 });
    expect(res.status).toBe(200);
    expect(res.body.data.temperatureWarning).toBeNull();
    expect(res.body.data.temperatureSnapshot).toMatchObject({
      readingId: readings.r1300,
      sensorId: 'S-1',
      locationName: 'Xona-1',
      temperature: 22,
      humidity: 45,
      analysisDate: '2026-03-10',
      recordedAt: '2026-03-10T08:00:00.000Z',
    });
    const row = await query<{ sensor_config_id: string; temperature_warning: string | null }>(
      `SELECT sensor_config_id, temperature_warning FROM protocols WHERE id = $1`,
      [id],
    );
    expect(row.rows[0]).toEqual({ sensor_config_id: sensors.room1, temperature_warning: null });
  });

  it('R-P16-23: snapshot jurnal o‘zgarsa/o‘chirilsa va tasdiqlanganda o‘zgarmaydi', async () => {
    const id = await readyProtocol();
    await submit(id, { sensorConfigId: sensors.room1 }).expect(200);
    await query(`UPDATE temperature_readings SET temperature = 99 WHERE id = $1`, [readings.r1300]);
    await request(app).post(`/api/v1/protocols/${id}/approve`).set(auth('labHead')).expect(200);
    const detail = await request(app).get(`/api/v1/protocols/${id}`).set(auth('labHead'));
    expect(detail.body.data.status).toBe('approved');
    expect(detail.body.data.temperatureSnapshot.temperature).toBe(22);
    await query(`UPDATE temperature_readings SET temperature = 22 WHERE id = $1`, [readings.r1300]);
  });

  it('R-P16-24: oynada yozuv yo‘q — no_reading; xona tanlanmagan — no_room; yuborish bloklanmaydi', async () => {
    const id1 = await readyProtocol('2026-03-12'); // 12-mart 12:00 ±24h da S-1 o'qishi yo'q
    const r1 = await submit(id1, { sensorConfigId: sensors.room1 });
    expect(r1.status).toBe(200);
    expect(r1.body.data).toMatchObject({
      status: 'submitted',
      sensorConfigId: sensors.room1,
      temperatureSnapshot: null,
      temperatureWarning: 'no_reading',
    });

    const id2 = await readyProtocol();
    const r2 = await submit(id2);
    expect(r2.status).toBe(200);
    expect(r2.body.data).toMatchObject({
      temperatureSnapshot: null,
      temperatureWarning: 'no_room',
    });
  });

  it('R-P16-22: analysisDate so‘rovda berilsa namuna sanasi o‘rniga ishlatiladi; oyna chegarasi ±24 soat', async () => {
    const id = await readyProtocol('2026-03-01');
    const res = await submit(id, { sensorConfigId: sensors.room1, analysisDate: '2026-03-13' });
    // 13-mart 12:00 Toshkent = 07:00Z; 14-mart 07:00Z o'qishi aniq 24 soat — oyna ichida (inklyuziv)
    expect(res.body.data.temperatureSnapshot?.readingId).toBe(readings.far);
    const id2 = await readyProtocol('2026-03-01');
    const res2 = await submit(id2, { sensorConfigId: sensors.room1, analysisDate: '2026-03-12' });
    expect(res2.body.data.temperatureWarning).toBe('no_reading');
  });

  it('qayta yuborishda (rad etilgandan keyin) snapshot yangilanadi', async () => {
    const id = await readyProtocol();
    await submit(id, { sensorConfigId: sensors.room1 }).expect(200);
    await request(app)
      .post(`/api/v1/protocols/${id}/reject`)
      .set(auth('labHead'))
      .send({ reason: 'Harorat xonasi noto‘g‘ri' })
      .expect(200);
    const again = await submit(id, { sensorConfigId: sensors.room2, analysisDate: '2026-03-20' });
    expect(again.status).toBe(200);
    expect(again.body.data.temperatureSnapshot).toMatchObject({
      locationName: 'Xona-2',
      temperature: 19,
    });
  });

  it('tenant: boshqa kompaniya sensori — 404, protokol holati o‘zgarmaydi', async () => {
    const id = await readyProtocol();
    const res = await submit(id, { sensorConfigId: sensors.roomB });
    expect(res.status).toBe(404);
    const p = await query<{ status: string; temperature_snapshot: unknown }>(
      `SELECT status::text, temperature_snapshot FROM protocols WHERE id = $1`,
      [id],
    );
    expect(p.rows[0]).toEqual({ status: 'draft', temperature_snapshot: null });
  });

  it('rol: biriktirilmagan kimyogar, lab_head, director yubora olmaydi (403); noto‘g‘ri body — 400', async () => {
    const id = await readyProtocol();
    for (const who of ['chemist2', 'labHead', 'director']) {
      expect((await submit(id, { sensorConfigId: sensors.room1 }, who)).status).toBe(403);
    }
    expect((await submit(id, { sensorConfigId: 'bad' })).status).toBe(400);
    expect((await submit(id, { analysisDate: '10.03.2026' })).status).toBe(400);
  });

  it('R-P16-25: DOCX eksportda xona harorati qatori', async () => {
    const id = await readyProtocol();
    await submit(id, { sensorConfigId: sensors.room1 }).expect(200);
    const res = await request(app)
      .get(`/api/v1/protocols/${id}/export?lang=uz`)
      .set(auth('labHead'))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    const xml = await (
      await JSZip.loadAsync(res.body as Buffer)
    )
      .file('word/document.xml')!
      .async('string');
    expect(xml).toContain('Xona harorati');
    expect(xml).toContain('22 °C, 45% — Xona-1');
  });
});
