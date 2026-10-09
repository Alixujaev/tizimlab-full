import type express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { query } from '../src/config/database.js';
import { sampleHooks } from '../src/modules/samples/samples.hooks.js';
import { PASSPORT_MAX_BYTES } from '../src/modules/files/files.validation.js';
import type { SampleType } from '../src/modules/samples/samples.types.js';
import { testApp } from './helpers/app.js';
import { createCompany, createUser, loginAs, setupAuthDb, type TestUser } from './helpers/auth.js';
import { describeDb } from './helpers/db.js';
import { fixtures, MemoryStorage } from './helpers/memoryStorage.js';

type Db = Awaited<ReturnType<typeof setupAuthDb>>;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

describeDb('samples: namuna pasporti (R-PASS-*, R-FILE-*)', () => {
  let db: Db;
  let app: express.Express;
  const storage = new MemoryStorage();
  const tokens: Record<string, string> = {};
  const users: Record<string, TestUser> = {};
  let companyAId: string;

  beforeAll(async () => {
    db = await setupAuthDb();
    app = testApp({ storage }).app;
    const a = await createCompany({ name: 'Pharm Alpha' });
    const b = await createCompany({ name: 'Pharm Beta' });
    companyAId = a.id;
    const spec: [string, TestUser['role'], typeof a][] = [
      ['kontrolyor', 'kontrolyor', a],
      ['kontrolyor2', 'kontrolyor', a],
      ['chemist', 'chemist', a],
      ['chemist2', 'chemist', a],
      ['labHead', 'lab_head', a],
      ['labHead2', 'lab_head', a],
      ['director', 'director', a],
      ['admin', 'admin', a],
      ['labHeadB', 'lab_head', b],
    ];
    for (const [name, role, company] of spec) {
      users[name] = await createUser({ role, company });
      tokens[name] = (await loginAs(app, users[name]!)).accessToken;
    }
    users.superAdmin = await createUser({ role: 'super_admin' });
    tokens.superAdmin = (await loginAs(app, users.superAdmin)).accessToken;
  });
  afterAll(() => db.teardown());
  beforeEach(() => storage.reset());
  afterEach(() => vi.restoreAllMocks());

  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  async function newSample(
    type: SampleType,
    opts: { status?: string; assignedTo?: string; createdBy?: string } = {},
  ): Promise<string> {
    const { rows } = await query<{ id: string }>(
      `INSERT INTO samples (company_id, type, status, substance_name, created_by, assigned_to, lot_number)
       VALUES ($1, $2, $3, 'Paratsetamol', $4, $5, 'LOT-1') RETURNING id`,
      [
        companyAId,
        type,
        opts.status ?? 'pending_assignment',
        opts.createdBy ?? users.kontrolyor!.id,
        opts.assignedTo ?? null,
      ],
    );
    return rows[0]!.id;
  }

  const upload = (who: string, id: string, buf = fixtures.pdf(), name = 'pasport.pdf') =>
    request(app).post(`/api/v1/samples/${id}/passport`).set(auth(who)).attach('file', buf, name);
  const review = (who: string, id: string, body: object) =>
    request(app).post(`/api/v1/samples/${id}/passport/review`).set(auth(who)).send(body);
  const remove = (who: string, id: string) =>
    request(app).delete(`/api/v1/samples/${id}/passport`).set(auth(who));
  const download = (who: string, id: string) =>
    request(app).get(`/api/v1/samples/${id}/passport/download`).set(auth(who));

  const sampleRow = async (id: string) =>
    (
      await query<{
        status: string;
        passport_status: string | null;
        passport_file_path: string | null;
        passport_uploaded_by: string | null;
      }>(
        'SELECT status, passport_status, passport_file_path, passport_uploaded_by FROM samples WHERE id = $1',
        [id],
      )
    ).rows[0]!;
  const events = async (id: string) =>
    (
      await query<{ event_type: string; reason: string | null; metadata: Record<string, unknown> }>(
        'SELECT event_type, reason, metadata FROM sample_tracking WHERE sample_id = $1 ORDER BY created_at, event_type',
        [id],
      )
    ).rows;
  const fileRows = async (id: string) =>
    (await query<{ r2_key: string }>('SELECT r2_key FROM files WHERE sample_id = $1', [id])).rows;
  const auditCount = async (id: string) =>
    Number(
      (
        await query<{ c: string }>(`SELECT count(*)::text c FROM audit_log WHERE record_id = $1`, [
          id,
        ])
      ).rows[0]!.c,
    );

  it('R-PASS-05/07/18: lab_head reagent pasportini yuklaydi → pasport va namuna approved, hooklar chaqiriladi', async () => {
    const closeSpy = vi.spyOn(sampleHooks, 'closeOpenProtocolsForSample');
    const statusSpy = vi.spyOn(sampleHooks, 'onSampleStatusChanged');
    const id = await newSample('reagent');
    const res = await upload('labHead', id, fixtures.pdf(), '../../secret pasport.pdf');
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      status: 'approved',
      passportStatus: 'approved',
      passportFileName: 'secret pasport.pdf',
    });

    const row = await sampleRow(id);
    expect(row.passport_file_path).toMatch(
      new RegExp(`^${companyAId}/sample-passports/${UUID}\\.pdf$`),
    );
    expect(storage.objects.get(row.passport_file_path!)?.contentType).toBe('application/pdf');
    expect(await fileRows(id)).toEqual([{ r2_key: row.passport_file_path }]);

    const ev = await events(id);
    expect(ev.map((e) => e.event_type)).toEqual(['approved', 'passport_uploaded']);
    expect(ev.find((e) => e.event_type === 'approved')).toMatchObject({
      reason: 'pasport orqali',
      metadata: { via: 'passport' },
    });

    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(statusSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id }),
      'pending_assignment',
      'approved',
      users.labHead!.id,
      expect.anything(),
    );
    expect(await auditCount(id)).toBeGreaterThanOrEqual(1);
  });

  it('R-PASS-06: admin standard_substance pasportini yuklaydi → avtomatik approved', async () => {
    const id = await newSample('standard_substance');
    const res = await upload('admin', id, fixtures.png(), 'sertifikat.png');
    expect(res.status).toBe(201);
    expect(await sampleRow(id)).toMatchObject({ status: 'approved', passport_status: 'approved' });
  });

  it('R-PASS-09/10: kontrolyor yuklaydi → pending; lab_head tasdiqlaydi → namuna approved', async () => {
    const closeSpy = vi.spyOn(sampleHooks, 'closeOpenProtocolsForSample');
    const id = await newSample('reagent');
    expect((await upload('kontrolyor', id)).body.data).toMatchObject({
      status: 'pending_assignment',
      passportStatus: 'pending',
    });
    expect(closeSpy).not.toHaveBeenCalled();

    const res = await review('labHead', id, { decision: 'approve' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'approved', passportStatus: 'approved' });
    expect((await events(id)).map((e) => e.event_type)).toEqual([
      'passport_uploaded',
      'approved',
      'passport_reviewed',
    ]);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('R-PASS-11/22: rad etish sababi ≥5; rad etilgach namuna pending_assignment, qayta yuklash mumkin', async () => {
    const id = await newSample('reagent');
    await upload('kontrolyor', id);
    const firstKey = (await sampleRow(id)).passport_file_path!;

    expect((await review('labHead', id, { decision: 'reject', reason: 'abc ' })).status).toBe(400);
    expect((await review('labHead', id, { decision: 'reject' })).status).toBe(400);

    const res = await review('admin', id, { decision: 'reject', reason: 'Hujjat muddati o‘tgan' });
    expect(res.status).toBe(200);
    expect(await sampleRow(id)).toMatchObject({
      status: 'pending_assignment',
      passport_status: 'rejected',
    });
    expect((await events(id)).find((e) => e.event_type === 'passport_reviewed')).toMatchObject({
      reason: 'Hujjat muddati o‘tgan',
      metadata: { decision: 'reject' },
    });

    // Boshqa kontrolyor rad etilganini qayta yuklay olmaydi (ko'rmaydi ham)
    expect((await upload('kontrolyor2', id)).status).toBe(404);

    const again = await upload('kontrolyor', id, fixtures.docx(), 'yangi.docx');
    expect(again.status).toBe(201);
    expect(again.body.data.passportStatus).toBe('pending');
    expect(storage.deleted).toEqual([firstKey]);
    expect((await fileRows(id)).map((f) => f.r2_key)).toEqual([
      (await sampleRow(id)).passport_file_path,
    ]);
  });

  it('R-PASS-12: o‘zi yuklagan pasportni o‘zi tasdiqlay olmaydi', async () => {
    const id = await newSample('reagent');
    await upload('kontrolyor', id);
    // Yuklagan foydalanuvchi keyinchalik lab_head bo'lgan holat — DB orqali modellashtiriladi
    await query('UPDATE samples SET passport_uploaded_by = $1 WHERE id = $2', [
      users.labHead!.id,
      id,
    ]);
    const res = await review('labHead', id, { decision: 'approve' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SELF_REVIEW_FORBIDDEN');
    expect((await review('labHead2', id, { decision: 'approve' })).status).toBe(200);
  });

  it('R-PASS-13/24: kontrolyor, chemist, director ko‘rib chiqa olmaydi; director yuklay olmaydi; chemist reagentni ko‘rmaydi', async () => {
    const id = await newSample('reagent');
    expect((await upload('director', id)).status).toBe(403);
    expect((await upload('chemist', id)).status).toBe(404); // D-112
    await upload('kontrolyor', id);
    expect((await review('kontrolyor', id, { decision: 'approve' })).status).toBe(403);
    expect((await review('director', id, { decision: 'approve' })).status).toBe(403);
    expect((await review('chemist', id, { decision: 'approve' })).status).toBe(404);
    expect((await sampleRow(id)).passport_status).toBe('pending');
  });

  it('R-PASS-14/16/25: raw_material pasporti holatsiz, statusni o‘zgartirmaydi, review 422', async () => {
    const id = await newSample('raw_material', {
      status: 'in_progress',
      assignedTo: users.chemist!.id,
    });
    const res = await upload('kontrolyor', id);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ status: 'in_progress', passportStatus: null });
    expect((await review('labHead', id, { decision: 'approve' })).body.error.code).toBe(
      'PASSPORT_REVIEW_NOT_APPLICABLE',
    );
    expect((await sampleRow(id)).status).toBe('in_progress');
    expect((await upload('labHead', id)).status).toBe(409); // D-119
  });

  it('R-PASS-15/17: finished_product — biriktirilgan chemist yuklaydi, boshqa chemist va director yo‘q', async () => {
    const id = await newSample('finished_product', {
      status: 'in_progress',
      assignedTo: users.chemist!.id,
    });
    expect((await upload('chemist2', id)).status).toBe(404);
    expect((await upload('director', id)).status).toBe(403);
    const res = await upload('chemist', id, fixtures.jpeg(), 'rasm.jpg');
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('in_progress');
    const lab = await newSample('finished_product', {
      status: 'submitted',
      assignedTo: users.chemist!.id,
    });
    expect((await upload('admin', lab)).body.data.status).toBe('submitted');
  });

  it('R-PASS-02: other turiga pasport yuklanmaydi → 422', async () => {
    const id = await newSample('other');
    const res = await upload('labHead', id);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PASSPORT_NOT_ALLOWED');
  });

  it('R-PASS-19/20/21 + D-111: o‘chirish qoidalari; tasdiqlangan pasport o‘chirilsa namuna approved qoladi', async () => {
    const pendingId = await newSample('reagent');
    await upload('kontrolyor', pendingId);
    const key = (await sampleRow(pendingId)).passport_file_path!;
    expect((await remove('director', pendingId)).status).toBe(403);
    const del = await remove('kontrolyor', pendingId);
    expect(del.status).toBe(200);
    expect(await sampleRow(pendingId)).toMatchObject({
      passport_status: null,
      passport_file_path: null,
      status: 'pending_assignment',
    });
    expect(await fileRows(pendingId)).toEqual([]);
    expect(storage.deleted).toContain(key);
    expect((await events(pendingId)).at(-1)!.event_type).toBe('passport_deleted');

    const approvedId = await newSample('reagent');
    await upload('kontrolyor', approvedId);
    await review('labHead', approvedId, { decision: 'approve' });
    expect((await remove('kontrolyor', approvedId)).status).toBe(403);
    expect((await remove('admin', approvedId)).status).toBe(200);
    expect(await sampleRow(approvedId)).toMatchObject({
      status: 'approved',
      passport_status: null,
    });
    expect(
      (await events(approvedId)).find((e) => e.event_type === 'passport_deleted')!.metadata,
    ).toMatchObject({
      previous_passport_status: 'approved',
    });
    expect((await remove('admin', approvedId)).status).toBe(404);
  });

  it('D-114: soxta kengaytma 415, bo‘sh fayl 422, fayl yo‘q 400; DB o‘zgarmaydi', async () => {
    const id = await newSample('reagent');
    const fake = await upload('labHead', id, fixtures.pdf(), 'rasm.png');
    expect(fake.status).toBe(415);
    expect(fake.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect((await upload('labHead', id, fixtures.text(), 'a.pdf')).status).toBe(415);
    const empty = await upload('labHead', id, Buffer.alloc(0), 'a.pdf');
    expect(empty.status).toBe(422);
    expect(empty.body.error.code).toBe('EMPTY_FILE');
    expect(
      (await request(app).post(`/api/v1/samples/${id}/passport`).set(auth('labHead'))).status,
    ).toBe(400);
    expect(await sampleRow(id)).toMatchObject({
      status: 'pending_assignment',
      passport_status: null,
    });
    expect(storage.objects.size).toBe(0);
  });

  it('D-115: 20MB dan katta pasport → 413', async () => {
    const id = await newSample('reagent');
    const big = Buffer.concat([fixtures.pdf(), Buffer.alloc(PASSPORT_MAX_BYTES)]);
    const res = await upload('labHead', id, big, 'katta.pdf');
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('D-121: storage sozlanmagan → 503 STORAGE_UNAVAILABLE (sirlarsiz)', async () => {
    const noStorage = testApp().app;
    const id = await newSample('reagent');
    const res = await request(noStorage)
      .post(`/api/v1/samples/${id}/passport`)
      .set(auth('labHead'))
      .attach('file', fixtures.pdf(), 'a.pdf');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('STORAGE_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toMatch(/secret|access_key/i);
  });

  it('R-FILE-05: yuklab olish — imzolangan URL faqat ruxsat tekshiruvidan keyin, boshqa kompaniya 404', async () => {
    const id = await newSample('reagent');
    await upload('kontrolyor', id, fixtures.pdf(), 'Паспорт.pdf');
    const ok = await download('kontrolyor', id);
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ expiresIn: 300 });
    expect(ok.body.data.url).toMatch(/^memory:\/\//);
    expect(storage.signed.at(-1)!.opts).toMatchObject({
      contentType: 'application/pdf',
      expiresIn: 300,
    });
    expect(storage.signed.at(-1)!.opts.contentDisposition).toContain(
      encodeURIComponent('Паспорт.pdf'),
    );
    const signedBefore = storage.signed.length;

    expect((await download('kontrolyor2', id)).status).toBe(404);
    expect((await download('labHeadB', id)).status).toBe(404);
    expect((await download('superAdmin', id)).status).toBe(403);
    expect(storage.signed.length).toBe(signedBefore);
    expect((await download('director', id)).status).toBe(200);

    const none = await newSample('reagent');
    expect((await download('labHead', none)).status).toBe(404);
  });

  it('tenant izolyatsiyasi: boshqa kompaniya yuklash/ko‘rib chiqish/o‘chirish → 404', async () => {
    const id = await newSample('reagent');
    await upload('kontrolyor', id);
    expect((await upload('labHeadB', id)).status).toBe(404);
    expect((await review('labHeadB', id, { decision: 'approve' })).status).toBe(404);
    expect((await remove('labHeadB', id)).status).toBe(404);
    expect((await sampleRow(id)).passport_status).toBe('pending');
  });

  it('rollback: R2 put xatosi → status, tracking, audit, files yozilmaydi', async () => {
    const id = await newSample('reagent');
    storage.failNextPut = true;
    const res = await upload('labHead', id);
    expect(res.status).toBe(500);
    expect(await sampleRow(id)).toMatchObject({
      status: 'pending_assignment',
      passport_status: null,
    });
    expect(await events(id)).toEqual([]);
    expect(await fileRows(id)).toEqual([]);
    expect(await auditCount(id)).toBe(0);
  });

  it('rollback: hook xatosi → hammasi bekor, R2 ga hech narsa yozilmaydi', async () => {
    vi.spyOn(sampleHooks, 'closeOpenProtocolsForSample').mockRejectedValueOnce(
      new Error('hook failed'),
    );
    const id = await newSample('reagent');
    expect((await upload('labHead', id)).status).toBe(500);
    expect(await sampleRow(id)).toMatchObject({
      status: 'pending_assignment',
      passport_status: null,
    });
    expect(await events(id)).toEqual([]);
    expect(storage.objects.size).toBe(0);
  });
});
