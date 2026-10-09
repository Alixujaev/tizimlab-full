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

// Tranzaksiya COMMIT bo'lgandan keyin bajariladigan amallar (masalan, socket push) — ROLLBACK da tashlanadi
const afterCommit = new WeakMap<pg.PoolClient, (() => void)[]>();

/**
 * `fn` ni tranzaksiya muvaffaqiyatli yakunlangach chaqiradi. Tranzaksiyadan tashqarida (`Pool`) — darhol.
 * Shu tufayli rollback bo'lgan yozuv haqida tashqi dunyoga (brauzer, Telegram) xabar ketmaydi.
 */
export function onCommit(db: pg.Pool | pg.PoolClient, fn: () => void): void {
  const queue = db instanceof pg.Pool ? undefined : afterCommit.get(db);
  if (queue) queue.push(fn);
  else fn();
}

/** Bir nechta yozuvni bitta tranzaksiyada bajaradi: xatoda ROLLBACK, har doim release. */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
  db: pg.Pool = getPool(),
): Promise<T> {
  const client = await db.connect();
  const queue: (() => void)[] = [];
  afterCommit.set(client, queue);
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    afterCommit.delete(client);
    for (const job of queue) {
      try {
        job();
      } catch {
        // Ma'lumot allaqachon saqlangan: COMMIT dan keyingi yon ta'sir xatosi so'rovni buzmasligi kerak
      }
    }
    return result;
  } catch (err) {
    afterCommit.delete(client);
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
