// Foydalanish: `npm run migrate` (up) yoki `npm run migrate:status`.
import { loadEnv } from '../config/env.js';
import { closePool, initDb } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { MigrationError, migrationStatus, runMigrations } from './migrator.js';

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'up';
  const env = loadEnv();
  const pool = initDb(env.DATABASE_URL);
  try {
    if (command === 'up') {
      const applied = await runMigrations({ pool, logger });
      logger.info(
        applied.length ? `${applied.length} ta migratsiya qo'llandi` : "Yangi migratsiya yo'q",
      );
    } else if (command === 'status') {
      const rows = await migrationStatus({ pool });
      if (!rows.length) logger.info("Migratsiya fayllari yo'q");
      for (const r of rows) {
        logger.info(`${String(r.version).padStart(3, '0')}_${r.name}: ${r.state}`);
      }
    } else {
      throw new Error(`Noma'lum buyruq: ${command} (up | status)`);
    }
  } finally {
    await closePool();
  }
}

main().catch((err: unknown) => {
  logger.error(err instanceof MigrationError ? err.message : 'Migratsiya xatosi', {
    error: err instanceof MigrationError ? undefined : err,
  });
  process.exitCode = 1;
});
