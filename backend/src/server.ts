import { createApp } from './app.js';
import { closePool, initDb, pingDb } from './config/database.js';
import { loadEnv } from './config/env.js';
import { authConfigFromEnv } from './modules/auth/auth.types.js';
import { storageFromEnv } from './modules/files/files.storage.js';
import { closeSocketServer, createSocketServer } from './realtime/socket.js';
import { startStabilityScheduler, stopStabilityScheduler } from './modules/stability/stability.job.js';
import { logger } from './utils/logger.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const env = loadEnv();
initDb(env.DATABASE_URL);

const storage = storageFromEnv(env);
if (!storage) logger.warn("R2 sozlanmagan: fayl endpointlari 503 qaytaradi (R2_* ni to'ldiring)");
const app = createApp({ env, pingDb: () => pingDb(), storage });
const server = app.listen(env.PORT, () => {
  logger.info(`Server ishga tushdi: http://localhost:${env.PORT} (${env.NODE_ENV})`);
  startStabilityScheduler();
});
// Socket.IO — bir xil HTTP server ustida (spec §16)
const io = createSocketServer(server, {
  auth: authConfigFromEnv(env),
  corsOrigin: env.FRONTEND_URL,
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
  stopStabilityScheduler();
  void closeSocketServer(io);
  server.close(async () => {
    await closePool();
    logger.info("Server to'xtatildi");
    process.exit(0);
  });
  server.closeIdleConnections();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
