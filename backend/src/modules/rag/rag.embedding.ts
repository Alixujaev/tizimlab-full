import { createHash } from 'node:crypto';
import { logger } from '../../utils/logger.js';

/**
 * D-190: embedding abstraksiyasi. Anthropic o'z embedding modelini bermaydi (rasmiy hujjat) — standart
 * provayder Voyage AI (`POST /v1/embeddings`, `input_type` = document | query). Kalit yo'q yoki o'lcham
 * ustun o'lchamiga (1024) mos emas — vektor qidiruv o'chadi, Postgres FTS ('simple') fallback ishlaydi.
 * Model nomi va o'lchami har bo'lakda saqlanadi: model almashsa eski bo'laklar so'rovda ishlatilmaydi,
 * `npm run rag:reindex -w backend` bilan qayta indekslanadi.
 */

/** doc_chunks.embedding ustuni o'lchami (028_rag.sql). Boshqasi uchun yangi migratsiya kerak. */
export const EMBEDDING_COLUMN_DIM = 1024;

export type EmbeddingInputType = 'document' | 'query';

export interface EmbeddingProvider {
  readonly name: string;
  readonly model: string;
  readonly dim: number;
  embed(texts: string[], inputType: EmbeddingInputType): Promise<number[][]>;
}

export class EmbeddingError extends Error {
  constructor(
    public readonly code: 'EMBEDDING_HTTP' | 'EMBEDDING_TIMEOUT' | 'EMBEDDING_BAD_RESPONSE',
    public readonly httpStatus?: number,
  ) {
    super(code);
    this.name = 'EmbeddingError';
  }
}

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
/** Voyage: bir so'rovda ≤1000 matn; token limiti modelga bog'liq — xavfsiz partiya. */
const VOYAGE_BATCH = 64;

export function createVoyageProvider(opts: {
  apiKey: string;
  model: string;
  dim: number;
  /** MongoDB Atlas kalitlari uchun boshqa manzil (rasmiy hujjat). */
  url?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): EmbeddingProvider {
  const doFetch = opts.fetchImpl ?? fetch;
  const url = opts.url ?? VOYAGE_URL;
  return {
    name: 'voyage',
    model: opts.model,
    dim: opts.dim,
    async embed(texts, inputType) {
      const out: number[][] = [];
      for (let i = 0; i < texts.length; i += VOYAGE_BATCH) {
        const batch = texts.slice(i, i + VOYAGE_BATCH);
        let res: Response;
        try {
          res = await doFetch(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: batch,
              model: opts.model,
              input_type: inputType,
              output_dimension: opts.dim,
              truncation: true,
            }),
            signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
          });
        } catch (err) {
          throw new EmbeddingError(
            err instanceof Error && err.name === 'TimeoutError' ? 'EMBEDDING_TIMEOUT' : 'EMBEDDING_HTTP',
          );
        }
        if (!res.ok) throw new EmbeddingError('EMBEDDING_HTTP', res.status);
        const body = (await res.json()) as { data?: { embedding: number[]; index: number }[] };
        const data = body.data;
        if (!Array.isArray(data) || data.length !== batch.length) {
          throw new EmbeddingError('EMBEDDING_BAD_RESPONSE');
        }
        for (const d of [...data].sort((a, b) => a.index - b.index)) {
          if (!Array.isArray(d.embedding) || d.embedding.length !== opts.dim) {
            throw new EmbeddingError('EMBEDDING_BAD_RESPONSE');
          }
          out.push(d.embedding);
        }
      }
      return out;
    },
  };
}

/** Testlar uchun deterministik provayder: so'zlar xeshlangan "bag of words" vektori (normallashtirilgan). */
export function createMockEmbeddingProvider(dim = EMBEDDING_COLUMN_DIM, model = 'mock-embed'): EmbeddingProvider {
  return {
    name: 'mock',
    model,
    dim,
    async embed(texts) {
      return texts.map((t) => {
        const v = new Array<number>(dim).fill(0);
        for (const tok of t.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((x) => x.length > 1)) {
          const h = createHash('sha256').update(tok).digest();
          v[h.readUInt32BE(0) % dim]! += 1;
        }
        const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
        return v.map((x) => x / norm);
      });
    },
  };
}

export interface EmbeddingEnv {
  EMBEDDING_PROVIDER: 'voyage' | 'mock' | 'none';
  EMBEDDING_API_KEY?: string;
  EMBEDDING_MODEL?: string;
  EMBEDDING_DIM: number;
  EMBEDDING_API_URL?: string;
}

/** Provayder yoki `null` (vektor qidiruv o'chiq → FTS). O'lcham ustunga mos bo'lmasa ham `null`. */
export function embeddingFromEnv(env: EmbeddingEnv): EmbeddingProvider | null {
  if (env.EMBEDDING_PROVIDER === 'none') return null;
  if (env.EMBEDDING_DIM !== EMBEDDING_COLUMN_DIM) {
    logger.warn(
      `EMBEDDING_DIM=${env.EMBEDDING_DIM} doc_chunks ustuni (${EMBEDDING_COLUMN_DIM}) bilan mos emas — faqat matn qidiruv`,
    );
    return null;
  }
  if (env.EMBEDDING_PROVIDER === 'mock') return createMockEmbeddingProvider(env.EMBEDDING_DIM);
  if (!env.EMBEDDING_API_KEY || !env.EMBEDDING_MODEL) {
    logger.info('EMBEDDING_API_KEY yoki EMBEDDING_MODEL yo‘q — vektor qidiruv o‘chiq, faqat matn qidiruv (FTS)');
    return null;
  }
  return createVoyageProvider({
    apiKey: env.EMBEDDING_API_KEY,
    model: env.EMBEDDING_MODEL,
    dim: env.EMBEDDING_DIM,
    url: env.EMBEDDING_API_URL,
  });
}

/** pgvector literal: '[0.1,0.2,...]' — parametr sifatida uzatiladi (SQL interpolatsiya yo'q). */
export const toVectorLiteral = (v: number[]): string => `[${v.map((x) => (Number.isFinite(x) ? x : 0)).join(',')}]`;
