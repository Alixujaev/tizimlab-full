import { createApp } from './app.js';
import { closePool, initDb, pingDb } from './config/database.js';
import { loadEnv } from './config/env.js';
import { logger } from './utils/logger.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const env = loadEnv();
initDb(env.DATABASE_URL);

const app = createApp({ env, pingDb: () => pingDb() });
const server = app.listen(env.PORT, () => {
  logger.info(`Server ishga tushdi: http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} qabul qilindi, server to'xtatilmoqda`);
  const timer = setTimeout(() => {
    logger.error("Graceful shutdown vaqti tugadi, majburan to'xtatilmoqda");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  timer.unref();
  server.close(async () => {
    await closePool();
    logger.info("Server to'xtatildi");
    process.exit(0);
  });
  server.closeIdleConnections();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
