import { query } from '../../config/database.js';
import { toIsoDay } from '../../utils/dates.js';
import { logger } from '../../utils/logger.js';
import { type EmbeddingProvider, toVectorLiteral } from './rag.embedding.js';
import type { RagSourceType } from './rag.indexer.js';

/**
 * D-192: gibrid qidiruv — vektor (cosine, HNSW) + Postgres FTS ('simple'), Reciprocal Rank Fusion.
 * KRITIK: har so'rov `company_id = $1` bilan — boshqa kompaniya bo'laklari hech qachon qaytmaydi.
 * Vektor faqat joriy model+o'lchamdagi bo'laklar bilan solishtiriladi; provayder yo'q yoki xato — `fts_only`.
 */

export interface RetrievalFilters {
  substanceName?: string | null;
  ndId?: string | null;
  equipmentId?: string | null;
  sourceTypes?: RagSourceType[];
  /** Joriy holatning o'zi (masalan ochiq OOS) natijaga kirmasin */
  excludeSourceIds?: string[];
}

export interface RetrievedChunk {
  chunkId: string;
  sourceType: RagSourceType;
  sourceId: string;
  chunkText: string;
  substanceName: string | null;
  series: string | null;
  docDate: string | null;
  equipmentId: string | null;
  ndId: string | null;
  metadata: Record<string, unknown>;
  score: number;
}

export interface RetrievalResult {
  mode: 'hybrid' | 'fts_only';
  chunks: RetrievedChunk[];
}

export const RETRIEVAL_LIMIT = 8;
const CANDIDATES = 30;
const RRF_K = 60;

interface ChunkRow {
  id: string;
  source_type: RagSourceType;
  source_id: string;
  chunk_text: string;
  substance_name: string | null;
  series: string | null;
  doc_date: Date | null;
  equipment_id: string | null;
  nd_id: string | null;
  metadata: Record<string, unknown>;
}

/** FTS so'rovi: so'zlar OR bilan ('simple' — til-agnostik; o'zbek/rus/ingliz aralash matn). */
export function toOrTsQuery(text: string): string | null {
  const tokens = [
    ...new Set(
      text
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((t) => t.length >= 2)
        .slice(0, 30),
    ),
  ];
  return tokens.length ? tokens.map((t) => `'${t.replace(/'/g, "''")}'`).join(' | ') : null;
}

function filterSql(f: RetrievalFilters, params: unknown[]): string {
  const where: string[] = [];
  const add = (sql: (i: number) => string, v: unknown) => {
    params.push(v);
    where.push(sql(params.length));
  };
  if (f.substanceName) add((i) => `lower(c.substance_name) = lower($${i})`, f.substanceName.trim());
  if (f.ndId) add((i) => `c.nd_id = $${i}`, f.ndId);
  if (f.equipmentId) add((i) => `c.equipment_id = $${i}`, f.equipmentId);
  if (f.sourceTypes?.length) add((i) => `c.source_type = ANY($${i})`, f.sourceTypes);
  if (f.excludeSourceIds?.length) add((i) => `NOT (c.source_id = ANY($${i}))`, f.excludeSourceIds);
  return where.length ? ` AND ${where.join(' AND ')}` : '';
}

const SELECT = `c.id, c.source_type, c.source_id, c.chunk_text, c.substance_name, c.series, c.doc_date,
  c.equipment_id, c.nd_id, c.metadata`;

export async function retrieve(
  companyId: string,
  text: string,
  filters: RetrievalFilters,
  embedding: EmbeddingProvider | null,
  limit = RETRIEVAL_LIMIT,
): Promise<RetrievalResult> {
  const ranked = new Map<string, { row: ChunkRow; score: number }>();
  const bump = (rows: ChunkRow[]) =>
    rows.forEach((row, rank) => {
      const prev = ranked.get(row.id);
      ranked.set(row.id, { row, score: (prev?.score ?? 0) + 1 / (RRF_K + rank + 1) });
    });

  let mode: RetrievalResult['mode'] = 'fts_only';
  if (embedding) {
    try {
      const [vec] = await embedding.embed([text], 'query');
      const params: unknown[] = [companyId, toVectorLiteral(vec!), embedding.model, embedding.dim];
      const extra = filterSql(filters, params);
      params.push(CANDIDATES);
      const { rows } = await query<ChunkRow>(
        `SELECT ${SELECT} FROM doc_chunks c
          WHERE c.company_id = $1 AND c.embedding IS NOT NULL
            AND c.embedding_model = $3 AND c.embedding_dim = $4${extra}
          ORDER BY c.embedding OPERATOR(public.<=>) $2::public.vector
          LIMIT $${params.length}`,
        params,
      );
      bump(rows);
      mode = 'hybrid';
    } catch (err) {
      logger.warn('Vektor qidiruv ishlamadi — faqat matn qidiruv', {
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  const tsq = toOrTsQuery(text);
  if (tsq) {
    const params: unknown[] = [companyId, tsq];
    const extra = filterSql(filters, params);
    params.push(CANDIDATES);
    const { rows } = await query<ChunkRow>(
      `SELECT ${SELECT} FROM doc_chunks c
        WHERE c.company_id = $1 AND c.tsv @@ to_tsquery('simple', $2)${extra}
        ORDER BY ts_rank(c.tsv, to_tsquery('simple', $2)) DESC, c.created_at DESC
        LIMIT $${params.length}`,
      params,
    );
    bump(rows);
  }

  const chunks = [...ranked.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row, score }) => ({
      chunkId: row.id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      chunkText: row.chunk_text,
      substanceName: row.substance_name,
      series: row.series,
      docDate: toIsoDay(row.doc_date),
      equipmentId: row.equipment_id,
      ndId: row.nd_id,
      metadata: row.metadata ?? {},
      score: Math.round(score * 10_000) / 10_000,
    }));
  return { mode, chunks };
}
