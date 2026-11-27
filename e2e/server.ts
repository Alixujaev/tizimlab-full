/**
 * P20 (D-199): E2E backend — alohida e2e bazasida `e2e` sxemasini qayta yaratadi, migratsiyalar + seed,
 * so'ng backend'ni test rejimida (AI_MOCK, mock embedding, disk xotira) ishga tushiradi.
 *
 * Xavfsizlik: faqat bazasi nomida "e2e" bo'lgan E2E_DATABASE_URL bilan ishlaydi va faqat `e2e` sxemasini
 * o'chiradi — oddiy test/dev/prod bazasiga tegmaydi. Haqiqiy tashqi API'lar chaqirilmaydi.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { parse as parseDotenv } from 'dotenv';
import pg from 'pg';
import { runMigrations } from '../backend/src/db/migrator.js';
import { seed } from './seed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = 'e2e';

async function main(): Promise<void> {
  // Lokal: E2E_DATABASE_URL backend/.env dan (CI'da job env'idan; mavjud qiymat ustidan yozilmaydi)
  // Faqat shu bitta kalit olinadi — dev .env dagi boshqa sozlamalar (AI, R2, Telegram) E2E ga o'tmasin
  const envFile = path.join(here, '..', 'backend', '.env');
  const local = existsSync(envFile) ? parseDotenv(readFileSync(envFile)) : {};
  const url = process.env.E2E_DATABASE_URL || local.E2E_DATABASE_URL;
  if (!url)
    throw new Error(
      'E2E_DATABASE_URL o‘rnatilmagan (masalan postgres://postgres:postgres@localhost:5433/tizimlab_e2e)',
    );
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!/e2e/i.test(dbName))
    throw new Error(`E2E bazasi nomida "e2e" bo‘lishi shart (hozir: ${dbName})`);

  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await admin.query(`CREATE SCHEMA ${SCHEMA}`);
  await admin.end();

  const searchPath = `-c search_path=${SCHEMA},public`;
  const pool = new pg.Pool({ connectionString: url, options: searchPath, max: 2 });
  await runMigrations({ pool });
  const state = await seed(pool);
  await pool.end();

  const stateDir = path.join(here, '.state');
  await mkdir(stateDir, { recursive: true });
  await writeFile(path.join(stateDir, 'seed.json'), JSON.stringify(state, null, 2));
  const filesDir = path.join(here, '.files');
  await rm(filesDir, { recursive: true, force: true });

  const sep = url.includes('?') ? '&' : '?';
  Object.assign(process.env, {
    NODE_ENV: 'test',
    PORT: process.env.E2E_BACKEND_PORT ?? '4100',
    DATABASE_URL: `${url}${sep}options=${encodeURIComponent(searchPath)}`,
    JWT_ACCESS_SECRET: 'e2e-access-secret-0123456789abcdef0123456789',
    JWT_REFRESH_SECRET: 'e2e-refresh-secret-0123456789abcdef012345678',
    FRONTEND_URL: `http://localhost:${process.env.E2E_FRONTEND_PORT ?? '5174'}`,
    AI_MOCK: '1',
    EMBEDDING_PROVIDER: 'mock',
    STORAGE_DRIVER: 'disk',
    STORAGE_DISK_DIR: filesDir,
    // Haqiqiy tashqi xizmatlar o'chiq
    TELEGRAM_BOT_TOKEN: '',
    ANTHROPIC_API_KEY: '',
    EMBEDDING_API_KEY: '',
    R2_ACCOUNT_ID: '',
  });
  await import('../backend/src/server.js');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
