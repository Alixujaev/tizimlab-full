import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { query, withTransaction } from '../src/config/database.js';
import { sanitizeAuditValues, writeAudit } from '../src/modules/audit/audit.service.js';
import { createCompany, setupAuthDb } from './helpers/auth.js';
import { describeDb } from './helpers/db.js';

type Db = Awaited<ReturnType<typeof setupAuthDb>>;

describe('sanitizeAuditValues (D-62)', () => {
  it('password_hash, token, token_hash va boshqa sezgir kalitlarni rekursiv olib tashlaydi', () => {
    const input = {
      id: 'u1',
      email: 'a@b.uz',
      password_hash: '$2b$10$abc',
      passwordHash: 'x',
      nested: { token: 't', token_hash: 'h', refreshToken: 'r', keep: 1 },
      list: [{ password: 'p', name: 'n' }],
      at: new Date(0),
    };
    const out = sanitizeAuditValues(input);
    expect(out).toEqual({
      id: 'u1',
      email: 'a@b.uz',
      nested: { keep: 1 },
      list: [{ name: 'n' }],
      at: new Date(0),
    });
    expect(input.password_hash).toBe('$2b$10$abc'); // asl ob'ekt o'zgarmaydi
    expect(sanitizeAuditValues(null)).toBeNull();
    expect(sanitizeAuditValues('matn')).toBe('matn');
  });
});

describeDb('writeAudit + withTransaction (D-64)', () => {
  let db: Db;
  beforeAll(async () => {
    db = await setupAuthDb();
  });
  afterAll(async () => {
    await db.teardown();
  });

  const count = async (action: string) =>
    Number(
      (
        await query<{ n: string }>('SELECT count(*) AS n FROM audit_log WHERE action = $1', [
          action,
        ])
      ).rows[0]!.n,
    );

  it("o'zgartirish bilan bir tranzaksiyada: commit — ikkalasi ham bor", async () => {
    const company = await createCompany();
    await withTransaction(async (client) => {
      await client.query('UPDATE companies SET name = $1 WHERE id = $2', ['Yangi nom', company.id]);
      await writeAudit(client, {
        tableName: 'companies',
        recordId: company.id,
        action: 'update',
        companyId: company.id,
        oldValues: { name: company.name },
        newValues: { name: 'Yangi nom', token: 'sir' },
      });
    });
    const row = await query<{ new_values: unknown }>(
      `SELECT new_values FROM audit_log WHERE action = 'update' AND record_id = $1`,
      [company.id],
    );
    expect(row.rows[0]!.new_values).toEqual({ name: 'Yangi nom' });
  });

  it("rollback bo'lsa audit yozuvi ham yozilmaydi", async () => {
    const company = await createCompany();
    await expect(
      withTransaction(async (client) => {
        await writeAudit(client, {
          tableName: 'companies',
          recordId: company.id,
          action: 'rolled_back',
        });
        await client.query('UPDATE companies SET name = $1 WHERE id = $2', ['Bekor', company.id]);
        throw new Error('biznes xatosi');
      }),
    ).rejects.toThrow('biznes xatosi');
    expect(await count('rolled_back')).toBe(0);
    const { rows } = await query<{ name: string }>('SELECT name FROM companies WHERE id = $1', [
      company.id,
    ]);
    expect(rows[0]!.name).toBe(company.name);
  });

  it("auth bo'lmagan hodisada record_id NULL — DB rad etadi (D-80)", async () => {
    await expect(
      writeAudit(undefined, { tableName: 'companies', action: 'update' }),
    ).rejects.toMatchObject({
      constraint: 'audit_log_record_id_check',
    });
    await writeAudit(undefined, {
      tableName: 'auth',
      action: 'login_failed',
      newValues: { email: 'x@y.uz' },
    });
    expect(await count('login_failed')).toBe(1);
  });
});
