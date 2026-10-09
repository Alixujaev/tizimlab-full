import type express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SampleType } from '../src/modules/samples/samples.types.js';
import { testApp } from './helpers/app.js';
import { createCompany, createUser, loginAs, setupAuthDb, type TestUser } from './helpers/auth.js';
import { describeDb } from './helpers/db.js';
import { fixtures, MemoryStorage } from './helpers/memoryStorage.js';

type Db = Awaited<ReturnType<typeof setupAuthDb>>;

describeDb(
  'protocols: extras - pasport, qo‘shimcha fayllar, docx eksport (P5b, D-123..D-125)',
  () => {
    let db: Db;
    let app: express.Express;
    const storage = new MemoryStorage();
    const tokens: Record<string, string> = {};
    const users: Record<string, TestUser> = {};

    beforeAll(async () => {
      db = await setupAuthDb();
      app = testApp({ storage }).app;
      const a = await createCompany({ name: 'Alpha Pharma' });
      const b = await createCompany({ name: 'Beta Pharma' });

      const roleSpecs: [string, TestUser['role'], typeof a][] = [
        ['kontrolyor', 'kontrolyor', a],
        ['chemist1', 'chemist', a],
        ['chemist2', 'chemist', a],
        ['labHead', 'lab_head', a],
        ['director', 'director', a],
        ['admin', 'admin', a],
        ['chemistB', 'chemist', b],
      ];

      for (const [name, role, company] of roleSpecs) {
        users[name] = await createUser({ role, company });
        tokens[name] = (await loginAs(app, users[name]!)).accessToken;
      }
    });

    afterAll(() => db.teardown());
    beforeEach(() => storage.reset());
    afterEach(() => vi.restoreAllMocks());

    const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

    async function createAndAssignSample(
      type: SampleType = 'finished_product',
      substanceName = 'Paratsetamol Tabletka',
    ): Promise<{
      sampleId: string;
      protocolId: string;
    }> {
      const createRes = await request(app).post('/api/v1/samples').set(auth('kontrolyor')).send({
        type,
        substanceName,
        lotNumber: 'LOT-EXTRA-1',
      });
      expect(createRes.status).toBe(201);
      const sampleId = createRes.body.data.id;

      const assignRes = await request(app)
        .post(`/api/v1/samples/${sampleId}/assign`)
        .set(auth('labHead'))
        .send({ chemistId: users.chemist1!.id });
      expect(assignRes.status).toBe(200);

      const listRes = await request(app)
        .get(`/api/v1/protocols/sample/${sampleId}`)
        .set(auth('chemist1'));
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);

      return {
        sampleId,
        protocolId: listRes.body.data[0].id,
      };
    }

    describe('1. Protokol pasporti: ruxsat matritsasi va boshqaruv (D-123, R-PROTO-31)', () => {
      it('kontrolyor, lab_head, admin va biriktirilgan kimyogar pasport yuklay oladi', async () => {
        const { protocolId } = await createAndAssignSample('finished_product');

        // 1. Biriktirilgan kimyogar yuklaydi
        const chemistRes = await request(app)
          .post(`/api/v1/protocols/${protocolId}/passport`)
          .set(auth('chemist1'))
          .attach('file', fixtures.pdf(), 'passport.pdf');
        expect(chemistRes.status).toBe(200);
        expect(chemistRes.body.data.passportFileName).toBe('passport.pdf');
        expect(chemistRes.body.data.passportUploadedBy).toBe(users.chemist1!.id);

        // 2. Kontrolyor almashtiradi
        const kontrolyorRes = await request(app)
          .post(`/api/v1/protocols/${protocolId}/passport`)
          .set(auth('kontrolyor'))
          .attach('file', fixtures.docx(), 'passport2.docx');
        expect(kontrolyorRes.status).toBe(200);
        expect(kontrolyorRes.body.data.passportFileName).toBe('passport2.docx');
        expect(kontrolyorRes.body.data.passportUploadedBy).toBe(users.kontrolyor!.id);

        // 3. Lab head almashtiradi
        const labHeadRes = await request(app)
          .post(`/api/v1/protocols/${protocolId}/passport`)
          .set(auth('labHead'))
          .attach('file', fixtures.png(), 'passport3.png');
        expect(labHeadRes.status).toBe(200);
        expect(labHeadRes.body.data.passportFileName).toBe('passport3.png');

        // 4. Admin almashtiradi
        const adminRes = await request(app)
          .post(`/api/v1/protocols/${protocolId}/passport`)
          .set(auth('admin'))
          .attach('file', fixtures.jpeg(), 'passport4.jpeg');
        expect(adminRes.status).toBe(200);
        expect(adminRes.body.data.passportFileName).toBe('passport4.jpeg');
      });

      it('direktor pasport yuklay olmaydi (403), biriktirilmagan kimyogar ko‘ra olmaydi (404)', async () => {
        const { protocolId } = await createAndAssignSample('finished_product');

        // Direktor 403
        const dirRes = await request(app)
          .post(`/api/v1/protocols/${protocolId}/passport`)
          .set(auth('director'))
          .attach('file', fixtures.pdf(), 'passport.pdf');
        expect(dirRes.status).toBe(403);

        // Biriktirilmagan chemist2 404
        const chemist2Res = await request(app)
          .post(`/api/v1/protocols/${protocolId}/passport`)
          .set(auth('chemist2'))
          .attach('file', fixtures.pdf(), 'passport.pdf');
        expect(chemist2Res.status).toBe(404);
      });

      it('pasportni yuklab olish: ruxsatli foydalanuvchilar imzolangan url oladi', async () => {
        const { protocolId } = await createAndAssignSample('finished_product');

        await request(app)
          .post(`/api/v1/protocols/${protocolId}/passport`)
          .set(auth('labHead'))
          .attach('file', fixtures.pdf(), 'passport.pdf');

        const dlRes = await request(app)
          .get(`/api/v1/protocols/${protocolId}/passport`)
          .set(auth('chemist1'));
        expect(dlRes.status).toBe(200);
        expect(dlRes.body.data.url).toMatch(/^memory:\/\//);
        expect(dlRes.body.data.filename).toBe('passport.pdf');
      });

      it('pasportni o‘chirish huquqi: yuklagan kimyogar yoki lab_head/admin o‘chira oladi, boshqalar 403', async () => {
        const { protocolId } = await createAndAssignSample('finished_product');

        // chemist1 pasport yuklaydi
        await request(app)
          .post(`/api/v1/protocols/${protocolId}/passport`)
          .set(auth('chemist1'))
          .attach('file', fixtures.pdf(), 'chemist_passport.pdf');

        // director o'chirishga urinsa 403
        const dirDel = await request(app)
          .delete(`/api/v1/protocols/${protocolId}/passport`)
          .set(auth('director'));
        expect(dirDel.status).toBe(403);

        // kontrolyor o'chirishga urinsa (u yuklamagan) 403
        const kontDel = await request(app)
          .delete(`/api/v1/protocols/${protocolId}/passport`)
          .set(auth('kontrolyor'));
        expect(kontDel.status).toBe(403);

        // chemist1 (yuklagan) o'chira oladi
        const chemDel = await request(app)
          .delete(`/api/v1/protocols/${protocolId}/passport`)
          .set(auth('chemist1'));
        expect(chemDel.status).toBe(200);
        expect(chemDel.body.data.passportFilePath).toBeNull();
      });
    });

    describe('2. Protokol qulf holatida pasport ishlashi (D-123)', () => {
      it('protokol submitted / approved holatida asosiy fayl qulflanadi, lekin pasport yuklash va o‘chirish ishlaydi', async () => {
        const { protocolId } = await createAndAssignSample('finished_product');

        // Asosiy faylni yuklaymiz va submit qilamiz
        await request(app)
          .post(`/api/v1/protocols/${protocolId}/file`)
          .set(auth('chemist1'))
          .attach('file', fixtures.pdf(), 'report.pdf');

        const submitRes = await request(app)
          .post(`/api/v1/protocols/${protocolId}/submit`)
          .set(auth('chemist1'));
        expect(submitRes.status).toBe(200);
        expect(submitRes.body.data.status).toBe('submitted');

        // Asosiy faylni o'zgartirish qulflangan (409)
        const lockRes = await request(app)
          .post(`/api/v1/protocols/${protocolId}/file`)
          .set(auth('chemist1'))
          .attach('file', fixtures.pdf(), 'report2.pdf');
        expect(lockRes.status).toBe(409);

        // Lekin pasport bemalol yuklanadi!
        const passRes = await request(app)
          .post(`/api/v1/protocols/${protocolId}/passport`)
          .set(auth('chemist1'))
          .attach('file', fixtures.pdf(), 'passport_while_locked.pdf');
        expect(passRes.status).toBe(200);
        expect(passRes.body.data.passportFileName).toBe('passport_while_locked.pdf');

        // Lab head tasdiqlaydi (approved)
        const approveRes = await request(app)
          .post(`/api/v1/protocols/${protocolId}/approve`)
          .set(auth('labHead'));
        expect(approveRes.status).toBe(200);
        expect(approveRes.body.data.status).toBe('approved');

        // Approved holatida ham pasport yangilanishi va o'chirilishi mumkin
        const passReplace = await request(app)
          .post(`/api/v1/protocols/${protocolId}/passport`)
          .set(auth('labHead'))
          .attach('file', fixtures.docx(), 'passport_after_approved.docx');
        expect(passReplace.status).toBe(200);
        expect(passReplace.body.data.passportFileName).toBe('passport_after_approved.docx');

        const passDelete = await request(app)
          .delete(`/api/v1/protocols/${protocolId}/passport`)
          .set(auth('labHead'));
        expect(passDelete.status).toBe(200);
        expect(passDelete.body.data.passportFilePath).toBeNull();
      });
    });

    describe('3. Qo‘shimcha fayllar (protocol_files) qoidalari (D-49, D-76, D-124)', () => {
      it('faqat finished_product namunasining protokollarida qo‘shimcha fayl ruxsat etiladi (raw_material da 422)', async () => {
        // 1. raw_material namunasi
        const raw = await createAndAssignSample('raw_material', 'Xomashyo moddasi');
        const rawRes = await request(app)
          .post(`/api/v1/protocols/${raw.protocolId}/files`)
          .set(auth('chemist1'))
          .attach('file', fixtures.pdf(), 'extra1.pdf');
        expect(rawRes.status).toBe(422);
        expect(rawRes.body.error.code).toBe('PROTOCOL_FILES_NOT_ALLOWED');

        // 2. finished_product namunasi
        const fp = await createAndAssignSample('finished_product', 'Tayyor Mahsulot');
        const fpRes = await request(app)
          .post(`/api/v1/protocols/${fp.protocolId}/files`)
          .set(auth('chemist1'))
          .attach('file', fixtures.pdf(), 'extra1.pdf');
        expect(fpRes.status).toBe(201);
        expect(fpRes.body.data.fileName).toBe('extra1.pdf');
      });

      it('ko‘pi bilan 10 ta qo‘shimcha fayl biriktiriladi, 11-chi 422 qaytaradi', async () => {
        const { protocolId } = await createAndAssignSample('finished_product', 'Ko‘p faylli dori');

        // 10 ta fayl yuklaymiz
        for (let i = 1; i <= 10; i++) {
          const res = await request(app)
            .post(`/api/v1/protocols/${protocolId}/files`)
            .set(auth('chemist1'))
            .attach('file', fixtures.pdf(), `extra_${i}.pdf`);
          expect(res.status).toBe(201);
        }

        // Ro'yxatni tekshiramiz
        const listRes = await request(app)
          .get(`/api/v1/protocols/${protocolId}/files`)
          .set(auth('chemist1'));
        expect(listRes.status).toBe(200);
        expect(listRes.body.data.length).toBe(10);

        // 11-chi fayl yuklash 422 beradi
        const extra11 = await request(app)
          .post(`/api/v1/protocols/${protocolId}/files`)
          .set(auth('chemist1'))
          .attach('file', fixtures.pdf(), 'extra_11.pdf');
        expect(extra11.status).toBe(422);
        expect(extra11.body.error.code).toBe('MAX_FILES_EXCEEDED');
      });

      it('qo‘shimcha fayllar ruxsati: kontrolyor va direktor yuklay olmaydi (403), biriktirilmagan kimyogar 404', async () => {
        const { protocolId } = await createAndAssignSample('finished_product');

        // Kontrolyor 403
        const kontRes = await request(app)
          .post(`/api/v1/protocols/${protocolId}/files`)
          .set(auth('kontrolyor'))
          .attach('file', fixtures.pdf(), 'extra.pdf');
        expect(kontRes.status).toBe(403);

        // Director 403
        const dirRes = await request(app)
          .post(`/api/v1/protocols/${protocolId}/files`)
          .set(auth('director'))
          .attach('file', fixtures.pdf(), 'extra.pdf');
        expect(dirRes.status).toBe(403);

        // Chemist2 404
        const chem2Res = await request(app)
          .post(`/api/v1/protocols/${protocolId}/files`)
          .set(auth('chemist2'))
          .attach('file', fixtures.pdf(), 'extra.pdf');
        expect(chem2Res.status).toBe(404);
      });

      it('qo‘shimcha fayllarni o‘chirish: protokol qulflanganda (submitted) 409 beradi', async () => {
        const { protocolId } = await createAndAssignSample('finished_product');

        // Chemist1 bitta fayl yuklaydi
        const upRes = await request(app)
          .post(`/api/v1/protocols/${protocolId}/files`)
          .set(auth('chemist1'))
          .attach('file', fixtures.pdf(), 'file_to_del.pdf');
        expect(upRes.status).toBe(201);
        const fileId = upRes.body.data.id;

        // Asosiy faylni yuklab, submit qilamiz
        await request(app)
          .post(`/api/v1/protocols/${protocolId}/file`)
          .set(auth('chemist1'))
          .attach('file', fixtures.pdf(), 'main.pdf');

        await request(app).post(`/api/v1/protocols/${protocolId}/submit`).set(auth('chemist1'));

        // Endi qo'shimcha faylni o'chirishga urinamiz -> 409
        const delLocked = await request(app)
          .delete(`/api/v1/protocols/${protocolId}/files/${fileId}`)
          .set(auth('chemist1'));
        expect(delLocked.status).toBe(409);
        expect(delLocked.body.error.code).toBe('PROTOCOL_LOCKED');
      });

      it('qo‘shimcha faylni o‘chirish huquqi: yuklagan foydalanuvchi yoki lab_head/admin; boshqalar 403/404 (R-PROTO-37, R-PROTO-59, D-47)', async () => {
        const { protocolId } = await createAndAssignSample('finished_product');
        const upload = async (who: string, name: string): Promise<string> => {
          const res = await request(app)
            .post(`/api/v1/protocols/${protocolId}/files`)
            .set(auth(who))
            .attach('file', fixtures.pdf(), name);
          expect(res.status).toBe(201);
          return res.body.data.id as string;
        };
        const del = (who: string, fileId: string) =>
          request(app).delete(`/api/v1/protocols/${protocolId}/files/${fileId}`).set(auth(who));

        // admin yuklagan fayl: biriktirilgan kimyogar ham, director/kontrolyor ham o'chira olmaydi
        const adminFile = await upload('admin', 'admin_file.pdf');
        expect((await del('chemist1', adminFile)).status).toBe(403);
        expect((await del('director', adminFile)).status).toBe(403);
        // kontrolyor protokolni umuman ko'rmaydi — mavjudlik yashiriladi (404)
        expect((await del('kontrolyor', adminFile)).status).toBe(404);
        expect((await del('chemist2', adminFile)).status).toBe(404);

        // lab_head boshqa birovning faylini o'chira oladi
        expect((await del('labHead', adminFile)).status).toBe(200);

        // kimyogar o'zi yuklagan faylni o'chira oladi
        const ownFile = await upload('chemist1', 'own_file.pdf');
        expect((await del('chemist1', ownFile)).status).toBe(200);

        const listRes = await request(app)
          .get(`/api/v1/protocols/${protocolId}/files`)
          .set(auth('chemist1'));
        expect(listRes.body.data).toHaveLength(0);
      });
    });

    describe('4. Fayl formati va hajm cheklovi (D-114, D-115)', () => {
      it('noto‘g‘ri formatdagi fayl rad etiladi (magic bytes 415)', async () => {
        const { protocolId } = await createAndAssignSample('finished_product');

        // Pasport uchun zip/exe
        const badPass = await request(app)
          .post(`/api/v1/protocols/${protocolId}/passport`)
          .set(auth('chemist1'))
          .attach('file', fixtures.zip(), 'fake.pdf');
        expect(badPass.status).toBe(415);

        // Extra files uchun plain text
        const badExtra = await request(app)
          .post(`/api/v1/protocols/${protocolId}/files`)
          .set(auth('chemist1'))
          .attach('file', fixtures.text(), 'fake.docx');
        expect(badExtra.status).toBe(415);
      });
    });

    describe('5. DOCX Eksport va D-84 qoidasi (namuna kodi chiqmaydi)', () => {
      it('uz, ru, en tillarida DOCX eksport qilinadi va namuna kodi (SMP-...) chiqmaydi', async () => {
        const { protocolId } = await createAndAssignSample('finished_product', 'Aspirin 500mg');

        for (const lang of ['uz', 'ru', 'en']) {
          const exportRes = await request(app)
            .get(`/api/v1/protocols/${protocolId}/export?lang=${lang}`)
            .set(auth('chemist1'))
            .buffer(true)
            .parse((res, cb) => {
              const chunks: Buffer[] = [];
              res.on('data', (chunk: Buffer) => chunks.push(chunk));
              res.on('end', () => cb(null, Buffer.concat(chunks)));
            });

          expect(exportRes.status).toBe(200);
          expect(exportRes.header['content-type']).toContain(
            'application/vnd.openxmlformats-officedocument',
          );
          expect(Buffer.isBuffer(exportRes.body)).toBe(true);

          // DOCX bufferini string qilib tekshiramiz: fayl bo'sh emas va D-84 bo'yicha namuna kodi (masalan, "SMP-", "namuna kodi") umuman mavjud emas
          const docxContent = (exportRes.body as Buffer).toString('utf-8');
          expect((exportRes.body as Buffer).length).toBeGreaterThan(100);
          expect(docxContent.toLowerCase().includes('smp-')).toBe(false);
        }
      });

      it('noto‘g‘ri lang parametri berilganda 422 qaytaradi', async () => {
        const { protocolId } = await createAndAssignSample('finished_product');

        const badLangRes = await request(app)
          .get(`/api/v1/protocols/${protocolId}/export?lang=de`)
          .set(auth('chemist1'));

        expect(badLangRes.status).toBe(422);
      });
    });

    describe('6. Tenant izolyatsiyasi (boshqa kompaniya foydalanuvchisi)', () => {
      it('boshqa kompaniya kimyogari (chemistB) pasport, fayllar va eksportga kira olmaydi (404)', async () => {
        const { protocolId } = await createAndAssignSample('finished_product');

        // 1. Passport get
        const passGet = await request(app)
          .get(`/api/v1/protocols/${protocolId}/passport`)
          .set(auth('chemistB'));
        expect(passGet.status).toBe(404);

        // 2. Passport post
        const passPost = await request(app)
          .post(`/api/v1/protocols/${protocolId}/passport`)
          .set(auth('chemistB'))
          .attach('file', fixtures.pdf(), 'passport.pdf');
        expect(passPost.status).toBe(404);

        // 3. Files list
        const filesGet = await request(app)
          .get(`/api/v1/protocols/${protocolId}/files`)
          .set(auth('chemistB'));
        expect(filesGet.status).toBe(404);

        // 4. Export
        const expGet = await request(app)
          .get(`/api/v1/protocols/${protocolId}/export?lang=uz`)
          .set(auth('chemistB'));
        expect(expGet.status).toBe(404);
      });
    });
  },
);
