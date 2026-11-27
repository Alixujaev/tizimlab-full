/* eslint-disable no-console -- CLI chiqishi */
// Foydalanish (D-191): `npm run rag:reindex -w backend [-- --company <uuid>] [--enqueue-only]`
// Backfill va qayta indekslash (masalan embedding modeli almashganda): barcha TASDIQLANGAN manbalar
// navbatga qo'yiladi va (agar --enqueue-only bo'lmasa) navbat bo'shaguncha shu jarayonda bajariladi.
import { pathToFileURL } from 'node:url';
import { closePool, initDb } from '../config/database.js';
import { loadEnv } from '../config/env.js';
import { aiClientFromEnv, aiRuntime } from '../modules/ai/ai.config.js';
import { storageFromEnv } from '../modules/files/files.storage.js';
import { embeddingFromEnv } from '../modules/rag/rag.embedding.js';
import { enqueueAllApproved, processPendingJobs } from '../modules/rag/rag.indexer.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const env = loadEnv();
  initDb(env.DATABASE_URL);
  const storage = storageFromEnv(env);
  const embedding = embeddingFromEnv(env);
  const deps = {
    storage,
    embedding,
    ai: aiRuntime({
      client: aiClientFromEnv(env),
      storage,
      maxFileMb: env.AI_MAX_FILE_MB,
      dailyLimit: env.AI_DAILY_LIMIT_PER_COMPANY,
    }),
  };
  const company = arg('company') ?? null;
  try {
    const queued = await enqueueAllApproved(company);
    console.log(`Navbatga qo'yildi: ${queued} (qidiruv: ${embedding ? `vektor ${embedding.model}` : 'faqat FTS'})`);
    if (process.argv.includes('--enqueue-only')) return;
    let total = 0;
    for (;;) {
      const n = await processPendingJobs(deps, 20);
      total += n;
      if (!n) break;
      console.log(`... bajarildi: ${total}`);
    }
    console.log(`Tayyor. Bajarilgan joblar: ${total}. Xatolar: GET /api/v1/rag/status`);
  } finally {
    await closePool();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
