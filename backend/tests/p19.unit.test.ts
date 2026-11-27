import { Document, Packer, Paragraph } from 'docx';
import { describe, expect, it, vi } from 'vitest';
import { chatAnswerSchema, type ChatAnswer } from '../src/modules/oos/oos.schemas.js';
import { CHAT_SYSTEM_PROMPT, sanitizeAnswer } from '../src/modules/oos/oos.chat.js';
import { comparePeaks, PEAK_THRESHOLDS, stats, type PeakPoint } from '../src/modules/peaks/peaks.compare.js';
import {
  createMockEmbeddingProvider,
  createVoyageProvider,
  embeddingFromEnv,
  EMBEDDING_COLUMN_DIM,
} from '../src/modules/rag/rag.embedding.js';
import { toOrTsQuery } from '../src/modules/rag/rag.retrieval.js';
import { chunkText, CHUNK_SIZE, extractDocumentText, MAX_CHUNKS_PER_SOURCE } from '../src/modules/rag/rag.text.js';
import { textPdf } from './helpers/pdf.js';

/** P19 (D-190..D-196) — sof qismlar: peak solishtirish, matn va bo'laklash, embedding, FTS, javob tozalash. */

const pk = (rt: number, over: Partial<PeakPoint> = {}): PeakPoint => ({
  name: null,
  rt,
  area: null,
  areaPercent: null,
  tailing: null,
  plates: null,
  resolution: null,
  ...over,
});
const run = (id: string, peaks: PeakPoint[]) => ({ protocolId: `p-${id}`, peakFileId: id, date: null, peaks });

describe('peak solishtirish (deterministik, D-193)', () => {
  it('statistika: o‘rtacha, SD, RSD, og‘ish', () => {
    expect(stats(11, [10, 10, 10])).toMatchObject({ n: 3, mean: 10, sd: 0, rsdPct: 0, deviationPct: 10 });
    const s = stats(5, [4, 6]);
    expect(s).toMatchObject({ mean: 5, deviationPct: 0 });
    expect(s.sd).toBeCloseTo(1.4142, 3);
    expect(s.rsdPct).toBeCloseTo(28.284, 2);
    expect(stats(5, [5])).toMatchObject({ n: 1, sd: null, rsdPct: null, deviationPct: 0 });
    expect(stats(null, [])).toMatchObject({ n: 0, mean: null });
  });

  it('joriy peak yo‘q → no_current; tarix yo‘q → no_history (faqat mutlaq chegaralar)', () => {
    expect(comparePeaks([], [run('a', [pk(5)])]).status).toBe('no_current');
    const res = comparePeaks([pk(5, { tailing: 2.4, resolution: 1.2 })], []);
    expect(res).toMatchObject({ status: 'no_history', historyRuns: 0, singleRun: false });
    expect(res.peaks[0]!.flags.sort()).toEqual(['low_resolution', 'tailing_high']);
  });

  it('bitta tarixiy yugurish → singleRun, RSD null', () => {
    const res = comparePeaks([pk(5.0, { name: 'API', areaPercent: 99 })], [run('a', [pk(5.0, { name: 'API', areaPercent: 99 })])]);
    expect(res).toMatchObject({ status: 'compared', singleRun: true, historyRuns: 1 });
    expect(res.peaks[0]!.rtStats.rsdPct).toBeNull();
    expect(res.peaks[0]!.flags).toEqual([]);
  });

  it('chegara qiymatlari: RT siljishi aynan 2% — belgi yo‘q, 2% dan oshsa — rt_shift', () => {
    const hist = [run('a', [pk(10)]), run('b', [pk(10)])];
    expect(comparePeaks([pk(10.2)], hist).peaks[0]!.flags).toEqual([]);
    expect(comparePeaks([pk(10.21)], hist).peaks[0]!.flags).toEqual(['rt_shift']);
  });

  it('yuza og‘ishi (%area asosida, bo‘lmasa absolyut), tailing, N, Rs', () => {
    const hist = [
      run('a', [pk(5, { areaPercent: 50, tailing: 1.0, plates: 10000 })]),
      run('b', [pk(5, { areaPercent: 50, tailing: 1.0, plates: 10000 })]),
    ];
    const res = comparePeaks([pk(5, { areaPercent: 56, tailing: 1.3, plates: 7000, resolution: 1.4 })], hist);
    const row = res.peaks[0]!;
    expect(row.areaStats).toMatchObject({ basis: 'area_percent', deviationPct: 12, mean: 50 });
    expect(row.flags.sort()).toEqual(['area_deviation', 'low_resolution', 'plates_drop', 'tailing_change']);
    const abs = comparePeaks([pk(5, { area: 1100 })], [run('a', [pk(5, { area: 1000 })])]).peaks[0]!;
    expect(abs.areaStats).toMatchObject({ basis: 'area', deviationPct: 10 });
    expect(abs.flags).toEqual([]); // aynan 10% — chegarada
  });

  it('yangi va yo‘qolgan peaklar (nom va RT bo‘yicha); presence ulushi', () => {
    const hist = [
      run('a', [pk(2.1, { name: 'Imp A' }), pk(5)]),
      run('b', [pk(2.12, { name: 'Imp A' }), pk(5.02)]),
      run('c', [pk(5.01), pk(8.0)]), // 8.0 — faqat 1/3 yugurishda
    ];
    const res = comparePeaks([pk(5), pk(6.5)], hist);
    expect(res.peaks.find((p) => p.rt === 6.5)!.flags).toContain('new_peak');
    expect(res.peaks.find((p) => p.rt === 5)!.matchedRuns).toBe(3);
    expect(res.missingPeaks).toEqual([{ name: 'Imp A', meanRt: 2.11, presentInRuns: 2 }]);
    expect(res.flags).toContain('new_peak');
  });

  it('nom mos kelsa RT oynasidan tashqarida ham moslashadi; boshqa nomli peak RT yaqin bo‘lsa ham moslashmaydi', () => {
    const hist = [run('a', [pk(5, { name: 'API' }), pk(5.05, { name: 'Imp B' })])];
    const res = comparePeaks([pk(5.5, { name: 'api' })], hist);
    expect(res.peaks[0]!.matchedRuns).toBe(1);
    expect(res.peaks[0]!.flags).toContain('rt_shift');
    expect(res.missingPeaks.map((m) => m.name)).toEqual(['Imp B']);
  });

  it('chegaralar hujjatlangan qiymatlarda', () => {
    expect(PEAK_THRESHOLDS).toMatchObject({ rtShiftPct: 2, areaDevPct: 10, tailingMax: 2, resolutionMin: 1.5 });
  });
});

