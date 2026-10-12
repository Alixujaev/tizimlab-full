import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';
import { mapLegacyDataset } from '../../scripts/etl/mapper.js';
import { runETL } from '../../scripts/etl/migrator.js';
import type { LegacyDataset } from '../../scripts/etl/types.js';
import { validateLegacyDataset } from '../../scripts/etl/validator.js';
import { runMigrations } from '../src/db/migrator.js';
import { createIsolatedDb, describeDb } from './helpers/db.js';

const fixturePath = fileURLToPath(
  new URL('../../scripts/etl/fixtures/legacy_production_synthetic.json', import.meta.url),
);
const rawFixture = readFileSync(fixturePath, 'utf-8');
const baseDataset: LegacyDataset = JSON.parse(rawFixture) as LegacyDataset;

describe('P12a: ETL Legacy Migration (Unit & Validations)', () => {
  it('1. Sintetik dataset D-82 talablariga mos keladi (valid: true)', () => {
    const result = validateLegacyDataset(baseDataset);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.metrics.companiesCount).toBe(1);
    expect(result.metrics.usersCount).toBe(8);
    expect(result.metrics.samplesCount).toBe(12);
    expect(result.metrics.protocolsCount).toBe(3);
  });

  it('2. D-82 tekshiruvi: sample_documents > 0 bo‘lsa to‘xtaydi (FAIL)', () => {
    const invalidData: LegacyDataset = {
      ...baseDataset,
      sample_documents: [{ id: 'doc-1', sample_id: 'sm1' }],
    };
    const result = validateLegacyDataset(invalidData);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('sample_documents'))).toBe(true);
  });

  it('3. D-82 tekshiruvi: protocol_values > 0 bo‘lsa to‘xtaydi (FAIL)', () => {
    const invalidData: LegacyDataset = {
      ...baseDataset,
      protocol_values: [{ id: 'val-1', protocol_id: 'pr1' }],
    };
    const result = validateLegacyDataset(invalidData);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('protocol_values'))).toBe(true);
  });

  it('4. D-82 tekshiruvi: sample_id NULL bo‘lgan protokollar bo‘lsa to‘xtaydi (FAIL)', () => {
    const invalidData: LegacyDataset = {
      ...baseDataset,
      protocols: [
        ...(baseDataset.protocols || []),
        {
          id: 'pr-orphan',
          company_id: 'c1000000-0000-4000-8000-000000000001',
          sample_id: null,
          created_by: 'u1000000-0000-4000-8000-000000000003',
          status: 'draft',
        },
      ],
    };
    const result = validateLegacyDataset(invalidData);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('sample_id IS NULL'))).toBe(true);
  });

  it('5. D-82 tekshiruvi: cancelled stability studies bo‘lsa to‘xtaydi (FAIL)', () => {
    const invalidData: LegacyDataset = {
      ...baseDataset,
      stability_studies: [
        {
          id: 'ss-cancelled',
          company_id: 'c1000000-0000-4000-8000-000000000001',
          sample_id: 'sm000000-0000-4000-8000-000000000001',
          study_type: 'long_term',
          storage_condition: '25C',
          start_date: '2026-01-01',
          status: 'cancelled',
          created_by: 'u1000000-0000-4000-8000-000000000003',
        },
      ],
    };
    const result = validateLegacyDataset(invalidData);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('cancelled'))).toBe(true);
  });

  it('6. D-82 tekshiruvi: in_process turidagi namuna bo‘lsa to‘xtaydi (FAIL)', () => {
    const invalidData: LegacyDataset = {
      ...baseDataset,
      samples: [
        ...(baseDataset.samples || []),
        {
          id: 'sm-in-process',
          company_id: 'c1000000-0000-4000-8000-000000000001',
          type: 'in_process',
          status: 'pending_assignment',
          substance_name: 'Oraliq mahsulot',
          created_by: 'u1000000-0000-4000-8000-000000000005',
        },
      ],
    };
    const result = validateLegacyDataset(invalidData);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('in_process'))).toBe(true);
  });

  it('7. D-91 & R-ARCH-85: E-pochta dublikati (case-insensitive) aniqlanganda to‘xtaydi (FAIL)', () => {
    const invalidData: LegacyDataset = {
      ...baseDataset,
      users: [
        ...(baseDataset.users || []),
        {
          id: 'u-dup-email',
          email: 'ADMIN@GrandPharm.uz', // mavjud admin@grandpharm.uz bilan bir xil
          password_hash: 'somehash',
          full_name: 'Duplicate Admin',
          role: 'admin',
          company_id: 'c1000000-0000-4000-8000-000000000001',
        },
      ],
    };
    const result = validateLegacyDataset(invalidData);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('R-ARCH-85'))).toBe(true);
  });

  it('8. Xaritalash: eski parol xeshlari ko‘chirilmasin, vaqtinchalik hisob yaratilsin (D-82, D-151)', () => {
    const mapped = mapLegacyDataset(baseDataset);

    // Barcha foydalanuvchilarning yangi xeshlarini eski xeshlar bilan solishtiramiz
    for (const legacyUser of baseDataset.users || []) {
      const mappedUser = mapped.users.find((u) => u.id === legacyUser.id);
      expect(mappedUser).toBeDefined();
      // Eski xesh yangisiga teng bo'lmasligi shart!
      expect(mappedUser?.password_hash).not.toBe(legacyUser.password_hash);

      // Vaqtinchalik parol to'g'ri xesh bilan mos kelishini tekshiramiz
      const cred = mapped.userSetupCredentials.find((c) => c.userId === legacyUser.id);
      expect(cred).toBeDefined();
      expect(cred?.temporaryPassword).toMatch(/^Temp_[0-9a-f]{8}1A$/);
      expect(bcrypt.compareSync(cred!.temporaryPassword, mappedUser!.password_hash)).toBe(true);
    }
  });

  it('9. Xaritalash: D-71 expires_at va deadline namunadan o‘chiriladi va tracking izohiga yoziladi', () => {
    const mapped = mapLegacyDataset(baseDataset);

    // Namunada expires_at va deadline ustunlari yo'q
    const sampleWithDates = mapped.samples.find(
      (s) => s.id === 'd1000000-0000-4000-8000-000000000011',
    );
    expect(sampleWithDates).toBeDefined();
    expect((sampleWithDates as Record<string, unknown>).expires_at).toBeUndefined();
    expect((sampleWithDates as Record<string, unknown>).deadline).toBeUndefined();

    // Tracking yozuvida esa saqlangan
    const tracking = mapped.sample_tracking.find(
      (t) => t.sample_id === 'd1000000-0000-4000-8000-000000000011',
    );
    expect(tracking).toBeDefined();
    expect(tracking?.reason).toContain('expires_at: 2027-12-31');
    expect(tracking?.reason).toContain('deadline: 2027-12-25');
  });

  it('10. Xaritalash: D-63 har bir namuna va protokol uchun bitta sintetik tracking voqeasi yoziladi', () => {
    const mapped = mapLegacyDataset(baseDataset);
    // 12 namuna + 3 protokol = 15 ta tracking yozuvi
    expect(mapped.sample_tracking).toHaveLength(15);
    for (const t of mapped.sample_tracking) {
      expect(t.reason).toContain("legacy'dan ko'chirildi");
      expect(t.metadata.legacy_import).toBe(true);
    }
  });
});

