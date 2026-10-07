import pg from 'pg';

let pool: pg.Pool | null = null;

/** Pool yaratadi. SSL connection string'dagi `sslmode` orqali boshqariladi (cloud: `?sslmode=require`). */
export function createPool(connectionString: string, options: pg.PoolConfig = {}): pg.Pool {
  return new pg.Pool({ connectionString, max: 10, ...options });
}

export function initDb(connectionString: string): pg.Pool {
  if (pool) return pool;
  pool = createPool(connectionString);
  return pool;
}

export function getPool(): pg.Pool {
  if (!pool) throw new Error('DB pool ishga tushirilmagan: avval initDb() chaqiring');
  return pool;
}

/** Testlar uchun: tashqi pool'ni o'rnatish. */
export function setPool(p: pg.Pool | null): void {
  pool = p;
}

export function query<R extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
  db: pg.Pool | pg.PoolClient = getPool(),
): Promise<pg.QueryResult<R>> {
  return db.query<R>(text, params);
}

/** Bir nechta yozuvni bitta tranzaksiyada bajaradi: xatoda ROLLBACK, har doim release. */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
  db: pg.Pool = getPool(),
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ROLLBACK xatosi asl xatoni yashirmasligi kerak
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function pingDb(db: pg.Pool = getPool()): Promise<boolean> {
  try {
    await db.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function closePool(): Promise<void> {
  if (!pool) return;
  const p = pool;
  pool = null;
  await p.end();
}