describe('matn olish va bo‘laklash (D-191)', () => {
  it('PDF matn qatlami o‘qiladi; matnsiz PDF → null (OCR ga)', async () => {
    const text = await extractDocumentText(textPdf('Ibuprofen assay 99.2 percent within specification limits'), 'pdf');
    expect(text).toContain('Ibuprofen assay 99.2');
    expect(await extractDocumentText(textPdf(''), 'pdf')).toBeNull();
    expect(await extractDocumentText(Buffer.from('%PDF-1.7 broken'), 'pdf')).toBeNull();
  });
  it('DOCX matni (mammoth); rasm → null', async () => {
    const doc = new Document({ sections: [{ children: [new Paragraph('Peak jadvali: RT 5.01, yuza 1200')] }] });
    const buf = Buffer.from(await Packer.toBuffer(doc));
    expect(await extractDocumentText(buf, 'docx')).toContain('RT 5.01');
    expect(await extractDocumentText(Buffer.alloc(10), 'jpeg')).toBeNull();
  });
  it('bo‘laklar: sarlavha har bo‘lakda, hajm chegarasi, ustma-ustlik, limit', () => {
    const body = Array.from({ length: 60 }, (_, i) => `Gap ${i}. ${'x'.repeat(80)}`).join(' ');
    const chunks = chunkText(body, '[Protokol] Ibuprofen');
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.every((c) => c.startsWith('[Protokol] Ibuprofen\n'))).toBe(true);
    expect(chunks.every((c) => c.length <= CHUNK_SIZE + 40)).toBe(true);
    expect(chunkText('', 'H')).toEqual(['H']);
    expect(chunkText('', '')).toEqual([]);
    expect(chunkText('a'.repeat(CHUNK_SIZE * (MAX_CHUNKS_PER_SOURCE + 20)), '')).toHaveLength(MAX_CHUNKS_PER_SOURCE);
  });
});

