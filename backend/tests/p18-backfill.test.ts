import { copyFile, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { runMigrations } from '../src/db/migrator.js';
import { createIsolatedDb, describeDb, type IsolatedDb } from './helpers/db.js';

/**
 * P18 (D-184..D-186): 027 backfill — mavjud ma'lumot ustida. Hech narsa yo'qolmaydi, bilinmagani NULL qoladi
 * (taxmin yo'q): tahlil sanasi faqat snapshot'dan, apparat — NULL; asosiy fayllar `protocol_files(kind='protocol')`
 * ga bog'lanadi; rad etish sabablari audit → tracking → joriy ustun tartibida, takrorsiz.
 */

const MIGRATIONS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/db/migrations',
);

describeDb('027 backfill', () => {
  let db: IsolatedDb;
  let dir: string;
  const id = {
    company: '00000000-0000-4000-8000-0000000000c1',
    user: '00000000-0000-4000-8000-0000000000a1',
    labHead: '00000000-0000-4000-8000-0000000000a2',
    sample: '00000000-0000-4000-8000-0000000000b1',
    pSnap: '00000000-0000-4000-8000-0000000000d1',
    pNoSnap: '00000000-0000-4000-8000-0000000000d2',
    pEtl: '00000000-0000-4000-8000-0000000000d3',
  };

  beforeAll(async () => {
    db = await createIsolatedDb(2);
    dir = await mkdtemp(path.join(tmpdir(), 'p18-mig-'));
    for (const f of await readdir(MIGRATIONS)) {
      if (/^\d{3}_.+\.sql$/.test(f) && Number(f.slice(0, 3)) <= 26) {
        await copyFile(path.join(MIGRATIONS, f), path.join(dir, f));
      }
    }
    await runMigrations({ pool: db.pool, dir });
    const q = (sql: string, params: unknown[] = []) => db.pool.query(sql, params);
    await q(`INSERT INTO companies (id, name, slug) VALUES ($1, 'Legacy', 'legacy')`, [id.company]);
    await q(
      `INSERT INTO users (id, email, password_hash, full_name, role, company_id)
       VALUES ($1, 'c@l.uz', 'x', 'Kimyogar', 'chemist', $3), ($2, 'h@l.uz', 'x', 'Mudir', 'lab_head', $3)`,
      [id.user, id.labHead, id.company],
    );
    await q(
      `INSERT INTO samples (id, company_id, type, status, substance_name, serial_number, created_by, assigned_to)
       VALUES ($1, $2, 'raw_material', 'rejected', 'Eski modda', 'OLD-1', $3, $3)`,
      [id.sample, id.company, id.user],
    );
    // 1) snapshot bor, fayl bor, ikki marta rad etilgan (audit'da), hozir submitted
    await q(
      `INSERT INTO protocols (id, company_id, sample_id, created_by, status, protocol_role, file_path, file_name,
                              file_size, file_mime, temperature_snapshot)
       VALUES ($1, $2, $3, $4, 'submitted', 'standard', 'k/p1.pdf', 'p1.pdf', 120, 'application/pdf',
               '{"analysisDate":"2026-03-10","readingId":"r"}'::jsonb)`,
      [id.pSnap, id.company, id.sample, id.user],
    );
    // 2) snapshot yo'q, fayl yo'q — tracking'dagi rad etish (auditsiz)
    await q(
      `INSERT INTO protocols (id, company_id, sample_id, created_by, status, protocol_role)
       VALUES ($1, $2, $3, $4, 'draft', 'in_process')`,
      [id.pNoSnap, id.company, id.sample, id.user],
    );
    // 3) ETL: joriy rad sababi faqat ustunda
    await q(
      `INSERT INTO protocols (id, company_id, sample_id, created_by, status, protocol_role, rejection_reason, rejected_at)
       VALUES ($1, $2, $3, $4, 'rejected', 'final', 'ETL sababi', '2025-12-01T10:00:00Z')`,
      [id.pEtl, id.company, id.sample, id.user],
    );
    await q(
      `INSERT INTO audit_log (user_id, company_id, table_name, record_id, action, new_values, created_at)
       VALUES ($1, $2, 'protocols', $3, 'reject', '{"status":"rejected","rejectionReason":"Birinchi sabab"}', '2026-03-01T10:00:00Z'),
              ($1, $2, 'protocols', $3, 'reject', '{"status":"rejected","rejectionReason":"Ikkinchi sabab"}', '2026-03-05T10:00:00Z'),
              ($1, $2, 'protocols', $3, 'reject', '{"status":"rejected"}', '2026-03-06T10:00:00Z')`,
      [id.labHead, id.company, id.pSnap],
    );
    // Audit bilan bir xil voqea tracking'da ham (takrorlanmasligi kerak) + faqat tracking'dagi voqea
    await q(
      `INSERT INTO sample_tracking (company_id, sample_id, event_type, user_id, from_status, to_status, reason, metadata, created_at)
       VALUES ($1, $2, 'rejected', $3, 'submitted', 'rejected', 'Birinchi sabab', $4, '2026-03-01T10:00:20Z'),
              ($1, $2, 'rejected', $3, 'submitted', 'rejected', 'Faqat trackingda', $5, '2026-02-01T09:00:00Z')`,
      [
        id.company,
        id.sample,
        id.labHead,
        JSON.stringify({ protocolId: id.pSnap }),
        JSON.stringify({ protocolId: id.pNoSnap }),
      ],
    );
    // Endi 027 (va keyingilari) — standart papkadan
    await runMigrations({ pool: db.pool });
  });
  afterAll(async () => {
    await db.drop();
    await rm(dir, { recursive: true, force: true });
  });

  it('tahlil sanasi faqat snapshot’dan; apparat NULL (taxmin yo‘q)', async () => {
    const { rows } = await db.pool.query<{
      id: string;
      analysis_date: string | null;
      equipment_id: string | null;
    }>(`SELECT id, analysis_date::text, equipment_id FROM protocols ORDER BY id`);
    expect(rows).toEqual([
      { id: id.pSnap, analysis_date: '2026-03-10', equipment_id: null },
      { id: id.pNoSnap, analysis_date: null, equipment_id: null },
      { id: id.pEtl, analysis_date: null, equipment_id: null },
    ]);
  });

  it('asosiy fayl files + protocol_files(kind=protocol) ga bog‘landi, metadata namunadan; fayl ustunlari saqlangan', async () => {
    const { rows } = await db.pool.query(
      `SELECT pf.kind, pf.substance_name, pf.series, pf.analysis_date::text AS analysis_date, pf.chemist_id,
              pf.equipment_id, f.r2_key, f.filename, f.size_bytes::int AS size
         FROM protocol_files pf JOIN files f ON f.id = pf.file_id`,
    );
    expect(rows).toEqual([
      {
        kind: 'protocol',
        substance_name: 'Eski modda',
        series: 'OLD-1',
        analysis_date: '2026-03-10',
        chemist_id: id.user,
        equipment_id: null,
        r2_key: 'k/p1.pdf',
        filename: 'p1.pdf',
        size: 120,
      },
    ]);
    const p = await db.pool.query(`SELECT file_path FROM protocols WHERE id = $1`, [id.pSnap]);
    expect(p.rows[0].file_path).toBe('k/p1.pdf');
  });

  it('rad etish tarixi: audit (2), tracking (faqat yangisi), joriy ustun (ETL) — takrorsiz', async () => {
    const { rows } = await db.pool.query<{
      protocol_id: string;
      reason: string;
      source: string;
      rejected_by: string | null;
    }>(
      `SELECT protocol_id, reason, source, rejected_by FROM protocol_rejections ORDER BY rejected_at`,
    );
    expect(rows).toEqual([
      { protocol_id: id.pEtl, reason: 'ETL sababi', source: 'current', rejected_by: null },
      {
        protocol_id: id.pNoSnap,
        reason: 'Faqat trackingda',
        source: 'tracking',
        rejected_by: id.labHead,
      },
      { protocol_id: id.pSnap, reason: 'Birinchi sabab', source: 'audit', rejected_by: id.labHead },
      { protocol_id: id.pSnap, reason: 'Ikkinchi sabab', source: 'audit', rejected_by: id.labHead },
    ]);
  });

  it('yangi ustunlar va jadvallar standart qiymatlari: ai_enabled=false, reaktiv lot maydonlari NULL', async () => {
    const c = await db.pool.query(`SELECT ai_enabled FROM companies WHERE id = $1`, [id.company]);
    expect(c.rows[0].ai_enabled).toBe(false);
    const cols = await db.pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'reagents'
          AND column_name IN ('lot_number','manufacturer','manufactured_at','arrival_date') ORDER BY 1`,
      [db.schema],
    );
    expect(cols.rows.map((r) => r.column_name)).toEqual([
      'arrival_date',
      'lot_number',
      'manufactured_at',
      'manufacturer',
    ]);
  });
});
