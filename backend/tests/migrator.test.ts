import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_MIGRATIONS_DIR,
  loadMigrations,
  MigrationError,
  migrationStatus,
  runMigrations,
} from '../src/db/migrator.js';
import { createIsolatedDb, describeDb, type IsolatedDb } from './helpers/db.js';

let dir: string;

async function files(spec: Record<string, string>) {
  for (const [name, sql] of Object.entries(spec)) await writeFile(path.join(dir, name), sql);
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'tizimlab-mig-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('loadMigrations (DB siz)', () => {
  it("raqam bo'yicha tartiblaydi va checksum hisoblaydi", async () => {
    await files({ '002_b.sql': 'SELECT 2;', '001_a.sql': 'SELECT 1;', 'README.md': 'x' });
    const list = await loadMigrations(dir);
    expect(list.map((m) => m.filename)).toEqual(['001_a.sql', '002_b.sql']);
    expect(list[0]?.checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('CRLF va LF bir xil checksum beradi', async () => {
    await files({ '001_a.sql': 'SELECT 1;\nSELECT 2;\n' });
    const lf = (await loadMigrations(dir))[0]?.checksum;
    await files({ '001_a.sql': 'SELECT 1;\r\nSELECT 2;\r\n' });
    expect((await loadMigrations(dir))[0]?.checksum).toBe(lf);
  });

  it('takroriy raqam → xato', async () => {
    await files({ '001_a.sql': 'SELECT 1;', '001_b.sql': 'SELECT 1;' });
    await expect(loadMigrations(dir)).rejects.toThrow(/Takroriy migratsiya raqami 1/);
  });

  it('oraliq teshik → xato', async () => {
    await files({ '001_a.sql': 'SELECT 1;', '003_c.sql': 'SELECT 3;' });
    await expect(loadMigrations(dir)).rejects.toThrow(/teshik: 002 kutilgan, 003_c.sql/);
  });

  it('001 dan boshlanmasa → xato', async () => {
    await files({ '002_b.sql': 'SELECT 2;' });
    await expect(loadMigrations(dir)).rejects.toBeInstanceOf(MigrationError);
  });

  it("noto'g'ri nom → xato", async () => {
    await files({ '1_init.sql': 'SELECT 1;' });
    await expect(loadMigrations(dir)).rejects.toThrow(/Noto'g'ri migratsiya fayl nomi/);
  });

  it("papka yo'q yoki bo'sh → bo'sh ro'yxat", async () => {
    expect(await loadMigrations(path.join(dir, 'missing'))).toEqual([]);
    expect(await loadMigrations(dir)).toEqual([]);
  });

  it('standart papka mavjud', async () => {
    await expect(loadMigrations(DEFAULT_MIGRATIONS_DIR)).resolves.toBeInstanceOf(Array);
  });
});

describeDb('runMigrations (TEST_DATABASE_URL)', () => {
  let db: IsolatedDb;
  beforeEach(async () => {
    db = await createIsolatedDb();
  });
  afterEach(async () => {
    await db.drop();
  });

  const tables = async () =>
    (
      await db.pool.query<{ table_name: string }>(
        'SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY 1',
        [db.schema],
      )
    ).rows.map((r) => r.table_name);

  it("tartib bilan qo'llaydi, schema_migrations ga yozadi, qayta ishga tushirish idempotent", async () => {
    await files({
      '001_create_a.sql': 'CREATE TABLE a (id int PRIMARY KEY);',
      '002_create_b.sql': 'CREATE TABLE b (a_id int REFERENCES a(id));',
    });
    const applied = await runMigrations({ pool: db.pool, dir });
    expect(applied.map((m) => m.version)).toEqual([1, 2]);
    expect(await tables()).toEqual(['a', 'b', 'schema_migrations']);
    const { rows } = await db.pool.query(
      'SELECT version, name, checksum FROM schema_migrations ORDER BY version',
    );
    expect(rows).toMatchObject([
      { version: 1, name: 'create_a' },
      { version: 2, name: 'create_b' },
    ]);
    expect(await runMigrations({ pool: db.pool, dir })).toEqual([]);
  });

  it("faqat yangilarini qo'llaydi va status ko'rsatadi", async () => {
    await files({ '001_a.sql': 'CREATE TABLE a (id int);' });
    await runMigrations({ pool: db.pool, dir });
    await files({ '002_b.sql': 'CREATE TABLE b (id int);' });
    const status1 = await migrationStatus({ pool: db.pool, dir });
    expect(status1.map((s) => s.state)).toEqual(['applied', 'pending']);
    expect((await runMigrations({ pool: db.pool, dir })).map((m) => m.version)).toEqual([2]);
  });

  it("qo'llangan fayl o'zgarsa → checksum xatosi, hech narsa qo'llanmaydi", async () => {
    await files({ '001_a.sql': 'CREATE TABLE a (id int);' });
    await runMigrations({ pool: db.pool, dir });
    await files({
      '001_a.sql': 'CREATE TABLE a (id bigint);',
      '002_b.sql': 'CREATE TABLE b (id int);',
    });
    await expect(runMigrations({ pool: db.pool, dir })).rejects.toThrow(/checksum mos emas/);
    expect(await tables()).not.toContain('b');
  });

  it("qo'llangan migratsiya diskda yo'q → xato", async () => {
    await files({ '001_a.sql': 'CREATE TABLE a (id int);' });
    await runMigrations({ pool: db.pool, dir });
    await rm(path.join(dir, '001_a.sql'));
    await expect(runMigrations({ pool: db.pool, dir })).rejects.toThrow(/diskda topilmadi/);
  });

  it("xato bergan fayl to'liq rollback, oldingilar saqlanadi", async () => {
    await files({
      '001_a.sql': 'CREATE TABLE a (id int);',
      '002_bad.sql': 'CREATE TABLE b (id int); SELECT * FROM no_such_table;',
    });
    await expect(runMigrations({ pool: db.pool, dir })).rejects.toThrow(/002_bad.sql qo'llanmadi/);
    expect(await tables()).toEqual(['a', 'schema_migrations']);
    const { rows } = await db.pool.query('SELECT version FROM schema_migrations');
    expect(rows).toEqual([{ version: 1 }]);
  });

  it("parallel ishga tushirish advisory lock bilan bir marta qo'llaydi", async () => {
    await files({
      '001_slow.sql': 'CREATE TABLE slow (id int); SELECT pg_sleep(0.3);',
      '002_after.sql': 'CREATE TABLE after_slow (id int);',
    });
    const [r1, r2, r3] = await Promise.all([
      runMigrations({ pool: db.pool, dir }),
      runMigrations({ pool: db.pool, dir }),
      runMigrations({ pool: db.pool, dir }),
    ]);
    const counts = [r1, r2, r3].map((r) => r.length).sort();
    expect(counts).toEqual([0, 0, 2]);
    const { rows } = await db.pool.query('SELECT count(*)::int AS n FROM schema_migrations');
    expect(rows[0].n).toBe(2);
  });
});
