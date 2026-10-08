import { randomBytes } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { query, setPool } from '../../src/config/database.js';
import { runMigrations } from '../../src/db/migrator.js';
import type { Role } from '../../src/modules/auth/auth.types.js';
import { hashPassword } from '../../src/modules/auth/password.js';
import { createIsolatedDb, type IsolatedDb } from './db.js';

/** Barcha test foydalanuvchilarining standart paroli (siyosatga mos). */
export const TEST_PASSWORD = 'Parol12345';
let cachedHash: Promise<string> | null = null;
const defaultHash = () => (cachedHash ??= hashPassword(TEST_PASSWORD));

/**
 * Alohida sxema + barcha migratsiyalar + global pool shu sxemaga (service'lar `getPool()` ishlatadi).
 * `afterAll(() => db.drop())` va `afterAll(() => setPool(null))` — `teardown` orqali.
 */
export async function setupAuthDb(): Promise<IsolatedDb & { teardown: () => Promise<void> }> {
  const db = await createIsolatedDb(5);
  await runMigrations({ pool: db.pool });
  setPool(db.pool);
  return {
    ...db,
    async teardown() {
      setPool(null);
      await db.drop();
    },
  };
}

const uniq = () => randomBytes(4).toString('hex');

export interface TestCompany {
  id: string;
  name: string;
  slug: string;
}

export async function createCompany(
  opts: { isActive?: boolean; name?: string } = {},
): Promise<TestCompany> {
  const suffix = uniq();
  const { rows } = await query<TestCompany>(
    'INSERT INTO companies (name, slug, is_active) VALUES ($1, $2, $3) RETURNING id, name, slug',
    [opts.name ?? `Lab ${suffix}`, `lab-${suffix}`, opts.isActive ?? true],
  );
  return rows[0]!;
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  role: Role;
  companyId: string | null;
}

export async function createUser(opts: {
  role: Role;
  company?: TestCompany | null;
  password?: string;
  isActive?: boolean;
  email?: string;
}): Promise<TestUser> {
  const password = opts.password ?? TEST_PASSWORD;
  const hash = opts.password ? await hashPassword(opts.password) : await defaultHash();
  const companyId =
    opts.role === 'super_admin' ? null : (opts.company?.id ?? (await createCompany()).id);
  const email = opts.email ?? `${opts.role}.${uniq()}@test.uz`;
  const { rows } = await query<{ id: string }>(
    `INSERT INTO users (email, password_hash, full_name, role, company_id, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [email, hash, `Test ${opts.role}`, opts.role, companyId, opts.isActive ?? true],
  );
  return { id: rows[0]!.id, email, password, role: opts.role, companyId };
}

export interface LoggedIn {
  accessToken: string;
  /** `Cookie` sarlavhasi uchun `refresh_token=...` qiymati. */
  refreshCookie: string;
}

/** `Set-Cookie` dan refresh cookie'ni ajratadi. */
export function refreshCookieOf(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((c) => c.startsWith('refresh_token='));
  if (!cookie) throw new Error('refresh cookie topilmadi');
  return cookie.split(';')[0]!;
}

export async function loginAs(
  app: Express,
  user: Pick<TestUser, 'email' | 'password'>,
): Promise<LoggedIn> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: user.password });
  if (res.status !== 200) throw new Error(`login ${res.status}: ${JSON.stringify(res.body)}`);
  return { accessToken: res.body.data.accessToken as string, refreshCookie: refreshCookieOf(res) };
}
