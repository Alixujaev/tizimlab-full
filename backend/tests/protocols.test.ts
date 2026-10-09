import type express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { query } from '../src/config/database.js';
import { registryHooks } from '../src/modules/registry/registry.hooks.js';
import type { SampleRow, SampleType } from '../src/modules/samples/samples.types.js';
import { testApp } from './helpers/app.js';
import { createCompany, createUser, loginAs, setupAuthDb, type TestUser } from './helpers/auth.js';
import { describeDb } from './helpers/db.js';
import { fixtures, MemoryStorage } from './helpers/memoryStorage.js';

type Db = Awaited<ReturnType<typeof setupAuthDb>>;

describeDb('protocols: protokollar yadrosi va imzolar (P5a, R-PROTO-*, R-ROLE-23..37)', () => {
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

  async function createAndAssignSample(type: SampleType = 'raw_material'): Promise<{
    sampleId: string;
    protocolId: string;
  }> {
    // 1. Kontrolyor namuna yaratadi
    const createRes = await request(app)
      .post('/api/v1/samples')
      .set(auth('kontrolyor'))
      .send({
        type,
        substanceName: 'Sinov Moddasi',
        lotNumber: 'LOT-P5-1',
      });
    expect(createRes.status).toBe(201);
    const sampleId = createRes.body.data.id;

    // 2. Lab_head kimyogar1 ga biriktiradi (bu avtomatik protokol yaratishi lozim)
    const assignRes = await request(app)
      .post(`/api/v1/samples/${sampleId}/assign`)
      .set(auth('labHead'))
      .send({ chemistId: users.chemist1!.id });
    expect(assignRes.status).toBe(200);

    // 3. Protokolni olamiz
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

  describe('Avtomatik yaratish va biriktirish (R-PROTO-52, R-SAMPLE-15, D-15)', () => {
    it('oddiy namuna biriktirilganda standart (standard) protokol draft holatida yaratiladi', async () => {
      const { sampleId, protocolId } = await createAndAssignSample('raw_material');

      const protoRes = await request(app)
        .get(`/api/v1/protocols/${protocolId}`)
        .set(auth('chemist1'));
      expect(protoRes.status).toBe(200);
      expect(protoRes.body.data).toMatchObject({
        id: protocolId,
        sampleId,
        status: 'draft',
        protocolRole: 'standard',
        filePath: null,
      });
    });

    it('tayyor mahsulot (finished_product) biriktirilganda yakuniy (final) protokol yaratiladi', async () => {
      const { sampleId, protocolId } = await createAndAssignSample('finished_product');

      const protoRes = await request(app)
        .get(`/api/v1/protocols/${protocolId}`)
        .set(auth('chemist1'));
      expect(protoRes.status).toBe(200);
      expect(protoRes.body.data).toMatchObject({
        id: protocolId,
        sampleId,
        status: 'draft',
        protocolRole: 'final',
      });
    });

    it('namunani boshqa kimyogarga qayta biriktirishda yangi protokol ochilmaydi, mavjud protokol saqlanadi', async () => {
      const { sampleId, protocolId } = await createAndAssignSample('raw_material');

      // chemist2 ga qayta biriktiramiz
      const reassignRes = await request(app)
        .post(`/api/v1/samples/${sampleId}/assign`)
        .set(auth('labHead'))
        .send({ chemistId: users.chemist2!.id, reason: 'Kimyogar almashtirildi' });
      expect(reassignRes.status).toBe(200);

      const listRes = await request(app)
        .get(`/api/v1/protocols/sample/${sampleId}`)
        .set(auth('chemist2'));
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(1);
      expect(listRes.body.data[0].id).toBe(protocolId);
    });
  });

  describe('Kirish huquqlari (R-ROLE-23..37, R-PROTO-41..43)', () => {
    it('biriktirilmagan kimyogar o‘zganing protokolini ko‘ra olmaydi (404)', async () => {
      const { protocolId } = await createAndAssignSample('raw_material');

      const res = await request(app)
        .get(`/api/v1/protocols/${protocolId}`)
        .set(auth('chemist2'));
      expect(res.status).toBe(404);
    });

    it('lab_head, director va admin kompaniyadagi istalgan protokolni ko‘ra oladi', async () => {
      const { protocolId } = await createAndAssignSample('raw_material');

      for (const who of ['labHead', 'director', 'admin']) {
        const res = await request(app)
          .get(`/api/v1/protocols/${protocolId}`)
          .set(auth(who));
        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(protocolId);
      }
    });

    it('boshqa kompaniyadagi foydalanuvchi protokolni ko‘ra olmaydi (tenant isolation - 404)', async () => {
      const { protocolId } = await createAndAssignSample('raw_material');

      const res = await request(app)
        .get(`/api/v1/protocols/${protocolId}`)
        .set(auth('chemistB'));
      expect(res.status).toBe(404);
    });
  });

  describe('Fayl yuklash, almashtirish va o‘chirish (R-ROLE-23..27, R-PROTO-22..30, R-PROTO-57)', () => {
    it('kimyogar protokolga PDF fayl yuklaydi (R-PROTO-24)', async () => {
      const { protocolId } = await createAndAssignSample('raw_material');

      const uploadRes = await request(app)
        .post(`/api/v1/protocols/${protocolId}/file`)
        .set(auth('chemist1'))
        .attach('file', fixtures.pdf(), 'analiz_natijasi.pdf');

      expect(uploadRes.status).toBe(200);
      expect(uploadRes.body.data.fileName).toBe('analiz_natijasi.pdf');
      expect(uploadRes.body.data.filePath).toBeTruthy();
      expect(uploadRes.body.data.fileMime).toBe('application/pdf');

      // R2 xotirasiga yozilganligini tekshiramiz
      expect(storage.objects.size).toBe(1);

      // Audit yozuvi borligini tekshiramiz
      const audit = await query(
        `SELECT * FROM audit_log WHERE table_name = 'protocols' AND record_id = $1`,
        [protocolId],
      );
      expect(audit.rows.length).toBeGreaterThanOrEqual(1);
    });

    it('katta fayl (>20MB) yuklash rad etiladi (413, R-PROTO-30)', async () => {
      const { protocolId } = await createAndAssignSample('raw_material');
      const hugeBuf = Buffer.alloc(21 * 1024 * 1024);

      const res = await request(app)
        .post(`/api/v1/protocols/${protocolId}/file`)
        .set(auth('chemist1'))
        .attach('file', hugeBuf, 'katta_fayl.pdf');

      expect([413, 400]).toContain(res.status);
    });

    it('ruxsat etilmagan fayl formati (exe/txt) rad etiladi (415, R-PROTO-29)', async () => {
      const { protocolId } = await createAndAssignSample('raw_material');
      const badBuf = Buffer.from('Oddiy matn yoki skript');

      const res = await request(app)
        .post(`/api/v1/protocols/${protocolId}/file`)
        .set(auth('chemist1'))
        .attach('file', badBuf, 'virus.txt');

      expect(res.status).toBe(415);
    });

    it('asosiy fayl almashtirilganda eski fayl R2 xotirasidan o‘chiriladi (R-PROTO-23)', async () => {
      const { protocolId } = await createAndAssignSample('raw_material');

      // 1. Birinchi faylni yuklaymiz
      const res1 = await request(app)
        .post(`/api/v1/protocols/${protocolId}/file`)
        .set(auth('chemist1'))
        .attach('file', fixtures.pdf(), 'eski.pdf');
      expect(res1.status).toBe(200);
      const oldKey = res1.body.data.filePath;

      // 2. Yangi PNG fayl bilan almashtiramiz
      const res2 = await request(app)
        .post(`/api/v1/protocols/${protocolId}/file`)
        .set(auth('chemist1'))
        .attach('file', fixtures.png(), 'yangi.png');
      expect(res2.status).toBe(200);
      expect(res2.body.data.fileName).toBe('yangi.png');
      expect(storage.deleted).toContain(oldKey);
    });

    it('asosiy faylni o‘chirish draft holatida ishlaydi va R2 dan tozalaydi', async () => {
      const { protocolId } = await createAndAssignSample('raw_material');

      await request(app)
        .post(`/api/v1/protocols/${protocolId}/file`)
        .set(auth('chemist1'))
        .attach('file', fixtures.pdf(), 'test.pdf');

      const delRes = await request(app)
        .delete(`/api/v1/protocols/${protocolId}/file`)
        .set(auth('chemist1'));
      expect(delRes.status).toBe(200);
      expect(delRes.body.data.filePath).toBeNull();
      expect(delRes.body.data.fileName).toBeNull();
    });

    it('faylni yuklab olish imzolangan URL qaytaradi (R-PROTO-38)', async () => {
      const { protocolId } = await createAndAssignSample('raw_material');

      await request(app)
        .post(`/api/v1/protocols/${protocolId}/file`)
        .set(auth('chemist1'))
        .attach('file', fixtures.docx(), 'hisobot.docx');

      const downloadRes = await request(app)
        .get(`/api/v1/protocols/${protocolId}/file`)
        .set(auth('chemist1'));
      expect(downloadRes.status).toBe(200);
      expect(downloadRes.body.data.url).toMatch(/^memory:\/\//);
      expect(downloadRes.body.data.filename).toBe('hisobot.docx');
    });
  });

  describe('Yuborish, Rad etish, Qayta yuborish va Tasdiqlash oqimi (R-PROTO-07..17, D-14, D-45, D-46, D-122)', () => {
    it('faylsiz protokolni yuborish rad etiladi (422, R-PROTO-08)', async () => {
      const { protocolId } = await createAndAssignSample('raw_material');

      const res = await request(app)
        .post(`/api/v1/protocols/${protocolId}/submit`)
        .set(auth('chemist1'));
      expect(res.status).toBe(422);
    });

    it('lab_head yoki boshqalar protokolni yubora olmaydi (403, D-45)', async () => {
      const { protocolId } = await createAndAssignSample('raw_material');

      await request(app)
        .post(`/api/v1/protocols/${protocolId}/file`)
        .set(auth('chemist1'))
        .attach('file', fixtures.pdf(), 'file.pdf');

      const res = await request(app)
        .post(`/api/v1/protocols/${protocolId}/submit`)
        .set(auth('labHead'));
      expect(res.status).toBe(403);
    });

    it('kimyogar fayl bilan yuboradi, namuna submitted ga o‘tadi va imzo qo‘shiladi (R-PROTO-07, 44)', async () => {
      const { sampleId, protocolId } = await createAndAssignSample('raw_material');

      await request(app)
        .post(`/api/v1/protocols/${protocolId}/file`)
        .set(auth('chemist1'))
        .attach('file', fixtures.pdf(), 'natijalar.pdf');

      const submitRes = await request(app)
        .post(`/api/v1/protocols/${protocolId}/submit`)
        .set(auth('chemist1'));
      expect(submitRes.status).toBe(200);
      expect(submitRes.body.data.status).toBe('submitted');

      // Namunani tekshiramiz — submitted bo'lishi shart
      const sampleRes = await request(app)
        .get(`/api/v1/samples/${sampleId}`)
        .set(auth('labHead'));
      expect(sampleRes.body.data.status).toBe('submitted');

      // Imzo qo'yilganligini tekshiramiz
      const detailRes = await request(app)
        .get(`/api/v1/protocols/${protocolId}`)
        .set(auth('labHead'));
      expect(detailRes.body.data.signatures.length).toBe(1);
      expect(detailRes.body.data.signatures[0]).toMatchObject({
        role: 'chemist',
        action: 'submitted',
      });
      expect(detailRes.body.data.signatures[0].signatureHash).toBeTruthy();

      // Qulflangan holatda fayl o'zgartirib bo'lmaydi (R-PROTO-58)
      const uploadLockedRes = await request(app)
        .post(`/api/v1/protocols/${protocolId}/file`)
        .set(auth('chemist1'))
        .attach('file', fixtures.pdf(), 'yangi.pdf');
      expect(uploadLockedRes.status).toBe(409);
    });

    it('rad etish: sabab 5 belgidan kam bo‘lsa 400 (D-122), to‘g‘ri sabab bilan rejected bo‘ladi', async () => {
      const { protocolId } = await createAndAssignSample('raw_material');

      await request(app)
        .post(`/api/v1/protocols/${protocolId}/file`)
        .set(auth('chemist1'))
        .attach('file', fixtures.pdf(), 'natijalar.pdf');

      await request(app)
        .post(`/api/v1/protocols/${protocolId}/submit`)
        .set(auth('chemist1'));

      // 1. Sabab juda qisqa bo'lsa 400
      const shortRes = await request(app)
        .post(`/api/v1/protocols/${protocolId}/reject`)
        .set(auth('labHead'))
        .send({ reason: 'xato' });
      expect(shortRes.status).toBe(400);

      // 2. To'g'ri sabab bilan rad etiladi
      const rejectRes = await request(app)
        .post(`/api/v1/protocols/${protocolId}/reject`)
        .set(auth('labHead'))
        .send({ reason: 'Modda tarkibi talabga javob bermaydi' });
      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.data.status).toBe('rejected');
      expect(rejectRes.body.data.rejectionReason).toBe('Modda tarkibi talabga javob bermaydi');

      // Imzolar tarixi saqlanganligini tekshiramiz (D-46)
      const detailRes = await request(app)
        .get(`/api/v1/protocols/${protocolId}`)
        .set(auth('chemist1'));
      expect(detailRes.body.data.signatures.length).toBe(2);
      expect(detailRes.body.data.signatures[1]).toMatchObject({
        role: 'lab_head',
        action: 'rejected',
      });
    });

    it('qayta yuborish: kimyogar yangi fayl yuklab qayta yuboradi, yangi imzo qo‘shiladi (D-14, D-46)', async () => {
      const { protocolId } = await createAndAssignSample('raw_material');

      await request(app)
        .post(`/api/v1/protocols/${protocolId}/file`)
        .set(auth('chemist1'))
        .attach('file', fixtures.pdf(), 'f1.pdf');
      await request(app).post(`/api/v1/protocols/${protocolId}/submit`).set(auth('chemist1'));
      await request(app)
        .post(`/api/v1/protocols/${protocolId}/reject`)
        .set(auth('labHead'))
        .send({ reason: 'Tahlil qayta o‘tkazilsin' });

      // Kimyogar yangi fayl yuklaydi
      const replaceRes = await request(app)
        .post(`/api/v1/protocols/${protocolId}/file`)
        .set(auth('chemist1'))
        .attach('file', fixtures.pdf(), 'f2_yangilangan.pdf');
      expect(replaceRes.status).toBe(200);

      // Qayta yuboradi
      const resubmitRes = await request(app)
        .post(`/api/v1/protocols/${protocolId}/submit`)
        .set(auth('chemist1'));
      expect(resubmitRes.status).toBe(200);
      expect(resubmitRes.body.data.status).toBe('submitted');
      expect(resubmitRes.body.data.rejectionReason).toBeNull();

      // Imzolar soni 3 ta bo'lishi lozim (submitted, rejected, submitted)
      const detailRes = await request(app)
        .get(`/api/v1/protocols/${protocolId}`)
        .set(auth('chemist1'));
      expect(detailRes.body.data.signatures.length).toBe(3);
    });

    it('lab_head tasdiqlaydi, namuna approved bo‘ladi va reyestrga tushadi (R-PROTO-09, 17)', async () => {
      const { sampleId, protocolId } = await createAndAssignSample('raw_material');

      await request(app)
        .post(`/api/v1/protocols/${protocolId}/file`)
        .set(auth('chemist1'))
        .attach('file', fixtures.pdf(), 'tayyor.pdf');
      await request(app).post(`/api/v1/protocols/${protocolId}/submit`).set(auth('chemist1'));

      const approveRes = await request(app)
        .post(`/api/v1/protocols/${protocolId}/approve`)
        .set(auth('labHead'));
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe('approved');

      // Namuna approved bo'lishi kerak
      const sampleRes = await request(app)
        .get(`/api/v1/samples/${sampleId}`)
        .set(auth('labHead'));
      expect(sampleRes.body.data.status).toBe('approved');

      // Reyestrda ko'rinishi lozim (P4b reyestr tekshiruvi)
      const registryRes = await request(app)
        .get('/api/v1/registry')
        .set(auth('kontrolyor'));
      expect(registryRes.status).toBe(200);
      const ids = registryRes.body.data.map((s: { id: string }) => s.id);
      expect(ids).toContain(sampleId);
    });

    it('direktor yakunlaydi, namuna statusi o‘zgarmaydi (R-PROTO-12, 13, R-REG-14, D-07)', async () => {
      const { sampleId, protocolId } = await createAndAssignSample('raw_material');

      await request(app)
        .post(`/api/v1/protocols/${protocolId}/file`)
        .set(auth('chemist1'))
        .attach('file', fixtures.pdf(), 'doc.pdf');
      await request(app).post(`/api/v1/protocols/${protocolId}/submit`).set(auth('chemist1'));
      await request(app).post(`/api/v1/protocols/${protocolId}/approve`).set(auth('labHead'));

      // Boshqa rol yakunlay olmaydi (R-ROLE-33..37)
      const failFinRes = await request(app)
        .post(`/api/v1/protocols/${protocolId}/finalize`)
        .set(auth('labHead'));
      expect(failFinRes.status).toBe(403);

      // Direktor yakunlaydi
      const finRes = await request(app)
        .post(`/api/v1/protocols/${protocolId}/finalize`)
        .set(auth('director'));
      expect(finRes.status).toBe(200);
      expect(finRes.body.data.status).toBe('finalized');

      // Namuna statusi approved bo'lib qolishi shart (R-REG-14)
      const sampleRes = await request(app)
        .get(`/api/v1/samples/${sampleId}`)
        .set(auth('director'));
      expect(sampleRes.body.data.status).toBe('approved');

      // Imzo qo'yilganligini tekshiramiz
      const detailRes = await request(app)
        .get(`/api/v1/protocols/${protocolId}`)
        .set(auth('director'));
      const lastSig = detailRes.body.data.signatures.at(-1);
      expect(lastSig).toMatchObject({
        role: 'director',
        action: 'finalized',
      });
    });
  });

  describe('Oraliq (in_process) protokol va ko‘p-protokol qoidalari (R-PROTO-20, 21, 53, 54, D-15)', () => {
    it('raw_material uchun in_process protokol yaratish taqiqlanadi (422)', async () => {
      const { sampleId } = await createAndAssignSample('raw_material');

      const res = await request(app)
        .post(`/api/v1/protocols/sample/${sampleId}/in-process`)
        .set(auth('labHead'));
      expect(res.status).toBe(422);
    });

    it('finished_product uchun in_process protokol yaratiladi va namunada 2 ta protokol bo‘ladi', async () => {
      const { sampleId } = await createAndAssignSample('finished_product');

      const createRes = await request(app)
        .post(`/api/v1/protocols/sample/${sampleId}/in-process`)
        .set(auth('labHead'));
      expect(createRes.status).toBe(201);
      expect(createRes.body.data.protocolRole).toBe('in_process');
      expect(createRes.body.data.status).toBe('draft');

      const listRes = await request(app)
        .get(`/api/v1/protocols/sample/${sampleId}`)
        .set(auth('chemist1'));
      expect(listRes.body.data.length).toBe(2);
      const roles = listRes.body.data.map((p: { protocolRole: string }) => p.protocolRole);
      expect(roles).toContain('final');
      expect(roles).toContain('in_process');

      // Ikkinchi marta in_process yaratish 409
      const dupRes = await request(app)
        .post(`/api/v1/protocols/sample/${sampleId}/in-process`)
        .set(auth('labHead'));
      expect(dupRes.status).toBe(409);
    });

    it('in_process protokolni yuborish namuna statusiga ta’sir qilmaydi (D-15)', async () => {
      const { sampleId } = await createAndAssignSample('finished_product');

      const createRes = await request(app)
        .post(`/api/v1/protocols/sample/${sampleId}/in-process`)
        .set(auth('chemist1'));
      const inProcessId = createRes.body.data.id;

      await request(app)
        .post(`/api/v1/protocols/${inProcessId}/file`)
        .set(auth('chemist1'))
        .attach('file', fixtures.pdf(), 'in_process.pdf');

      const submitRes = await request(app)
        .post(`/api/v1/protocols/${inProcessId}/submit`)
        .set(auth('chemist1'));
      expect(submitRes.status).toBe(200);

      // Namuna statusi o'zgarmasdan in_progress holatida qolishi lozim (D-15)
      const sampleRes = await request(app)
        .get(`/api/v1/samples/${sampleId}`)
        .set(auth('chemist1'));
      expect(sampleRes.body.data.status).toBe('in_progress');
    });
  });

  describe('Reyestr va integratsiya hooklari (R-REG-08, R-PASS-08)', () => {
    it('finished_product uchun registryHooks.getFinalProtocolFile final protokol faylini qaytaradi', async () => {
      const { sampleId, protocolId } = await createAndAssignSample('finished_product');

      await request(app)
        .post(`/api/v1/protocols/${protocolId}/file`)
        .set(auth('chemist1'))
        .attach('file', fixtures.pdf(), 'yakuniy_analiz.pdf');

      const { rows } = await query<SampleRow>(`SELECT * FROM samples WHERE id = $1`, [sampleId]);
      const sample = rows[0]!;

      const fileLink = await registryHooks.getFinalProtocolFile(sample, storage);
      expect(fileLink).not.toBeNull();
      expect(fileLink?.url).toMatch(/^memory:\/\//);
    });

    it('namunada protokol mavjud bo‘lganda jismoniy DELETE samples FK RESTRICT bilan bloklanadi', async () => {
      const { sampleId } = await createAndAssignSample('raw_material');
      await expect(query(`DELETE FROM samples WHERE id = $1`, [sampleId])).rejects.toThrow(
        /foreign key|violates foreign key constraint/i,
      );
    });
  });
});
