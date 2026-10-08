import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { query } from '../src/config/database.js';
import {
  assertRawModeSupported,
  createSuperAdmin,
  readInputs,
} from '../src/cli/createSuperAdmin.js';
import { testApp } from './helpers/app.js';
import { setupAuthDb } from './helpers/auth.js';
import { describeDb } from './helpers/db.js';

type Db = Awaited<ReturnType<typeof setupAuthDb>>;

describeDb('createSuperAdmin CLI funksiyasi (D-35, D-94)', () => {
  let db: Db;
  beforeAll(async () => {
    db = await setupAuthDb();
  });
  afterAll(async () => {
    await db.teardown();
  });

  it("super_admin yaratadi: email kichik harfda, company_id NULL, bcrypt xesh; shu bilan login bo'ladi", async () => {
    const id = await createSuperAdmin(db.pool, {
      email: '  Root@TizimLab.uz ',
      fullName: ' Bosh Admin ',
      password: 'Kuchli12345',
    });
    const { rows } = await query<{
      email: string;
      role: string;
      company_id: string | null;
      password_hash: string;
      full_name: string;
    }>('SELECT email, role, company_id, password_hash, full_name FROM users WHERE id = $1', [id]);
    expect(rows[0]).toMatchObject({
      email: 'root@tizimlab.uz',
      role: 'super_admin',
      company_id: null,
      full_name: 'Bosh Admin',
    });
    expect(rows[0]!.password_hash).toMatch(/^\$2[ab]\$10\$/);
    const res = await request(testApp().app)
      .post('/api/v1/auth/login')
      .send({ email: 'root@tizimlab.uz', password: 'Kuchli12345' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('super_admin');
  });

  it('parol siyosati: qisqa, raqamsiz, harfsiz — rad etiladi', async () => {
    for (const password of ['Qisqa1', 'FaqatHarflar', '1234567890']) {
      await expect(
        createSuperAdmin(db.pool, { email: `p${password.length}@t.uz`, fullName: 'A', password }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    }
  });

  it("mavjud email (registrdan qat'i nazar) — aniq CONFLICT xatosi", async () => {
    await createSuperAdmin(db.pool, { email: 'dup@t.uz', fullName: 'A', password: 'Kuchli12345' });
    await expect(
      createSuperAdmin(db.pool, { email: 'DUP@t.uz', fullName: 'B', password: 'Kuchli12345' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringContaining('dup@t.uz') });
  });

  it("noto'g'ri email yoki bo'sh ism — VALIDATION_ERROR", async () => {
    await expect(
      createSuperAdmin(db.pool, { email: 'email-emas', fullName: 'A', password: 'Kuchli12345' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      createSuperAdmin(db.pool, { email: 'ok@t.uz', fullName: '  ', password: 'Kuchli12345' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it("raw mode yo'q bo'lsa — aniq xato xabari ('PowerShell yoki cmd'da ishga tushiring')", () => {
    const nonTtyStream = { isTTY: false } as unknown as NodeJS.ReadStream;
    expect(() => assertRawModeSupported(nonTtyStream)).toThrowError(
      /PowerShell yoki cmd'da ishga tushiring/,
    );
  });

  it("readInputs raw mode mavjud bo'lmasa parolni so'ramaydi va ekranga chiqarmaydi", async () => {
    const nonTtyStdin = { isTTY: false } as unknown as NodeJS.ReadStream;
    const stdoutChunks: string[] = [];
    const mockStdout = {
      write: (chunk: string) => {
        stdoutChunks.push(chunk);
        return true;
      },
    } as unknown as NodeJS.WriteStream;

    await expect(readInputs(nonTtyStdin, mockStdout)).rejects.toThrowError(
      /PowerShell yoki cmd'da ishga tushiring/,
    );
    // Parol hech qachon so'ralmagan va chiqarilmagan
    expect(stdoutChunks.join('')).not.toContain('Parol:');
  });
});
