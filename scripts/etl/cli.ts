import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { runETL } from './migrator.js';
import type { LegacyDataset } from './types.js';

interface CliArgs {
  mode: 'dry-run' | 'apply';
  filePath: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let mode: 'dry-run' | 'apply' = 'dry-run';
  let filePath = resolve(process.cwd(), 'scripts/etl/fixtures/legacy_production_synthetic.json');

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--apply') {
      mode = 'apply';
    } else if (arg === '--dry-run') {
      mode = 'dry-run';
    } else if (arg === '--file' && args[i + 1]) {
      filePath = resolve(process.cwd(), args[i + 1]!);
      i++;
    } else if (arg === '--help' || arg === '-h') {
        console.log(`
TizimLab Legacy ETL Skripti (P12a)

Qo'llanishi:
  tsx scripts/etl/cli.ts [options]

Variantlar:
  --dry-run     Baza o'zgartirilmaydi, faqat hisob-kitob va validatsiya (standart rejim)
  --apply       Ma'lumotlar tranzaksiyada yangi bazaga yoziladi (xatoda to'liq rollback)
  --file <path> Eski ma'lumotlar fayli yo'li (standart: scripts/etl/fixtures/legacy_production_synthetic.json)
  --help, -h    Yordam
      `);
      process.exit(0);
    }
  }

  return { mode, filePath };
}

async function main(): Promise<void> {
  const { mode, filePath } = parseArgs();

  console.log(`[ETL] Fayl o'qilmoqda: ${filePath}`);
  let rawContent: string;
  try {
    rawContent = readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.error(`[ETL] Faylni o'qishda xatolik: ${(err as Error).message}`);
    process.exit(1);
  }

  let dataset: LegacyDataset;
  try {
    dataset = JSON.parse(rawContent) as LegacyDataset;
  } catch (err) {
    console.error(`[ETL] JSON parse xatosi: ${(err as Error).message}`);
    process.exit(1);
  }

  console.log(`[ETL] Rejim: ${mode.toUpperCase()}`);

  let pool: pg.Pool | undefined;
  if (mode === 'apply') {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.error(
        "[ETL] Xatolik: --apply rejimi uchun DATABASE_URL muhit o'zgaruvchisi talab qilinadi.",
      );
      process.exit(1);
    }
    pool = new pg.Pool({ connectionString: databaseUrl });
  }

  try {
    const report = await runETL(dataset, {
      dryRun: mode === 'dry-run',
      pool,
    });

    console.log('\n=================== ETL HISOBOTI ===================');
    console.log(`Holat: ${report.success ? 'MUVAFFAQIYATLI' : 'XATOLIK'}`);
    console.log(`Rejim: ${report.mode}`);
    console.log('\n--- Jadvallar bo\'yicha ko\'chirilgan qatorlar soni ---');
    console.table(report.counts);

    if (report.warnings.length > 0) {
        console.log('\n--- Ogohlantirishlar ---');
      for (const w of report.warnings) {
            console.log(`⚠️  ${w}`);
      }
    }

    if (report.problematicRows.length > 0) {
        console.log('\n--- Maxsus ishlov berilgan qatorlar ---');
      console.table(report.problematicRows);
    }

    console.log('\n--- Foydalanuvchilar vaqtinchalik sozlash ma\'lumotlari ---');
    console.log(
      `Jami ${report.userSetupCredentials.length} ta foydalanuvchiga vaqtinchalik parol/token generatsiya qilindi (eski xeshlar ko'chirilmagan).`,
    );

    console.log('====================================================\n');
  } catch (error) {
    console.error(`\n[ETL] XATOLIK: ${(error as Error).message}`);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

main().catch((err) => {
  console.error('[ETL Fatal]', err);
  process.exit(1);
});
