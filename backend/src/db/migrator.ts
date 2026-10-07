import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';

// Migratsiyalar faqat oldinga (D-24): `NNN_nom.sql`, qo'llangan fayl o'zgarsa — xato.

export const DEFAULT_MIGRATIONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'migrations',
);

const FILE_RE = /^(\d{3})_([a-z0-9_]+)\.sql$/;
// Parallel runner'larni bir-biridan to'sish uchun ixtiyoriy, o'zgarmas kalit
const ADVISORY_LOCK_KEY = 7_455_632_812;

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

export interface MigrationFile {
  version: number;
  name: string;
  filename: string;
  sql: string;
  checksum: string;
}

interface AppliedRow {
  version: number;
  name: string;
  checksum: string;
  applied_at: Date;
}

export interface MigrationLogger {
  info(message: string, meta?: Record<string, unknown>): unknown;
}

export interface MigrateOptions {
  pool: pg.Pool;
  dir?: string;
  logger?: MigrationLogger;
}

export interface MigrationStatusRow {
  version: number;
  name: string;
  state: 'applied' | 'pending';
  appliedAt: Date | null;
}

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

/** Papkadagi migratsiyalarni o'qiydi va tuzilmasini tekshiradi (takror, teshik, noto'g'ri nom). */
export async function loadMigrations(dir: string): Promise<MigrationFile[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const files: MigrationFile[] = [];
  for (const filename of entries.filter((f) => f.endsWith('.sql')).sort()) {
    const match = FILE_RE.exec(filename);
    if (!match) {
      throw new MigrationError(
        `Noto'g'ri migratsiya fayl nomi: ${filename} (kutilgan format: NNN_nom.sql, kichik harflar)`,
      );
    }
    // CRLF/LF farqi checksum'ni o'zgartirmasligi uchun normallashtiriladi (Windows + git autocrlf)
    const sql = (await readFile(path.join(dir, filename), 'utf8')).replace(/\r\n/g, '\n');
    files.push({
      version: Number(match[1]),
      name: match[2]!,
      filename,
      sql,
      checksum: sha256(sql),
    });
  }
  files.sort((a, b) => a.version - b.version);
  files.forEach((file, i) => {
    const prev = files[i - 1];
    if (prev && prev.version === file.version) {
      throw new MigrationError(
        `Takroriy migratsiya raqami ${file.version}: ${prev.filename} va ${file.filename}`,
      );
    }
    if (file.version !== i + 1) {
      throw new MigrationError(
        `Migratsiya raqamlarida teshik: ${String(i + 1).padStart(3, '0')} kutilgan, ${file.filename} topildi`,
      );
    }
  });
  return files;
}

async function ensureTable(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    integer PRIMARY KEY,
      name       text NOT NULL,
      checksum   char(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
}

async function readApplied(client: pg.PoolClient): Promise<AppliedRow[]> {
  const { rows } = await client.query<AppliedRow>(
    'SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version',
  );
  return rows;
}

/** Qo'llanganlar diskdagi fayllarga mosligini tekshiradi. */
function verifyApplied(files: MigrationFile[], applied: AppliedRow[]): void {
  const byVersion = new Map(files.map((f) => [f.version, f]));
  for (const row of applied) {
    const file = byVersion.get(row.version);
    if (!file) {
      throw new MigrationError(
        `Bazada qo'llangan migratsiya ${row.version} (${row.name}) diskda topilmadi`,
      );
    }
    if (file.checksum !== row.checksum.trim()) {
      throw new MigrationError(
        `Qo'llangan migratsiya o'zgartirilgan: ${file.filename} (checksum mos emas). ` +
          "Qo'llangan faylni o'zgartirmang — yangi migratsiya qo'shing.",
      );
    }
  }
}

async function withLock<T>(pool: pg.Pool, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
    try {
      return await fn(client);
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

/** Kutilayotgan migratsiyalarni tartib bilan, har birini alohida tranzaksiyada qo'llaydi. */
export async function runMigrations({
  pool,
  dir = DEFAULT_MIGRATIONS_DIR,
  logger,
}: MigrateOptions): Promise<MigrationFile[]> {
  const files = await loadMigrations(dir);
  return withLock(pool, async (client) => {
    await ensureTable(client);
    const applied = await readApplied(client);
    verifyApplied(files, applied);
    const done = new Set(applied.map((r) => r.version));
    const pending = files.filter((f) => !done.has(f.version));
    for (const file of pending) {
      try {
        await client.query('BEGIN');
        await client.query(file.sql);
        await client.query(
          'INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)',
          [file.version, file.name, file.checksum],
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw new MigrationError(`${file.filename} qo'llanmadi: ${(err as Error).message}`);
      }
      logger?.info('migration applied', { file: file.filename });
    }
    return pending;
  });
}

export async function migrationStatus({
  pool,
  dir = DEFAULT_MIGRATIONS_DIR,
}: MigrateOptions): Promise<MigrationStatusRow[]> {
  const files = await loadMigrations(dir);
  return withLock(pool, async (client) => {
    await ensureTable(client);
    const applied = await readApplied(client);
    verifyApplied(files, applied);
    const byVersion = new Map(applied.map((r) => [r.version, r]));
    return files.map((f) => {
      const row = byVersion.get(f.version);
      return {
        version: f.version,
        name: f.name,
        state: row ? 'applied' : 'pending',
        appliedAt: row?.applied_at ?? null,
      };
    });
  });
}
