/**
 * P19 RAG smoke-test — QO'LDA, CI ga KIRMAYDI (haqiqiy embedding API, pul sarflanadi).
 *
 *   npm run rag:smoke                                   # ko'p tilli o'xshashlik tekshiruvi (uz/ru/en)
 *   npm run rag:smoke -- --company <uuid> --q "savol"   # + shu kompaniya bazasida gibrid qidiruv (DATABASE_URL)
 *
 * Sozlamalar `backend/.env` dan: EMBEDDING_PROVIDER/EMBEDDING_API_KEY/EMBEDDING_MODEL/EMBEDDING_DIM. Kalit chiqarilmaydi.
 */
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { closePool, initDb } from '../backend/src/config/database.js';
import { embeddingFromEnv } from '../backend/src/modules/rag/rag.embedding.js';
import { retrieve } from '../backend/src/modules/rag/rag.retrieval.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const cos = (a: number[], b: number[]) => {
  let d = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    d += a[i]! * b[i]!;
    na += a[i]! ** 2;
    nb += b[i]! ** 2;
  }
  return d / Math.sqrt(na * nb);
};

async function main(): Promise<void> {
  loadDotenv({ path: resolve(process.cwd(), 'backend/.env'), quiet: true });
  const provider = embeddingFromEnv({
    EMBEDDING_PROVIDER: (process.env.EMBEDDING_PROVIDER as 'voyage' | 'mock' | 'none') ?? 'voyage',
    EMBEDDING_API_KEY: process.env.EMBEDDING_API_KEY,
    EMBEDDING_MODEL: process.env.EMBEDDING_MODEL,
    EMBEDDING_DIM: Number(process.env.EMBEDDING_DIM ?? 1024),
    EMBEDDING_API_URL: process.env.EMBEDDING_API_URL,
  });
  if (!provider) {
    console.error('Embedding sozlanmagan (EMBEDDING_API_KEY, EMBEDDING_MODEL, EMBEDDING_DIM=1024).');
    process.exit(2);
  }
  console.log(`Provayder: ${provider.name}, model: ${provider.model}, o'lcham: ${provider.dim}`);

  // Bir xil ma'no — uch til; va mavzudan tashqari jumla
  const docs = [
    'Sulfat kislota sarfi kuldagi sulfat tahlili uchun 2 ml',
    'Расход серной кислоты для определения сульфатной золы 2 мл',
    'Sulfuric acid consumption for sulfated ash test is 2 ml',
    'HPLC kolonka harorati 30 °C, oqim tezligi 1 ml/min',
  ];
  const t0 = Date.now();
  const vecs = await provider.embed(docs, 'document');
  const [q] = await provider.embed(['sulfated ash uchun qancha sulfat kislota kerak?'], 'query');
  console.log(`Embedding: ${Date.now() - t0} ms`);
  docs.forEach((d, i) => console.log(`  ${cos(q!, vecs[i]!).toFixed(3)}  ${d}`));
  console.log('Kutilgan: birinchi uchtasi (uz/ru/en) to‘rtinchisidan yuqori — o‘zbek tilini tekshirish uchun muhim.');

  const company = arg('company');
  const text = arg('q');
  if (company && text) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL kerak');
    initDb(url);
    try {
      const r = await retrieve(company, text, {}, provider);
      console.log(`Qidiruv rejimi: ${r.mode}; topildi: ${r.chunks.length}`);
      for (const c of r.chunks) {
        console.log(`  [${c.sourceType}] ${c.score} ${c.chunkText.split('\n')[0]!.slice(0, 100)}`);
      }
    } finally {
      await closePool();
    }
  }
}

void main();
