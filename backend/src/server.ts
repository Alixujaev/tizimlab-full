import { createApp } from './app.js';
import { closePool, initDb, pingDb } from './config/database.js';
import { loadEnv } from './config/env.js';
import { authConfigFromEnv } from './modules/auth/auth.types.js';
import { storageFromEnv } from './modules/files/files.storage.js';
import { createDiskFilesRouter, createDiskStorage } from './modules/files/files.disk.js';
import { aiClientFromEnv, aiRuntime } from './modules/ai/ai.config.js';
import { embeddingFromEnv } from './modules/rag/rag.embedding.js';
import { startRagWorker, stopRagWorker } from './modules/rag/rag.indexer.js';
import { closeSocketServer, createSocketServer } from './realtime/socket.js';
import { startStabilityScheduler, stopStabilityScheduler } from './modules/stability/stability.job.js';
import {
  startCalibrationScheduler,
  stopCalibrationScheduler,
} from './modules/equipment/equipment.job.js';
import {
  startReagentExpiryScheduler,
  stopReagentExpiryScheduler,
} from './modules/reagents/reagents.job.js';
import { setNotificationChannel } from './modules/notifications/notifications.service.js';
import {
  startTelegramBot,
  stopTelegramBot,
} from './modules/telegram/telegram.bot.js';
import { sendTelegramNotification } from './modules/telegram/telegram.service.js';
import { logger } from './utils/logger.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const env = loadEnv();
initDb(env.DATABASE_URL);

// D-198: E2E — disk xotirasi (faqat test; env.ts majburlaydi)
const diskDir = env.STORAGE_DRIVER === 'disk' ? env.STORAGE_DISK_DIR! : null;
const storage = diskDir ? createDiskStorage(diskDir, env.JWT_ACCESS_SECRET) : storageFromEnv(env);
if (!storage) logger.warn("R2 sozlanmagan: fayl endpointlari 503 qaytaradi (R2_* ni to'ldiring)");
const aiClient = aiClientFromEnv(env);
// P19 (D-190): kalit yo'q — null (faqat FTS)
const embedding = embeddingFromEnv(env);
if (!aiClient) logger.info('AI yordamchi o‘chiq (AI_ENABLED/ANTHROPIC_API_KEY/AI_MODEL) — qo‘lda kiritish ishlaydi');
const app = createApp({
  env,
  pingDb: () => pingDb(),
  storage,
  ai: {
    client: aiClient,
    maxFileMb: env.AI_MAX_FILE_MB,
    dailyLimit: env.AI_DAILY_LIMIT_PER_COMPANY,
    chatDailyLimit: env.OOS_CHAT_DAILY_LIMIT_PER_COMPANY,
  },
  embedding,
  testFilesRouter: diskDir ? createDiskFilesRouter(diskDir, env.JWT_ACCESS_SECRET) : null,
});
const server = app.listen(env.PORT, () => {
  logger.info(`Server ishga tushdi: http://localhost:${env.PORT} (${env.NODE_ENV})`);
  startStabilityScheduler();
  startReagentExpiryScheduler();
  startCalibrationScheduler();
  // P19 (D-191): RAG indekslash worker'i (DB navbati)
  startRagWorker({
    storage,
    embedding,
    ai: aiRuntime({
      client: aiClient,
      storage,
      maxFileMb: env.AI_MAX_FILE_MB,
      dailyLimit: env.AI_DAILY_LIMIT_PER_COMPANY,
    }),
  });
  startTelegramBot(env);
  setNotificationChannel('telegram', (userId, dto, companyId) => {
    void sendTelegramNotification(userId, dto, undefined, companyId);
  });
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
  stopReagentExpiryScheduler();
  stopCalibrationScheduler();
  stopRagWorker();
  stopTelegramBot();
  setNotificationChannel('telegram', null);
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
