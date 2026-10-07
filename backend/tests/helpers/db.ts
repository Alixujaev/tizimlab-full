import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { describe } from 'vitest';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || undefined;

if (!TEST_DATABASE_URL) {
  if (process.env.CI) {
    // CI'da DB testlari majburiy — skip bo'lsa ish yiqilishi kerak
    throw new Error(
      "CI muhitida TEST_DATABASE_URL o'rnatilmagan: DB testlari o'tkazib yuborilmaydi",
    );
  }
  console.warn(
    "[db-tests] TEST_DATABASE_URL yo'q — DB testlari o'tkazib yuborildi. backend/.env ga qo'shing.",
  );
}

/** DB kerak bo'lgan test bloklari uchun: URL bo'lmasa lokal'da skip. */
export const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

export interface IsolatedDb {
  pool: pg.Pool;
  schema: string;
  drop(): Promise<void>;
}

/** Har test uchun alohida sxema: pool'dagi barcha ulanishlar `search_path` orqali unga yo'naltiriladi. */
export async function createIsolatedDb(max = 5): Promise<IsolatedDb> {
  const schema = `t_${randomBytes(6).toString('hex')}`;
  const admin = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  await admin.end();
  const pool = new pg.Pool({
    connectionString: TEST_DATABASE_URL,
    max,
    options: `-c search_path=${schema}`,
  });
  return {
    pool,
    schema,
    async drop() {
      await pool.end();
      const c = new pg.Client({ connectionString: TEST_DATABASE_URL });
      await c.connect();
      await c.query(`DROP SCHEMA ${schema} CASCADE`);
      await c.end();
    },
  };
}
