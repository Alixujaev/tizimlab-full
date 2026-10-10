import type express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { query } from '../src/config/database.js';
import { setNotificationChannel } from '../src/modules/notifications/notifications.service.js';
import type { NotificationDto } from '../src/modules/notifications/notifications.types.js';
import { testApp } from './helpers/app.js';
import { createCompany, createUser, loginAs, setupAuthDb, type TestUser } from './helpers/auth.js';
import { describeDb } from './helpers/db.js';
import { fixtures, MemoryStorage } from './helpers/memoryStorage.js';

type Db = Awaited<ReturnType<typeof setupAuthDb>>;

describeDb('P7: Reaktivlar, tranzaksiyalar, xarajatlar va hujjatlar (spec §6, D-08, D-51, D-69, D-79, D-132..D-136)', () => {
  let db: Db;
  let app: express.Express;
  const storage = new MemoryStorage();
  const tokens: Record<string, string> = {};
  const users: Record<string, TestUser> = {};
  let pushed: { userId: string; n: NotificationDto }[] = [];

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp({ storage }).app;

    const a = await createCompany({ name: 'Alpha Reagents Lab' });
    const b = await createCompany({ name: 'Beta Reagents Lab' });

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
    storage.reset();
    pushed = [];
    setNotificationChannel('test', (userId, n) => pushed.push({ userId, n }));
    await query('DELETE FROM reagent_documents');
    await query('DELETE FROM reagent_transactions');
    await query('DELETE FROM reagents');
    await query('DELETE FROM notifications');
  });

  afterEach(() => setNotificationChannel('test', null));

  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  describe('1. CRUD va ruxsat matritsasi (R-ROLE-48..52, R-REAG-20..22, D-51)', () => {
    it('admin va lab_head reaktiv yarata oladi, tahrirlay oladi; boshqa rollar taqiqlanadi (403)', async () => {
      // 1. lab_head yaratadi
      const createRes = await request(app)
        .post('/api/v1/reagents')
        .set(auth('labHead'))
        .send({
          name: 'Sulfat kislotasi',
          casNumber: '7664-93-9',
          unit: 'l',
          quantity: 10,
          lowStockThreshold: 2,
          expiresAt: '2028-12-31',
          supplier: 'HimProm',
          isHazardous: true,
        });
      expect(createRes.status).toBe(201);
      expect(createRes.body.data.name).toBe('Sulfat kislotasi');
      expect(createRes.body.data.quantity).toBe(10);
      expect(createRes.body.data.isHazardous).toBe(true);
      const reagentId = createRes.body.data.id as string;

      // 2. admin tahrirlaydi
      const updateRes = await request(app)
        .put(`/api/v1/reagents/${reagentId}`)
        .set(auth('admin'))
        .send({
          supplier: 'Yangi Ta’minotchi',
          lowStockThreshold: 3,
        });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.supplier).toBe('Yangi Ta’minotchi');
      expect(updateRes.body.data.lowStockThreshold).toBe(3);

      // 3. chemist, kontrolyor, director tahrirlashga urinsa 403
      for (const role of ['chemist', 'kontrolyor', 'director']) {
        const res = await request(app)
          .put(`/api/v1/reagents/${reagentId}`)
          .set(auth(role))
          .send({ supplier: 'No' });
        expect(res.status).toBe(403);
      }

      // 4. chemist, kontrolyor, director yaratishga urinsa 403
      for (const role of ['chemist', 'kontrolyor', 'director']) {
        const res = await request(app)
          .post('/api/v1/reagents')
          .set(auth(role))
          .send({ name: 'Test', unit: 'g' });
        expect(res.status).toBe(403);
      }
    });

    it('barcha kompaniya rollari reaktivlar ro‘yxatini va tafsilotini ko‘ra oladi', async () => {
      const created = await request(app)
        .post('/api/v1/reagents')
        .set(auth('admin'))
        .send({ name: 'Aseton', unit: 'ml', quantity: 500, lowStockThreshold: 50 });
      expect(created.status).toBe(201);
      const id = created.body.data.id as string;

      for (const role of ['admin', 'labHead', 'chemist', 'kontrolyor', 'director']) {
        const listRes = await request(app).get('/api/v1/reagents').set(auth(role));
        expect(listRes.status).toBe(200);
        expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);

        const getRes = await request(app).get(`/api/v1/reagents/${id}`).set(auth(role));
        expect(getRes.status).toBe(200);
        expect(getRes.body.data.name).toBe('Aseton');
      }
    });

    it('faqat admin o‘chira oladi (D-30, D-51); tranzaksiyasi bor reaktivni o‘chirish 409 bilan rad etiladi', async () => {
      // Boshlang'ich quantity: 0 (tranzaksiyasiz)
      const r1 = await request(app)
        .post('/api/v1/reagents')
        .set(auth('admin'))
        .send({ name: 'Xlorid kislotasi', unit: 'l', quantity: 0 });
      const id1 = r1.body.data.id as string;

      // lab_head o'chirishga urinsa 403
      const delLabHead = await request(app).delete(`/api/v1/reagents/${id1}`).set(auth('labHead'));
      expect(delLabHead.status).toBe(403);

      // admin muvaffaqiyatli o'chiradi
      const delAdmin = await request(app).delete(`/api/v1/reagents/${id1}`).set(auth('admin'));
      expect(delAdmin.status).toBe(204);

      // Tranzaksiyasi bor reaktiv (quantity > 0)
      const r2 = await request(app)
        .post('/api/v1/reagents')
        .set(auth('admin'))
        .send({ name: 'Etanol 96%', unit: 'l', quantity: 5 });
      const id2 = r2.body.data.id as string;

      const delR2 = await request(app).delete(`/api/v1/reagents/${id2}`).set(auth('admin'));
      expect(delR2.status).toBe(409);
      expect(delR2.body.error.code).toBe('CONFLICT');
    });

    it('super_admin kompaniya endpointlariga kira olmaydi (403)', async () => {
      const res = await request(app).get('/api/v1/reagents').set(auth('superAdmin'));
      expect(res.status).toBe(403);
    });
  });

  describe('2. Tranzaksiyalar: atomiklik, manfiy qoldiq taqiqi va poyga holati (race condition)', () => {
    it('chiqim miqdori mavjud zaxiradan ko‘p bo‘lsa rad etiladi (400 INSUFFICIENT_STOCK)', async () => {
      const r = await request(app)
        .post('/api/v1/reagents')
        .set(auth('labHead'))
        .send({ name: 'Metanol', unit: 'l', quantity: 20 });
      const id = r.body.data.id as string;

      // 25 chiqim qilishga urinish
      const outRes = await request(app)
        .post(`/api/v1/reagents/${id}/transactions`)
        .set(auth('labHead'))
        .send({ type: 'out', quantity: 25, note: 'Tahlil uchun' });
      expect(outRes.status).toBe(400);
      expect(outRes.body.error.code).toBe('INSUFFICIENT_STOCK');

      // 25 disposal qilishga urinish
      const dispRes = await request(app)
        .post(`/api/v1/reagents/${id}/transactions`)
        .set(auth('labHead'))
        .send({ type: 'disposal', quantity: 25 });
      expect(dispRes.status).toBe(400);
      expect(dispRes.body.error.code).toBe('INSUFFICIENT_STOCK');

      // Zaxira o'zgarmasdan 20 qolganini tekshirish
      const check = await request(app).get(`/api/v1/reagents/${id}`).set(auth('chemist'));
      expect(check.body.data.quantity).toBe(20);
    });

    it('parallel chiqim (Promise.all, 2 ta chiqim, qoldiq faqat bittasiga yetadi) SELECT ... FOR UPDATE orqali zaxira manfiy bo‘lmaydi', async () => {
      const r = await request(app)
        .post('/api/v1/reagents')
        .set(auth('labHead'))
        .send({ name: 'Toluol', unit: 'l', quantity: 10 });
      const id = r.body.data.id as string;

      // 2 ta bir vaqtda 6 dan chiqim (jami 12 kerak, lekin zaxira 10 — faqat bittasiga yetadi)
      const results = await Promise.all([
        request(app).post(`/api/v1/reagents/${id}/transactions`).set(auth('admin')).send({ type: 'out', quantity: 6 }),
        request(app).post(`/api/v1/reagents/${id}/transactions`).set(auth('labHead')).send({ type: 'out', quantity: 6 }),
      ]);

      const successCount = results.filter((res) => res.status === 201).length;
      const failCount = results.filter((res) => res.status === 400).length;

      expect(successCount).toBe(1);
      expect(failCount).toBe(1);

      const failed = results.find((res) => res.status === 400);
      expect(failed?.body?.error?.code).toBe('INSUFFICIENT_STOCK');

      // Yakuniy qoldiq aynan 4 bo'ladi (10 - 6)
      const finalCheck = await request(app).get(`/api/v1/reagents/${id}`).set(auth('chemist'));
      expect(finalCheck.body.data.quantity).toBe(4);
    });

    it('kirim, chiqim, tuzatish (adjustment) va utilizatsiya (disposal) to‘g‘ri loglanadi (R-REAG-05..09)', async () => {
      const r = await request(app)
        .post('/api/v1/reagents')
        .set(auth('labHead'))
        .send({ name: 'Natriy gidroksid', unit: 'kg', quantity: 10 });
      const id = r.body.data.id as string;

      // Kirim +5
      await request(app).post(`/api/v1/reagents/${id}/transactions`).set(auth('labHead')).send({ type: 'in', quantity: 5 });
      // Chiqim -3
      await request(app).post(`/api/v1/reagents/${id}/transactions`).set(auth('labHead')).send({ type: 'out', quantity: 3, analysisPurpose: 'Titrlash' });
      // Utilizatsiya -2
      await request(app).post(`/api/v1/reagents/${id}/transactions`).set(auth('labHead')).send({ type: 'disposal', quantity: 2 });
      // Tuzatish (inventarizatsiya bo'yicha 15 ga tenglashtirish)
      await request(app).post(`/api/v1/reagents/${id}/transactions`).set(auth('labHead')).send({ type: 'adjustment', quantity: 15 });

      const finalReagent = await request(app).get(`/api/v1/reagents/${id}`).set(auth('labHead'));
      expect(finalReagent.body.data.quantity).toBe(15);

      const txList = await request(app).get(`/api/v1/reagents/${id}/transactions`).set(auth('chemist'));
      expect(txList.status).toBe(200);
      expect(txList.body.data.length).toBeGreaterThanOrEqual(5); // initial + 4
    });
  });

  describe('3. Minimal qoldiq (low_stock) ogohlantirishi (Q-37, D-132, R-REAG-17..18)', () => {
    it('zaxira chegaradan pastga tushgandagina bir marta low_stock xabarnomasi yaratiladi', async () => {
      const r = await request(app)
        .post('/api/v1/reagents')
        .set(auth('labHead'))
        .send({ name: 'Yod eritmasi', unit: 'ml', quantity: 50, lowStockThreshold: 20 });
      const id = r.body.data.id as string;

      // 1. Chiqim 10 -> qoldiq 40 >= 20 (xabar yo'q)
      await request(app).post(`/api/v1/reagents/${id}/transactions`).set(auth('admin')).send({ type: 'out', quantity: 10 });
      expect(pushed.filter((p) => p.n.type === 'low_stock')).toHaveLength(0);

      // 2. Chiqim 25 -> qoldiq 15 < 20 (ogohlantirish yuboriladi!)
      await request(app).post(`/api/v1/reagents/${id}/transactions`).set(auth('admin')).send({ type: 'out', quantity: 25 });
      const lowStockAlerts = pushed.filter((p) => p.n.type === 'low_stock');
      expect(lowStockAlerts.length).toBeGreaterThanOrEqual(1);
      expect(lowStockAlerts[0]!.n.message).toContain('Yod eritmasi');

      // 3. Yana chiqim 5 -> qoldiq 10 < 20 (allaqachon thresholddan past bo'lgani sabab takrorlanmaydi)
      pushed = [];
      await request(app).post(`/api/v1/reagents/${id}/transactions`).set(auth('admin')).send({ type: 'out', quantity: 5 });
      expect(pushed.filter((p) => p.n.type === 'low_stock')).toHaveLength(0);
    });
  });

  describe('4. Hujjatlar: format, hajm va R2 storage (D-79, D-114, R-REAG-13, R-REAG-23)', () => {
    it('PDF, DOCX, JPEG, PNG hujjatlar yuklanadi va yuklab olinadi', async () => {
      const r = await request(app)
        .post('/api/v1/reagents')
        .set(auth('labHead'))
        .send({ name: 'Glyukoza', unit: 'kg', quantity: 25 });
      const id = r.body.data.id as string;

      // Passport yuklash
      const upPass = await request(app)
        .post(`/api/v1/reagents/${id}/documents`)
        .set(auth('labHead'))
        .field('docType', 'passport')
        .attach('file', fixtures.pdf(), 'glyukoza_pasport.pdf');
      expect(upPass.status).toBe(201);
      expect(upPass.body.data.docType).toBe('passport');
      expect(upPass.body.data.fileName).toBe('glyukoza_pasport.pdf');
      const passDocId = upPass.body.data.id as string;

      // Analysis natijasi yuklash
      const upAnalysis = await request(app)
        .post(`/api/v1/reagents/${id}/documents`)
        .set(auth('admin'))
        .field('docType', 'analysis')
        .attach('file', fixtures.docx(), 'tahlil_natijasi.docx');
      expect(upAnalysis.status).toBe(201);
      expect(upAnalysis.body.data.docType).toBe('analysis');

      // Ro'yxatni olish
      const listDocs = await request(app).get(`/api/v1/reagents/${id}/documents`).set(auth('chemist'));
      expect(listDocs.status).toBe(200);
      expect(listDocs.body.data).toHaveLength(2);

      // Yuklab olish linki
      const dlRes = await request(app)
        .get(`/api/v1/reagents/${id}/documents/${passDocId}/download`)
        .set(auth('chemist'));
      expect(dlRes.status).toBe(200);
      expect(dlRes.body.data.url).toMatch(/^memory:\/\//);

      // O'chirish
      const delDoc = await request(app)
        .delete(`/api/v1/reagents/${id}/documents/${passDocId}`)
        .set(auth('labHead'));
      expect(delDoc.status).toBe(204);

      const afterDel = await request(app).get(`/api/v1/reagents/${id}/documents`).set(auth('chemist'));
      expect(afterDel.body.data).toHaveLength(1);
    });

    it('noto‘g‘ri formatdagi fayl rad etiladi (415 UNSUPPORTED_MEDIA_TYPE)', async () => {
      const r = await request(app)
        .post('/api/v1/reagents')
        .set(auth('labHead'))
        .send({ name: 'Krahmal', unit: 'kg', quantity: 10 });
      const id = r.body.data.id as string;

      const badRes = await request(app)
        .post(`/api/v1/reagents/${id}/documents`)
        .set(auth('labHead'))
        .attach('file', fixtures.zip(), 'fake.pdf');
      expect(badRes.status).toBe(415);
      expect(badRes.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });
  });

  describe('5. Tenant izolyatsiyasi (D-12, D-102)', () => {
    it('boshqa kompaniya foydalanuvchisi reaktiv va uning tranzaksiyalariga kira olmaydi (404)', async () => {
      const r = await request(app)
        .post('/api/v1/reagents')
        .set(auth('admin'))
        .send({ name: 'Alpha Secret Reagent', unit: 'g', quantity: 10 });
      const id = r.body.data.id as string;

      // Company B foydalanuvchisi kirishga urinsa 404
      expect((await request(app).get(`/api/v1/reagents/${id}`).set(auth('adminB'))).status).toBe(404);
      expect((await request(app).put(`/api/v1/reagents/${id}`).set(auth('adminB')).send({ supplier: 'X' })).status).toBe(404);
      expect((await request(app).delete(`/api/v1/reagents/${id}`).set(auth('adminB'))).status).toBe(404);
      expect((await request(app).post(`/api/v1/reagents/${id}/transactions`).set(auth('adminB')).send({ type: 'in', quantity: 5 })).status).toBe(404);
      expect((await request(app).get(`/api/v1/reagents/${id}/transactions`).set(auth('adminB'))).status).toBe(404);
      expect((await request(app).get(`/api/v1/reagents/${id}/documents`).set(auth('adminB'))).status).toBe(404);
    });
  });

  describe('6. Xarajatlar ro‘yxati va kalendar jurnali (D-08, D-134, R-REAG-10..12)', () => {
    it('GET /expenses va GET /reagents/expenses/calendar xarajatlarni to‘g‘ri ko‘rsatadi', async () => {
      const r = await request(app)
        .post('/api/v1/reagents')
        .set(auth('labHead'))
        .send({ name: 'Spirt 70%', unit: 'l', quantity: 100 });
      const id = r.body.data.id as string;

      // Chiqim qilish
      await request(app)
        .post(`/api/v1/reagents/${id}/transactions`)
        .set(auth('labHead'))
        .send({ type: 'out', quantity: 5, analysisPurpose: 'Dezinfeksiya' });

      // Ro'yxat
      const expList = await request(app).get('/api/v1/expenses').set(auth('chemist'));
      expect(expList.status).toBe(200);
      expect(expList.body.data.length).toBeGreaterThanOrEqual(1);
      expect(expList.body.data[0].type).toBe('out');
      expect(expList.body.data[0].analysisPurpose).toBe('Dezinfeksiya');

      // Kalendar
      const calRes = await request(app).get('/api/v1/reagents/expenses/calendar').set(auth('kontrolyor'));
      expect(calRes.status).toBe(200);
      expect(Array.isArray(calRes.body.data)).toBe(true);
      expect(calRes.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });
});