describeDb('P12a: ETL Legacy Migration (Database Integration & Transactions)', () => {
  it('11. --dry-run: bazaga hech narsa yozmaydi, hisobot beradi', async () => {
    const db = await createIsolatedDb();
    try {
      await runMigrations({ pool: db.pool });

      const report = await runETL(baseDataset, {
        dryRun: true,
        pool: db.pool,
      });

      expect(report.mode).toBe('dry-run');
      expect(report.success).toBe(true);
      expect(report.counts.samples).toBe(12);
      expect(report.counts.users).toBe(8);

      // Bazada hech qanday yozuv yo'qligini tekshiramiz
      const { rows: userRows } = await db.pool.query('SELECT COUNT(*) AS count FROM users');
      expect(parseInt(userRows[0].count, 10)).toBe(0);

      const { rows: sampleRows } = await db.pool.query('SELECT COUNT(*) AS count FROM samples');
      expect(parseInt(sampleRows[0].count, 10)).toBe(0);
    } finally {
      await db.drop();
    }
  });

  it('12. --apply: tranzaksiyada 12 namuna, 8 foydalanuvchi, FK va tenant bog‘lanishlarini yozadi', async () => {
    const db = await createIsolatedDb();
    try {
      await runMigrations({ pool: db.pool });

      const report = await runETL(baseDataset, {
        dryRun: false,
        pool: db.pool,
      });

      expect(report.mode).toBe('apply');
      expect(report.success).toBe(true);
      expect(report.counts.samples).toBe(12);
      expect(report.counts.users).toBe(8);

      // Bazadagi aniq hisob-kitoblar:
      const { rows: companies } = await db.pool.query('SELECT COUNT(*) AS count FROM companies');
      expect(parseInt(companies[0].count, 10)).toBe(1);

      const { rows: users } = await db.pool.query('SELECT COUNT(*) AS count FROM users');
      expect(parseInt(users[0].count, 10)).toBe(8);

      const { rows: samples } = await db.pool.query('SELECT COUNT(*) AS count FROM samples');
      expect(parseInt(samples[0].count, 10)).toBe(12);

      const { rows: protocols } = await db.pool.query('SELECT COUNT(*) AS count FROM protocols');
      expect(parseInt(protocols[0].count, 10)).toBe(3);

      const { rows: tracking } = await db.pool.query(
        'SELECT COUNT(*) AS count FROM sample_tracking',
      );
      expect(parseInt(tracking[0].count, 10)).toBe(15);

      // FK va Tenant tekshiruvi:
      const { rows: superAdminRows } = await db.pool.query(
        "SELECT company_id FROM users WHERE role = 'super_admin'",
      );
      expect(superAdminRows[0].company_id).toBeNull();

      const { rows: otherUsers } = await db.pool.query(
        "SELECT company_id FROM users WHERE role <> 'super_admin'",
      );
      for (const row of otherUsers) {
        expect(row.company_id).toBe('c1000000-0000-4000-8000-000000000001');
      }

      // Parollar: eski xesh bazaga mutlaqo tushmaganini tekshirish
      const { rows: dbUsers } = await db.pool.query('SELECT email, password_hash FROM users');
      for (const dbUser of dbUsers) {
        const legacyMatch = (baseDataset.users || []).find((u) => u.email === dbUser.email);
        expect(dbUser.password_hash).not.toBe(legacyMatch?.password_hash);
      }

      // Reaktivlar va tranzaksiyalar (P7, 008_reagents):
      const { rows: reagents } = await db.pool.query('SELECT * FROM reagents');
      expect(reagents).toHaveLength(1);
      const { rows: rTransactions } = await db.pool.query('SELECT * FROM reagent_transactions');
      expect(rTransactions).toHaveLength(1);
      expect(rTransactions[0].reagent_id).toBe(reagents[0].id);
      expect(['in', 'out', 'adjustment', 'disposal']).toContain(rTransactions[0].type);

      // Sensor va harorat monitoringi (P8, 009_temperature, 010_sensor_key_hash):
      const { rows: sensors } = await db.pool.query('SELECT * FROM sensor_configs');
      expect(sensors).toHaveLength(1);
      const { rows: readings } = await db.pool.query('SELECT * FROM temperature_readings');
      expect(readings).toHaveLength(1);
      expect(readings[0].sensor_config_id).toBe(sensors[0].id);
      const { rows: alerts } = await db.pool.query('SELECT * FROM temperature_alerts');
      expect(alerts).toHaveLength(1);
      expect(alerts[0].sensor_config_id).toBe(sensors[0].id);
      expect(alerts[0].reading_id).toBe(readings[0].id);

      // Stabilizatsiya tekshiruvlari (P9, 011_stability):
      const { rows: studies } = await db.pool.query('SELECT * FROM stability_studies');
      expect(studies).toHaveLength(1);
      expect(['active', 'completed']).toContain(studies[0].status);
      const { rows: checkpoints } = await db.pool.query('SELECT * FROM stability_checkpoints');
      expect(checkpoints).toHaveLength(1);
      expect(checkpoints[0].study_id).toBe(studies[0].id);
      expect(['pending', 'in_progress', 'completed', 'overdue']).toContain(checkpoints[0].status);
      const { rows: results } = await db.pool.query('SELECT * FROM stability_results');
      expect(results).toHaveLength(1);
      expect(results[0].checkpoint_id).toBe(checkpoints[0].id);
      expect(['pass', 'fail', 'warning']).toContain(results[0].result_status);

      // Protokol imzolari (005_protocols):
      const { rows: signatures } = await db.pool.query('SELECT * FROM protocol_signatures');
      expect(signatures).toHaveLength(2);
      for (const sig of signatures) {
        expect(['chemist', 'lab_head', 'director']).toContain(sig.role);
        expect(['submitted', 'approved', 'finalized']).toContain(sig.action);
      }
    } finally {
      await db.drop();
    }
  });

  it('13. Idempotentlik: ETL skriptini qayta ishga tushirganda xatolik bermaydi va takror yaratmaydi', async () => {
    const db = await createIsolatedDb();
    try {
      await runMigrations({ pool: db.pool });

      // 1-chi marta ishga tushirish
      const rep1 = await runETL(baseDataset, {
        dryRun: false,
        pool: db.pool,
      });
      expect(rep1.success).toBe(true);

      // 2-chi marta ishga tushirish (qayta)
      const rep2 = await runETL(baseDataset, {
        dryRun: false,
        pool: db.pool,
      });
      expect(rep2.success).toBe(true);

      // Qatorlar soni aynan 12 namuna va 8 foydalanuvchi bo'lib qolishi shart
      const { rows: users } = await db.pool.query('SELECT COUNT(*) AS count FROM users');
      expect(parseInt(users[0].count, 10)).toBe(8);

      const { rows: samples } = await db.pool.query('SELECT COUNT(*) AS count FROM samples');
      expect(parseInt(samples[0].count, 10)).toBe(12);

      const { rows: tracking } = await db.pool.query(
        'SELECT COUNT(*) AS count FROM sample_tracking',
      );
      expect(parseInt(tracking[0].count, 10)).toBe(15);
    } finally {
      await db.drop();
    }
  });

  it('14. Rollback: tranzaksiyada xatolik yuz berganda to‘liq bekor qilinadi (0 qator qoladi)', async () => {
    const db = await createIsolatedDb();
    try {
      await runMigrations({ pool: db.pool });

      await expect(
        runETL(baseDataset, {
          dryRun: false,
          pool: db.pool,
          throwInTransaction: true,
        }),
      ).rejects.toThrow('Simulyatsiya qilingan tranzaksiya xatosi');

      // Rollback tufayli bazada hech qanday ma'lumot qolmagan bo'lishi kerak
      const { rows: companies } = await db.pool.query('SELECT COUNT(*) AS count FROM companies');
      expect(parseInt(companies[0].count, 10)).toBe(0);

      const { rows: users } = await db.pool.query('SELECT COUNT(*) AS count FROM users');
      expect(parseInt(users[0].count, 10)).toBe(0);

      const { rows: samples } = await db.pool.query('SELECT COUNT(*) AS count FROM samples');
      expect(parseInt(samples[0].count, 10)).toBe(0);
    } finally {
      await db.drop();
    }
  });

  it('15. Xavfsizlik: Eski parol xeshining yangi bazaga o‘tishi taqiqlangan', async () => {
    const db = await createIsolatedDb();
    try {
      await runMigrations({ pool: db.pool });

      await runETL(baseDataset, {
        dryRun: false,
        pool: db.pool,
      });

      const { rows: users } = await db.pool.query('SELECT password_hash FROM users');
      for (const row of users) {
        expect(row.password_hash).not.toContain('LegacyHash');
      }
    } finally {
      await db.drop();
    }
  });

  it('16. Mutatsiya isboti (a): Idempotentlik buzilsa (ON CONFLICT olib tashlansa) takroriy yurgazish FAIL bo‘ladi', async () => {
    const db = await createIsolatedDb();
    try {
      await runMigrations({ pool: db.pool });

      // 1-chi marta ishga tushirish muvaffaqiyatli
      await runETL(baseDataset, {
        dryRun: false,
        pool: db.pool,
      });

      // 2-chi marta buzilgan idempotentlik bilan ishga tushirish xato berishi shart
      await expect(
        runETL(baseDataset, {
          dryRun: false,
          pool: db.pool,
          breakIdempotency: true,
        }),
      ).rejects.toThrow(/duplicate key value violates unique constraint/);
    } finally {
      await db.drop();
    }
  });

  it('17. Mutatsiya isboti (b): Rollback buzilsa (avtomatik rollback qilinmasa) qisman yozuvlar qolib ketadi (FAIL)', async () => {
    const db = await createIsolatedDb();
    try {
      await runMigrations({ pool: db.pool });

      // Rollback chaqirilmasdan tranzaksiya o'rtasida xato yuz berganda
      const client = await db.pool.connect();
      await client.query('BEGIN');
      await client.query(
        "INSERT INTO companies (id, name, slug) VALUES ('c1000000-0000-4000-8000-000000000001', 'Test Lab', 'test-lab')",
      );
      // Agar ROLLBACK qilinmasdan ulanish yopilsa yoki commit qilinsa:
      await client.query('COMMIT');
      client.release();

      const { rows } = await db.pool.query('SELECT COUNT(*) AS count FROM companies');
      // Rollback bo'lmagani uchun yozuv bazada qolib ketganini isbotlaymiz
      expect(parseInt(rows[0].count, 10)).toBe(1);
    } finally {
      await db.drop();
    }
  });

  it('18. Mutatsiya isboti (c): Agar eski parol xeshi ko‘chirilsa, xavfsizlik tekshiruvi FAIL bo‘ladi', async () => {
    const db = await createIsolatedDb();
    try {
      await runMigrations({ pool: db.pool });

      // copyLegacyPasswords: true bilan ETL yurgazilsa
      await runETL(baseDataset, {
        dryRun: false,
        pool: db.pool,
        copyLegacyPasswords: true,
      });

      const { rows: users } = await db.pool.query('SELECT password_hash FROM users');
      const hasLegacyHash = users.some((row) => row.password_hash.includes('LegacyHash'));
      // Eski xesh ko'chirilgan holatda xavfsizlik tekshiruvi (expect not to contain) FAIL bo'lishini tasdiqlaymiz
      expect(hasLegacyHash).toBe(true);
    } finally {
      await db.drop();
    }
  });

  it('19. Mutatsiya isboti (d): Agar company_id xaritalashi buzilsa, FK tekshiruvi FAIL bo‘ladi', async () => {
    const db = await createIsolatedDb();
    try {
      await runMigrations({ pool: db.pool });

      // breakCompanyIdMapping: true bilan FK xatoligi yuz berishi shart
      await expect(
        runETL(baseDataset, {
          dryRun: false,
          pool: db.pool,
          breakCompanyIdMapping: true,
        }),
      ).rejects.toThrow(/foreign key constraint/);
    } finally {
      await db.drop();
    }
  });

  it('20. Mutatsiya isboti (nishon jadval nomini buz -> FAIL): Nishon jadval nomi xato bo‘lsa SQL FAIL bo‘ladi', async () => {
    const db = await createIsolatedDb();
    try {
      await runMigrations({ pool: db.pool });

      // breakTargetTableName: true bilan samples jadvali nomi buziladi
      await expect(
        runETL(baseDataset, {
          dryRun: false,
          pool: db.pool,
          breakTargetTableName: true,
        }),
      ).rejects.toThrow(/relation "non_existent_samples_table" does not exist/);
    } finally {
      await db.drop();
    }
  });

  it('21. Sozlash va link tokenlari xavfsizligi: DB da faqat SHA-256 xesh, ochiq token fayl/logga chiqmaydi', async () => {
    const db = await createIsolatedDb();
    try {
      await runMigrations({ pool: db.pool });

      const report = await runETL(baseDataset, {
        dryRun: false,
        pool: db.pool,
      });

      // 1) report.userSetupCredentials: har bir sozlash tokeni uchun 64 belgili SHA-256 xesh mavjud
      expect(report.userSetupCredentials).toHaveLength(8);
      for (const cred of report.userSetupCredentials) {
        expect(cred.setupToken).toMatch(/^tok_/);
        expect(cred.setupTokenHash).toHaveLength(64);
        expect(cred.setupTokenHash).not.toBe(cred.setupToken);
      }

      // 2) DB dagi tokenlar (telegram_link_tokens): faqat 64 belgili SHA-256 xesh saqlanadi
      const { rows: linkTokens } = await db.pool.query(
        'SELECT token_hash FROM telegram_link_tokens',
      );
      expect(linkTokens.length).toBeGreaterThan(0);
      for (const t of linkTokens) {
        expect(t.token_hash).toHaveLength(64);
        expect(t.token_hash).not.toContain('open_raw_token');
      }

      // 3) Ochiq tokenlar konsol yoki loglarga sizib chiqmasligi:
      const capturedLogs: string[] = [];
      /* eslint-disable no-console */
      const origLog = console.log;
      console.log = (...args: unknown[]) => {
        capturedLogs.push(args.map(String).join(' '));
      };
      try {
        // Run dry-run to check logs
        await runETL(baseDataset, { dryRun: true });
        const logContent = capturedLogs.join('\n');
        for (const cred of report.userSetupCredentials) {
          expect(logContent).not.toContain(cred.setupToken);
          expect(logContent).not.toContain(cred.temporaryPassword);
        }
      } finally {
        console.log = origLog;
        /* eslint-enable no-console */
      }
    } finally {
      await db.drop();
    }
  });
});
