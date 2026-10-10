import { afterAll, beforeAll, expect, it } from 'vitest';
import { query } from '../src/config/database.js';
import { migrationStatus, runMigrations } from '../src/db/migrator.js';
import { createCompany, setupAuthDb } from './helpers/auth.js';
import { describeDb } from './helpers/db.js';

type Db = Awaited<ReturnType<typeof setupAuthDb>>;

describeDb('001_core baseline migratsiyasi', () => {
  let db: Db;
  beforeAll(async () => {
    db = await setupAuthDb();
  });
  afterAll(async () => {
    await db.teardown();
  });

  const pgCode = async (sql: string, params: unknown[]) => {
    try {
      await query(sql, params);
      return null;
    } catch (err) {
      return (
        (err as { code?: string; constraint?: string }).constraint ??
        (err as { code?: string }).code
      );
    }
  };

  it("jadvallar yaratilgan, qayta ishga tushirish hech narsa o'zgartirmaydi (R-ARCH-20, R-ARCH-29..31)", async () => {
    const { rows } = await query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
      [db.schema],
    );
    expect(rows.map((r) => r.table_name)).toEqual([
      'audit_log',
      'companies',
      'files',
      'notifications',
      'protocol_files',
      'protocol_signatures',
      'protocols',
      'reagent_documents',
      'reagent_expense_log',
      'reagent_transactions',
      'reagents',
      'sample_tracking',
      'samples',
      'schema_migrations',
      'sensor_configs',
      'sessions',
      'substance_parameters',
      'substances',
      'temperature_alerts',
      'temperature_readings',
      'user_permissions',
      'users',
    ]);
    expect(await runMigrations({ pool: db.pool })).toEqual([]);
    const status = await migrationStatus({ pool: db.pool });
    expect(status).toEqual([
      expect.objectContaining({ version: 1, name: 'core', state: 'applied' }),
      expect.objectContaining({ version: 2, name: 'substances', state: 'applied' }),
      expect.objectContaining({ version: 3, name: 'samples', state: 'applied' }),
      expect.objectContaining({ version: 4, name: 'files_passport', state: 'applied' }),
      expect.objectContaining({ version: 5, name: 'protocols', state: 'applied' }),
      expect.objectContaining({ version: 6, name: 'protocol_extras', state: 'applied' }),
      expect.objectContaining({ version: 7, name: 'notifications', state: 'applied' }),
      expect.objectContaining({ version: 8, name: 'reagents', state: 'applied' }),
      expect.objectContaining({ version: 9, name: 'temperature', state: 'applied' }),
    ]);
  });

  it("notification_type: §9 dagi 10 tur + legacy 3 tur; notifications.type da DEFAULT yo'q (R-ARCH-43, R-ARCH-80, R-NOTIF-11)", async () => {
    const { rows } = await query<{ v: string }>(
      `SELECT unnest(enum_range(NULL::notification_type))::text AS v`,
      [],
    );
    expect(rows.map((r) => r.v).sort()).toEqual(
      [
        'general',
        'low_stock',
        'protocol_approved',
        'protocol_rejected',
        'protocol_submitted',
        'sample_approved',
        'sample_assigned',
        'sample_created',
        'sample_overdue',
        'sample_rejected',
        'stability_due_soon',
        'stability_overdue',
        'temperature_alert',
      ].sort(),
    );
    const col = await query<{ column_default: string | null; is_nullable: string }>(
      `SELECT column_default, is_nullable FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'notifications' AND column_name = 'type'`,
      [db.schema],
    );
    expect(col.rows[0]).toEqual({ column_default: null, is_nullable: 'NO' });
    const company = await createCompany();
    // type berilmasa — NOT NULL buziladi (default yo'q)
    expect(
      await pgCode(
        `INSERT INTO notifications (company_id, user_id, title, message)
         VALUES ($1, gen_random_uuid(), 't', 'm')`,
        [company.id],
      ),
    ).toBe('23502');
  });

  it('protocols: sample_id NOT NULL va ortiqcha ustunlar yo‘q (R-PROTO-62, D-74)', async () => {
    const { rows } = await query<{
      column_name: string;
      is_nullable: string;
    }>(
      `SELECT column_name, is_nullable
         FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'protocols'
        ORDER BY column_name`,
      [db.schema],
    );
    const sampleIdCol = rows.find((r) => r.column_name === 'sample_id');
    expect(sampleIdCol).toBeDefined();
    expect(sampleIdCol?.is_nullable).toBe('NO');

    const columnNames = rows.map((r) => r.column_name);
    expect(columnNames).not.toContain('substance_id');
    expect(columnNames).not.toContain('batch_number');
    expect(columnNames).not.toContain('sample_source');
    expect(columnNames).not.toContain('notes');
  });

  it("user_role enum'i — aynan 6 ta rol (spec §1)", async () => {
    const { rows } = await query<{ v: string }>(
      `SELECT unnest(enum_range(NULL::user_role))::text AS v`,
    );
    expect(rows.map((r) => r.v).sort()).toEqual(
      ['admin', 'chemist', 'director', 'kontrolyor', 'lab_head', 'super_admin'].sort(),
    );
    expect(await pgCode(`SELECT 'boss'::user_role`, [])).toBe('22P02');
  });

  it('CHECK: super_admin ⇔ company_id NULL (R-ROLE-02/03)', async () => {
    const company = await createCompany();
    const insert = (email: string, role: string, companyId: string | null) =>
      pgCode(
        `INSERT INTO users (email, password_hash, full_name, role, company_id) VALUES ($1, 'x', 'T', $2, $3)`,
        [email, role, companyId],
      );
    expect(await insert('sa1@t.uz', 'super_admin', company.id)).toBe(
      'users_super_admin_company_check',
    );
    expect(await insert('ch1@t.uz', 'chemist', null)).toBe('users_super_admin_company_check');
    expect(await insert('sa2@t.uz', 'super_admin', null)).toBeNull();
    expect(await insert('ch2@t.uz', 'chemist', company.id)).toBeNull();
  });

  it('email global unikal va faqat kichik harfda (D-66, D-91)', async () => {
    const company = await createCompany();
    const insert = (email: string) =>
      pgCode(
        `INSERT INTO users (email, password_hash, full_name, role, company_id) VALUES ($1, 'x', 'T', 'admin', $2)`,
        [email, company.id],
      );
    expect(await insert('dup@t.uz')).toBeNull();
    expect(await insert('dup@t.uz')).toBe('users_email_key');
    expect(await insert('Upper@T.uz')).toBe('users_email_lower_check');
  });

  it("audit_log.record_id NULL faqat table_name='auth' uchun (D-80)", async () => {
    const insert = (table: string, recordId: string | null) =>
      pgCode(`INSERT INTO audit_log (table_name, record_id, action) VALUES ($1, $2, 'x')`, [
        table,
        recordId,
      ]);
    expect(await insert('auth', null)).toBeNull();
    expect(await insert('sessions', null)).toBe('audit_log_record_id_check');
    expect(await insert('sessions', '00000000-0000-0000-0000-000000000001')).toBeNull();
  });

  it('user_permissions: company_id majburiy va (user, resource, action) unikal', async () => {
    const company = await createCompany();
    const { rows } = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, role, company_id) VALUES ('perm@t.uz', 'x', 'T', 'admin', $1) RETURNING id`,
      [company.id],
    );
    const uid = rows[0]!.id;
    const grant = (companyId: string | null) =>
      pgCode(
        `INSERT INTO user_permissions (user_id, resource, action, granted_by, company_id) VALUES ($1, 'samples', 'create', $1, $2)`,
        [uid, companyId],
      );
    expect(await grant(null)).toBe('23502');
    expect(await grant(company.id)).toBeNull();
    expect(await grant(company.id)).toBe('uq_user_permissions');
  });

  it("updated_at trigger'i ishlaydi; audit triggerlari yo'q (D-64)", async () => {
    const company = await createCompany();
    await query(`UPDATE companies SET updated_at = now() - interval '1 day' WHERE id = $1`, [
      company.id,
    ]);
    // Trigger qo'lda qo'yilgan qiymatni ham now() ga almashtiradi
    const { rows } = await query<{ fresh: boolean }>(
      `SELECT updated_at > now() - interval '1 minute' AS fresh FROM companies WHERE id = $1`,
      [company.id],
    );
    expect(rows[0]!.fresh).toBe(true);
    const triggers = await query<{ tgname: string }>(
      `SELECT t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = $1 AND NOT t.tgisinternal ORDER BY t.tgname`,
      [db.schema],
    );
    expect(triggers.rows.map((r) => r.tgname)).toEqual([
      'trg_companies_updated_at',
      'trg_protocols_updated_at',
      'trg_samples_updated_at',
      'trg_sensor_configs_updated_at',
      'trg_substances_updated_at',
      'trg_users_updated_at',
    ]);
  });

  it("sessions jadvalida company_id yo'q (auth jadvali)", async () => {
    const { rows } = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'sessions'`,
      [db.schema],
    );
    expect(rows.map((r) => r.column_name)).not.toContain('company_id');
  });
});
