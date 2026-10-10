import type express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { query } from '../src/config/database.js';
import { setNotificationChannel } from '../src/modules/notifications/notifications.service.js';
import type { NotificationDto } from '../src/modules/notifications/notifications.types.js';
import { testApp } from './helpers/app.js';
import { createCompany, createUser, loginAs, setupAuthDb, type TestUser } from './helpers/auth.js';
import { describeDb } from './helpers/db.js';

type Db = Awaited<ReturnType<typeof setupAuthDb>>;

describeDb('P8: Harorat monitoringi (spec §7, SCHEMA_DIFF P8, D-52, D-78, D-83, D-137..D-140)', () => {
  let db: Db;
  let app: express.Express;
  const tokens: Record<string, string> = {};
  const users: Record<string, TestUser> = {};
  let pushed: { userId: string; n: NotificationDto }[] = [];

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp().app;

    const a = await createCompany({ name: 'Alpha Pharma Lab' });
    const b = await createCompany({ name: 'Beta Pharma Lab' });

    const specs: [string, TestUser['role'], typeof a | null][] = [
      ['admin', 'admin', a],
      ['labHead', 'lab_head', a],
      ['chemist', 'chemist', a],
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
    await query('DELETE FROM temperature_alerts');
    await query('DELETE FROM temperature_readings');
    await query('DELETE FROM sensor_configs');
    await query('DELETE FROM notifications');
  });

  afterEach(() => setNotificationChannel('test', null));

  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  describe('1. RBAC ruxsatlar matritsasi', () => {
    it('kontrolyor, chemist va director faqat ko‘ra oladi (temperature:view), yozish (temperature:write) taqiqlanadi (403)', async () => {
      // 1. Admin sensor yaratadi
      const createRes = await request(app)
        .post('/api/v1/temperature/sensors')
        .set(auth('admin'))
        .send({
          sensorId: 'SENSOR-RBAC',
          locationName: 'Steril xona',
          tempMin: 18,
          tempMax: 24,
        });
      expect(createRes.status).toBe(201);
      const sensorId = createRes.body.data.id;

      // 2. Ko'rish rollari status va sensorlar ro'yxatini ko'ra oladi
      for (const role of ['kontrolyor', 'chemist', 'director']) {
        const viewRes = await request(app).get('/api/v1/temperature/sensors').set(auth(role));
        expect(viewRes.status, `${role} sensorlarni ko'ra olmadi`).toBe(200);
        expect(viewRes.body.data).toHaveLength(1);

        const statusRes = await request(app).get('/api/v1/temperature/status').set(auth(role));
        expect(statusRes.status, `${role} statusni ko'ra olmadi`).toBe(200);

        // 3. Lekin yozish amallarini bajara olmaydi (403)
        const sensorWriteRes = await request(app)
          .post('/api/v1/temperature/sensors')
          .set(auth(role))
          .send({
            sensorId: `SENSOR-${role}`,
            locationName: 'Test xona',
            tempMin: 15,
            tempMax: 25,
          });
        expect(sensorWriteRes.status, `${role} sensor yarata oldi`).toBe(403);

        const readingWriteRes = await request(app)
          .post('/api/v1/temperature/readings')
          .set(auth(role))
          .send({
            sensorConfigId: sensorId,
            temperature: 20,
          });
        expect(readingWriteRes.status, `${role} ko'rsatkich kirita oldi`).toBe(403);
      }
    });

    it('super_admin kompaniya marshrutlariga kira olmaydi (403)', async () => {
      const res = await request(app).get('/api/v1/temperature/sensors').set(auth('superAdmin'));
      expect(res.status).toBe(403);
    });

    it('lab_head va admin to‘liq boshqara oladi (temperature:view va temperature:write)', async () => {
      for (const role of ['labHead', 'admin']) {
        const res = await request(app)
          .post('/api/v1/temperature/sensors')
          .set(auth(role))
          .send({
            sensorId: `SENSOR-FULL-${role}`,
            locationName: `${role} xonasi`,
            tempMin: 15,
            tempMax: 25,
            apiKey: `key-${role}`,
          });
        expect(res.status).toBe(201);
      }
    });
  });

  describe('2. Sensor sozlamalari CRUD va validatsiya', () => {
    it('tempMin >= tempMax bo‘lsa validatsiya xatosi (400) beradi', async () => {
      const res = await request(app)
        .post('/api/v1/temperature/sensors')
        .set(auth('admin'))
        .send({
          sensorId: 'SENSOR-INV-1',
          locationName: 'Xona 1',
          tempMin: 30,
          tempMax: 20,
        });
      expect(res.status).toBe(400);
    });

    it('harorat jismoniy diapazondan tashqarida bo‘lsa ([-100, 100]) rad etiladi (400)', async () => {
      const res = await request(app)
        .post('/api/v1/temperature/sensors')
        .set(auth('admin'))
        .send({
          sensorId: 'SENSOR-INV-2',
          locationName: 'Xona 2',
          tempMin: -150,
          tempMax: 20,
        });
      expect(res.status).toBe(400);
    });

    it('bitta kompaniyada bir xil sensorId takrorlansa (409 CONFLICT) beradi', async () => {
      const s1 = await request(app)
        .post('/api/v1/temperature/sensors')
        .set(auth('admin'))
        .send({
          sensorId: 'SENSOR-DUP',
          locationName: 'Xona A',
          tempMin: 15,
          tempMax: 25,
        });
      expect(s1.status).toBe(201);

      const s2 = await request(app)
        .post('/api/v1/temperature/sensors')
        .set(auth('admin'))
        .send({
          sensorId: 'SENSOR-DUP',
          locationName: 'Xona B',
          tempMin: 10,
          tempMax: 20,
        });
      expect(s2.status).toBe(409);
    });

    it('sensor yangilash va o‘chirish (o‘qishlar mavjud bo‘lsa o‘chirish taqiqlanadi)', async () => {
      const created = await request(app)
        .post('/api/v1/temperature/sensors')
        .set(auth('admin'))
        .send({
          sensorId: 'SENSOR-DEL-TEST',
          locationName: 'Ombor',
          tempMin: 10,
          tempMax: 20,
        });
      const id = created.body.data.id;

      // Yangilash
      const updated = await request(app)
        .put(`/api/v1/temperature/sensors/${id}`)
        .set(auth('admin'))
        .send({
          locationName: 'Yangi Ombor',
          tempMin: 12,
          tempMax: 22,
        });
      expect(updated.status).toBe(200);
      expect(updated.body.data.locationName).toBe('Yangi Ombor');

      // O'qish kiritish
      await request(app)
        .post('/api/v1/temperature/readings')
        .set(auth('admin'))
        .send({
          sensorConfigId: id,
          temperature: 15,
        });

      // O'qish mavjud bo'lganda o'chirish 409
      const delFailed = await request(app)
        .delete(`/api/v1/temperature/sensors/${id}`)
        .set(auth('admin'));
      expect(delFailed.status).toBe(409);
    });
  });

  describe('3. Chegara tekshiruvi, Alert mantiqi va P6 xabarnomasi', () => {
    it('me’yordagi ko‘rsatkich alert_triggered = false bo‘ladi va alert yaratilmaydi', async () => {
      const sensor = await request(app)
        .post('/api/v1/temperature/sensors')
        .set(auth('admin'))
        .send({
          sensorId: 'SENSOR-NORMAL',
          locationName: 'Sovutgich 1',
          tempMin: 2,
          tempMax: 8,
          humidityMin: 30,
          humidityMax: 60,
        });
      const sensorId = sensor.body.data.id;

      const readingRes = await request(app)
        .post('/api/v1/temperature/readings')
        .set(auth('admin'))
        .send({
          sensorConfigId: sensorId,
          temperature: 5.5,
          humidity: 45,
        });

      expect(readingRes.status).toBe(201);
      expect(readingRes.body.data.reading.alertTriggered).toBe(false);
      expect(readingRes.body.data.alertsCreated).toBe(0);

      const alertsRes = await request(app).get('/api/v1/temperature/alerts').set(auth('admin'));
      expect(alertsRes.body.data).toHaveLength(0);
      expect(pushed).toHaveLength(0);
    });

    it('harorat temp_max dan oshganda alert_triggered = true, alert yoziladi va P6 xabarnomasi ketadi', async () => {
      const sensor = await request(app)
        .post('/api/v1/temperature/sensors')
        .set(auth('admin'))
        .send({
          sensorId: 'SENSOR-HIGH',
          locationName: 'Sovutgich 2',
          tempMin: 2,
          tempMax: 8,
        });
      const sensorId = sensor.body.data.id;

      const readingRes = await request(app)
        .post('/api/v1/temperature/readings')
        .set(auth('admin'))
        .send({
          sensorConfigId: sensorId,
          temperature: 12.4,
        });

      expect(readingRes.status).toBe(201);
      expect(readingRes.body.data.reading.alertTriggered).toBe(true);
      expect(readingRes.body.data.alertsCreated).toBe(1);

      // Alertlar ro'yxatida ko'rinadi
      const alertsRes = await request(app).get('/api/v1/temperature/alerts').set(auth('admin'));
      expect(alertsRes.body.data).toHaveLength(1);
      const alert = alertsRes.body.data[0];
      expect(alert.alertType).toBe('temp_high');
      expect(alert.temperature).toBe(12.4);
      expect(alert.resolvedAt).toBeNull();

      // P6 xabarnomasi (D-04, D-13 bo'yicha lab_head va admin rollariga, harakat egasi admin bo'lgani uchun labHead ga ketadi)
      const labHeadNotif = pushed.find((p) => p.userId === users.labHead!.id);
      expect(labHeadNotif).toBeDefined();
      expect(labHeadNotif!.n.type).toBe('temperature_alert');
    });

    it('harorat temp_min dan tushganda temp_low alerti yaratiladi', async () => {
      const sensor = await request(app)
        .post('/api/v1/temperature/sensors')
        .set(auth('admin'))
        .send({
          sensorId: 'SENSOR-LOW',
          locationName: 'Xona 3',
          tempMin: 18,
          tempMax: 25,
        });
      const sensorId = sensor.body.data.id;

      const readingRes = await request(app)
        .post('/api/v1/temperature/readings')
        .set(auth('admin'))
        .send({
          sensorConfigId: sensorId,
          temperature: 14.0,
        });

      expect(readingRes.status).toBe(201);
      expect(readingRes.body.data.reading.alertTriggered).toBe(true);
      expect(readingRes.body.data.alertsCreated).toBe(1);

      const alertsRes = await request(app).get('/api/v1/temperature/alerts').set(auth('admin'));
      expect(alertsRes.body.data[0].alertType).toBe('temp_low');
    });
  });

  describe('4. Takroriy alertlarni cheklash (Debouncing / Cooldown)', () => {
    it('15 daqiqa ichida xuddi shu sensorda xuddi shu chegara buzilsa, takroriy alert yozilmaydi', async () => {
      const sensor = await request(app)
        .post('/api/v1/temperature/sensors')
        .set(auth('admin'))
        .send({
          sensorId: 'SENSOR-DEBOUNCE',
          locationName: 'Reaktivlar ombori',
          tempMin: 15,
          tempMax: 25,
        });
      const sensorId = sensor.body.data.id;

      // 1-o'qish: alert yaratiladi
      const r1 = await request(app)
        .post('/api/v1/temperature/readings')
        .set(auth('admin'))
        .send({
          sensorConfigId: sensorId,
          temperature: 28.5,
        });
      expect(r1.body.data.alertsCreated).toBe(1);

      // 2-o'qish (darhol keyin): alert_triggered = true, lekin alertsCreated = 0 (takroriy alert cheklanadi)
      const r2 = await request(app)
        .post('/api/v1/temperature/readings')
        .set(auth('admin'))
        .send({
          sensorConfigId: sensorId,
          temperature: 29.0,
        });
      expect(r2.body.data.reading.alertTriggered).toBe(true);
      expect(r2.body.data.alertsCreated).toBe(0);

      // Jami alertlar soni 1 ta bo'lib qoladi
      const alerts = await request(app).get('/api/v1/temperature/alerts').set(auth('admin'));
      expect(alerts.body.data).toHaveLength(1);
    });
  });

  describe('5. IoT / Qurilma orqali o‘qish ingest qilish (D-137)', () => {
    it('X-Sensor-Key sarlavhasi orqali autentifikatsiyasiz o‘qish qabul qilinadi', async () => {
      const sensor = await request(app)
        .post('/api/v1/temperature/sensors')
        .set(auth('admin'))
        .send({
          sensorId: 'IOT-001',
          locationName: 'Avtomatlashtirilgan xona',
          tempMin: 15,
          tempMax: 25,
          apiKey: 'secret-sensor-token-xyz',
        });
      const sensorId = sensor.body.data.id;

      // Sessiyasiz (Authorization sarlavhasisiz) X-Sensor-Key bilan yuborish
      const ingestRes = await request(app)
        .post('/api/v1/temperature/readings/ingest')
        .set('X-Sensor-Key', 'secret-sensor-token-xyz')
        .send({
          sensorId: 'IOT-001',
          temperature: 21.5,
          humidity: 48,
        });

      expect(ingestRes.status).toBe(201);
      expect(ingestRes.body.data.reading.isManual).toBe(false);
      expect(ingestRes.body.data.reading.temperature).toBe(21.5);
      expect(ingestRes.body.data.reading.sensorConfigId).toBe(sensorId);

      // Noto'g'ri kalit bilan yuborilsa 401
      const badKeyRes = await request(app)
        .post('/api/v1/temperature/readings/ingest')
        .set('X-Sensor-Key', 'wrong-key')
        .send({
          temperature: 21.5,
        });
      expect(badKeyRes.status).toBe(401);
    });
  });

  describe('6. Alertni yopish (Resolve alert, D-139)', () => {
    it('lab_head yoki admin alertni yopishi mumkin (resolved_at, resolved_by, note)', async () => {
      const sensor = await request(app)
        .post('/api/v1/temperature/sensors')
        .set(auth('admin'))
        .send({
          sensorId: 'SENSOR-RESOLVE',
          locationName: 'Termostat 5',
          tempMin: 20,
          tempMax: 25,
        });
      const sensorId = sensor.body.data.id;

      await request(app)
        .post('/api/v1/temperature/readings')
        .set(auth('admin'))
        .send({
          sensorConfigId: sensorId,
          temperature: 30.0,
        });

      const alertsRes = await request(app).get('/api/v1/temperature/alerts').set(auth('admin'));
      const alertId = alertsRes.body.data[0].id;

      // Chemist yopishga urinsa 403
      const chemistRes = await request(app)
        .post(`/api/v1/temperature/alerts/${alertId}/resolve`)
        .set(auth('chemist'))
        .send({ resolutionNote: 'Men tuzatdim' });
      expect(chemistRes.status).toBe(403);

      // Lab head yopadi
      const resolveRes = await request(app)
        .post(`/api/v1/temperature/alerts/${alertId}/resolve`)
        .set(auth('labHead'))
        .send({ resolutionNote: 'Sovutgich eshigi yopildi, harorat normallashdi' });
      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.data.resolvedAt).not.toBeNull();
      expect(resolveRes.body.data.resolvedBy).toBe(users.labHead!.id);
      expect(resolveRes.body.data.resolutionNote).toBe('Sovutgich eshigi yopildi, harorat normallashdi');

      // Unresolved filtri bilan tekshirilsa 0 ta chiqadi
      const unresolvedRes = await request(app)
        .get('/api/v1/temperature/alerts?unresolvedOnly=true')
        .set(auth('admin'));
      expect(unresolvedRes.body.data).toHaveLength(0);
    });
  });

  describe('7. Multi-tenant izolyatsiyasi (D-12, D-102)', () => {
    it('Kompaniya B foydalanuvchisi Kompaniya A sensorlari, ko‘rsatkichlari va alertlarini ko‘ra olmaydi', async () => {
      // 1. Kompaniya A sensori va ko'rsatkichi
      const sA = await request(app)
        .post('/api/v1/temperature/sensors')
        .set(auth('admin'))
        .send({
          sensorId: 'SENSOR-COMPANY-A',
          locationName: 'A laboratoriyasi',
          tempMin: 15,
          tempMax: 25,
        });
      const sensorAId = sA.body.data.id;

      await request(app)
        .post('/api/v1/temperature/readings')
        .set(auth('admin'))
        .send({
          sensorConfigId: sensorAId,
          temperature: 35.0, // Alert chiqaradi
        });

      // 2. Kompaniya B tekshiradi
      const bSensors = await request(app).get('/api/v1/temperature/sensors').set(auth('adminB'));
      expect(bSensors.body.data).toHaveLength(0);

      const bReadings = await request(app).get('/api/v1/temperature/readings').set(auth('adminB'));
      expect(bReadings.body.data).toHaveLength(0);

      const bAlerts = await request(app).get('/api/v1/temperature/alerts').set(auth('adminB'));
      expect(bAlerts.body.data).toHaveLength(0);

      const bStatus = await request(app).get('/api/v1/temperature/status').set(auth('adminB'));
      expect(bStatus.body.data).toHaveLength(0);

      // 3. Kompaniya B Kompaniya A sensori id si bo'yicha kirishga urinsa 404
      const bGetOne = await request(app)
        .get(`/api/v1/temperature/sensors/${sensorAId}`)
        .set(auth('adminB'));
      expect(bGetOne.status).toBe(404);

      // 4. Kompaniya B Kompaniya A sensori ustiga o'qish yoza olmaydi (404)
      const bWriteReading = await request(app)
        .post('/api/v1/temperature/readings')
        .set(auth('adminB'))
        .send({
          sensorConfigId: sensorAId,
          temperature: 20,
        });
      expect(bWriteReading.status).toBe(404);
    });
  });

  describe('8. Sahifalash va sana oralig‘i filtri (D-22)', () => {
    it('o‘qishlar sahifalash va from/to sanalari bo‘yicha filtrlanadi', async () => {
      const sensor = await request(app)
        .post('/api/v1/temperature/sensors')
        .set(auth('admin'))
        .send({
          sensorId: 'SENSOR-FILTER',
          locationName: 'Filtr xonasi',
          tempMin: 10,
          tempMax: 30,
        });
      const sensorId = sensor.body.data.id;

      // 5 ta o'qish kiritish
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post('/api/v1/temperature/readings')
          .set(auth('admin'))
          .send({
            sensorConfigId: sensorId,
            temperature: 20 + i,
            recordedAt: new Date(Date.now() - (6 - i) * 60000).toISOString(),
          });
      }

      const p1 = await request(app)
        .get(`/api/v1/temperature/readings?sensorConfigId=${sensorId}&limit=2&page=1`)
        .set(auth('admin'));
      expect(p1.status).toBe(200);
      expect(p1.body.data).toHaveLength(2);
      expect(p1.body.meta).toEqual({ page: 1, limit: 2, total: 5 });

      const p2 = await request(app)
        .get(`/api/v1/temperature/readings?sensorConfigId=${sensorId}&limit=2&page=2`)
        .set(auth('admin'));
      expect(p2.body.data).toHaveLength(2);
    });
  });
});
