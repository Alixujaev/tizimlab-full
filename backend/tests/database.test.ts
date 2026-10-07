import { afterAll, beforeAll, expect, it } from 'vitest';
import { pingDb, query, withTransaction } from '../src/config/database.js';
import { createIsolatedDb, describeDb, type IsolatedDb } from './helpers/db.js';

describeDb('database (TEST_DATABASE_URL)', () => {
  let db: IsolatedDb;

  beforeAll(async () => {
    db = await createIsolatedDb(2);
    await query(
      'CREATE TABLE items (id serial PRIMARY KEY, name text NOT NULL UNIQUE)',
      [],
      db.pool,
    );
  });
  afterAll(async () => {
    await db.drop();
  });

  it('pingDb', async () => {
    expect(await pingDb(db.pool)).toBe(true);
  });

  it('query parametrlashtirilgan', async () => {
    const { rows } = await query<{ v: string }>(
      'SELECT $1::text AS v',
      ["o'; DROP TABLE items;--"],
      db.pool,
    );
    expect(rows[0]?.v).toBe("o'; DROP TABLE items;--");
  });

  it('withTransaction muvaffaqiyatda commit qiladi', async () => {
    const id = await withTransaction(async (c) => {
      const { rows } = await c.query<{ id: number }>(
        'INSERT INTO items (name) VALUES ($1) RETURNING id',
        ['a'],
      );
      await c.query('INSERT INTO items (name) VALUES ($1)', ['b']);
      return rows[0]!.id;
    }, db.pool);
    expect(id).toBeGreaterThan(0);
    const { rows } = await query('SELECT name FROM items ORDER BY name', [], db.pool);
    expect(rows.map((r) => r.name)).toEqual(['a', 'b']);
  });

  it('xatoda rollback qiladi va xatoni qayta tashlaydi', async () => {
    await expect(
      withTransaction(async (c) => {
        await c.query('INSERT INTO items (name) VALUES ($1)', ['c']);
        await c.query('INSERT INTO items (name) VALUES ($1)', ['a']); // unique buziladi
      }, db.pool),
    ).rejects.toMatchObject({ code: '23505' });
    const { rows } = await query('SELECT name FROM items WHERE name = $1', ['c'], db.pool);
    expect(rows).toHaveLength(0);
  });

  it("ulanishni har doim pool'ga qaytaradi (max=2 da 5 marta xato)", async () => {
    for (let i = 0; i < 5; i++) {
      await expect(
        withTransaction(async () => {
          throw new Error('x');
        }, db.pool),
      ).rejects.toThrow('x');
    }
    expect(db.pool.totalCount).toBeLessThanOrEqual(2);
    expect(db.pool.idleCount).toBe(db.pool.totalCount);
    expect(await pingDb(db.pool)).toBe(true);
  });
});