describe('embedding (D-190)', () => {
  it('mock: deterministik, normallashtirilgan, o‘xshash matn yaqinroq', async () => {
    const m = createMockEmbeddingProvider();
    const [a, b, c] = await m.embed(['sulfat kislota titrlash', 'sulfat kislota titrlash', 'HPLC kolonka harorati'], 'document');
    expect(a).toEqual(b);
    expect(a).toHaveLength(EMBEDDING_COLUMN_DIM);
    const dot = (x: number[], y: number[]) => x.reduce((s, v, i) => s + v * y[i]!, 0);
    expect(dot(a!, a!)).toBeCloseTo(1, 5);
    const [q] = await m.embed(['sulfat kislota'], 'query');
    expect(dot(q!, a!)).toBeGreaterThan(dot(q!, c!));
  });

  it('Voyage: so‘rov shakli (model, input_type, output_dimension), tartib index bo‘yicha', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init!.body)) as { input: string[] };
      return new Response(
        JSON.stringify({
          data: body.input.map((_, i) => ({ embedding: new Array(4).fill(i), index: i })).reverse(),
        }),
        { status: 200 },
      );
    });
    const p = createVoyageProvider({ apiKey: 'k', model: 'voyage-4', dim: 4, fetchImpl: fetchImpl as unknown as typeof fetch });
    const out = await p.embed(['a', 'b'], 'query');
    expect(out).toEqual([[0, 0, 0, 0], [1, 1, 1, 1]]);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.voyageai.com/v1/embeddings');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer k');
    expect(JSON.parse(String(init!.body))).toMatchObject({ model: 'voyage-4', input_type: 'query', output_dimension: 4 });
  });

  it('Voyage: HTTP xato va noto‘g‘ri o‘lcham — EmbeddingError', async () => {
    const bad = createVoyageProvider({ apiKey: 'k', model: 'm', dim: 4, fetchImpl: (async () => new Response('x', { status: 500 })) as unknown as typeof fetch });
    await expect(bad.embed(['a'], 'document')).rejects.toMatchObject({ code: 'EMBEDDING_HTTP', httpStatus: 500 });
    const wrong = createVoyageProvider({
      apiKey: 'k',
      model: 'm',
      dim: 4,
      fetchImpl: (async () => new Response(JSON.stringify({ data: [{ embedding: [1, 2], index: 0 }] }))) as unknown as typeof fetch,
    });
    await expect(wrong.embed(['a'], 'document')).rejects.toMatchObject({ code: 'EMBEDDING_BAD_RESPONSE' });
  });

  it('env: kalit/model yo‘q yoki o‘lcham mos emas → null (FTS); mock/voyage', () => {
    const base = { EMBEDDING_PROVIDER: 'voyage' as const, EMBEDDING_DIM: 1024 };
    expect(embeddingFromEnv(base)).toBeNull();
    expect(embeddingFromEnv({ ...base, EMBEDDING_API_KEY: 'k' })).toBeNull();
    expect(embeddingFromEnv({ ...base, EMBEDDING_API_KEY: 'k', EMBEDDING_MODEL: 'voyage-4', EMBEDDING_DIM: 512 })).toBeNull();
    expect(embeddingFromEnv({ ...base, EMBEDDING_PROVIDER: 'none', EMBEDDING_API_KEY: 'k', EMBEDDING_MODEL: 'm' })).toBeNull();
    expect(embeddingFromEnv({ ...base, EMBEDDING_API_KEY: 'k', EMBEDDING_MODEL: 'voyage-4' })?.model).toBe('voyage-4');
    expect(embeddingFromEnv({ ...base, EMBEDDING_PROVIDER: 'mock' })?.name).toBe('mock');
  });
});

describe('FTS so‘rovi va javob tozalash (D-192, D-195)', () => {
  it('toOrTsQuery: so‘zlar OR, tirnoq qochiriladi, bo‘sh — null', () => {
    // Apostrof Postgres 'simple' parseri kabi bo'linadi (indeks bilan izchil)
    expect(toOrTsQuery("Sulfat kislota: RT o'zgardi")).toBe("'sulfat' | 'kislota' | 'rt' | 'zgardi'");
    expect(toOrTsQuery('a ! ?')).toBeNull();
    expect(toOrTsQuery('Ибупрофен анализ')).toBe("'ибупрофен' | 'анализ'");
  });

  const answer = (over: Partial<ChatAnswer> = {}): ChatAnswer => ({
    internal_findings: [
      { source_ref: 'S1', summary: 'Avval shunday holat bo‘lgan' },
      { source_ref: 'S9', summary: 'To‘qilgan manba' },
    ],
    peak_assessment: null,
    probable_causes: [
      { cause: 'Kolonka eskirgan', basis: 'internal', source_refs: ['S1'] },
      { cause: 'To‘qilgan', basis: 'internal', source_refs: ['S7'] },
    ],
    recommended_checks: ['Tizim muvofiqligi'],
    general_knowledge: ['USP <621>'],
    ...over,
  });

  it('berilmagan manba havolalari tashlanadi; asoslanmagan "internal" → "general"', () => {
    const s = sanitizeAnswer(answer(), new Set(['S1', 'S2']));
    expect(s.internal_findings.map((f) => f.source_ref)).toEqual(['S1']);
    expect(s.probable_causes[1]).toMatchObject({ basis: 'general', source_refs: [] });
    expect(s.internalFound).toBe(true);
  });

  it('manbasiz javob — internalFound=false ("topilmadi")', () => {
    const s = sanitizeAnswer(answer(), new Set());
    expect(s.internal_findings).toEqual([]);
    expect(s.internalFound).toBe(false);
  });

  it('javob sxemasi qat’iy: hukm maydoni (verdict) yoki ortiqcha maydon rad etiladi', () => {
    expect(chatAnswerSchema.safeParse(answer()).success).toBe(true);
    expect(chatAnswerSchema.safeParse({ ...answer(), verdict: 'OOS invalid' }).success).toBe(false);
    expect(chatAnswerSchema.safeParse({ ...answer(), close_case: true }).success).toBe(false);
  });

  it('system prompt: manbalar ma’lumot, qaror yo‘q, to‘qimaslik', () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/UNTRUSTED DATA/);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/NEVER decide/);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/Never invent a source_ref/);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/NOT from the internal/);
  });
});
