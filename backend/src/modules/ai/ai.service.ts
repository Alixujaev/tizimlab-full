import type pg from 'pg';
import { query, withTransaction } from '../../config/database.js';
import { AppError, NotFoundError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { normalizeUnit } from '../../utils/units.js';
import { ANALYTICS_TZ } from '../analytics/analytics.period.js';
import { writeAudit } from '../audit/audit.service.js';
import { buildKey } from '../files/files.service.js';
import { requireStorage, type FileStorage } from '../files/files.storage.js';
import type { IncomingFile } from '../files/files.validation.js';
import { AiUpstreamError, type AiClient, type AiContentPart } from './ai.client.js';
import { AI_MAX_PDF_PAGES, assertAiFile, type AiValidatedFile } from './ai.files.js';
import {
  lowerIfInvalid,
  normalizeAiUnit,
  normalizeDate,
  normalizeNumber,
  normalizeText,
  type Confidence,
} from './ai.normalize.js';
import {
  DOCUMENT_INSTRUCTION,
  DOCUMENT_SYSTEM_PROMPT,
  ND_INSTRUCTION,
  ND_SYSTEM_PROMPT,
} from './ai.prompts.js';
import {
  DOCUMENT_JSON_SCHEMA,
  documentResultSchema,
  ND_JSON_SCHEMA,
  ndResultSchema,
  type DocumentResult,
  type ImageQuality,
  type NdResult,
} from './ai.schemas.js';

/**
 * D-179..D-182: AI yordamchi qatlami. AI hech narsani o'zi saqlamaydi/tasdiqlamaydi:
 * - namuna/reaktiv ekstraksiyasi faqat formaga TAKLIF qaytaradi (DB'da faqat `ai_extractions` jurnali);
 * - ND ekstraksiyasi talablarni faqat QORALAMA (draft) ND ga `source='ai'` bilan qo'shadi — tasdiqlash insonda;
 * - AI ishlamasa (xato, timeout, past sifat) javob 200 + `status`/`errorCode` — forma bloklanmaydi, 5xx yo'q.
 */

export type ExtractionKind = 'sample' | 'reagent' | 'nd' | 'ocr' | 'peaks';
export type ExtractionStatus = 'ok' | 'failed' | 'rejected';

export interface AiRuntime {
  client: AiClient | null;
  storage: FileStorage | null;
  maxFileBytes: number;
  dailyLimit: number;
}

export interface AiActor {
  userId: string;
  companyId: string;
  ip?: string;
  userAgent?: string;
}

export interface AiFieldValue {
  value: string | number | null;
  confidence: Confidence | null;
}

export interface CatalogSuggestion {
  id: string;
  name: string;
  unitFamily: string;
  score: number;
  exact: boolean;
}

export interface ExtractionDto {
  extractionId: string;
  kind: ExtractionKind;
  status: ExtractionStatus;
  imageQuality: ImageQuality | null;
  errorCode: string | null;
  fields: Record<string, AiFieldValue>;
  catalogSuggestions: CatalogSuggestion[];
}

// ---------------------------------------------------------------- holat va limitlar

export class AiUnavailableError extends AppError {
  constructor() {
    super(
      503,
      'AI_UNAVAILABLE',
      'AI xizmati sozlanmagan yoki o‘chirilgan — maydonlarni qo‘lda to‘ldiring',
    );
  }
}

export async function companyAiEnabled(companyId: string): Promise<boolean> {
  const { rows } = await query<{ ai_enabled: boolean }>(
    `SELECT ai_enabled FROM companies WHERE id = $1`,
    [companyId],
  );
  return rows[0]?.ai_enabled ?? false;
}

export async function usedToday(companyId: string): Promise<number> {
  const { rows } = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM ai_extractions
      WHERE company_id = $1
        AND created_at >= ((now() AT TIME ZONE $2)::date AT TIME ZONE $2)`,
    [companyId, ANALYTICS_TZ],
  );
  return Number(rows[0]?.n ?? 0);
}

export interface AiStatusDto {
  /** UI tugmalari faqat `enabled=true` bo'lsa ko'rinadi. */
  enabled: boolean;
  configured: boolean;
  companyEnabled: boolean;
  dailyLimit: number;
  usedToday: number;
  maxFileMb: number;
}

export async function getAiStatus(rt: AiRuntime, companyId: string | null): Promise<AiStatusDto> {
  const configured = Boolean(rt.client);
  const companyEnabled = companyId ? await companyAiEnabled(companyId) : false;
  const used = configured && companyId ? await usedToday(companyId) : 0;
  return {
    enabled: configured && companyEnabled,
    configured,
    companyEnabled,
    dailyLimit: rt.dailyLimit,
    usedToday: used,
    maxFileMb: Math.round(rt.maxFileBytes / (1024 * 1024)),
  };
}

/** Tartib: xizmat sozlanmaganmi (503) → kompaniyada o'chiqmi (403) → kunlik limit (429). */
export async function assertAiAvailable(rt: AiRuntime, companyId: string): Promise<AiClient> {
  if (!rt.client) throw new AiUnavailableError();
  if (!(await companyAiEnabled(companyId))) {
    throw new AppError(403, 'AI_DISABLED', 'Bu kompaniya uchun AI yordamchi yoqilmagan');
  }
  if ((await usedToday(companyId)) >= rt.dailyLimit) {
    throw new AppError(
      429,
      'AI_DAILY_LIMIT',
      'Kompaniyaning bugungi AI limiti tugadi — maydonlarni qo‘lda to‘ldiring',
      { dailyLimit: rt.dailyLimit },
    );
  }
  return rt.client;
}

// ---------------------------------------------------------------- AI chaqiruvi (umumiy)

export interface CallOutcome<T> {
  status: ExtractionStatus;
  data: T | null;
  errorCode: string | null;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

/**
 * Model chaqiruvi + qat'iy sxema; hech qachon tashlamaydi (xato → `failed`/`rejected` + kod).
 * `file` — P18 bitta fayl; `parts` — P19 (chat ilovalari, retrieval matni, OCR).
 */
export async function callModel<T>(
  client: AiClient,
  file: AiValidatedFile | null,
  prompt: {
    system: string;
    instruction: string;
    jsonSchema: Record<string, unknown>;
    parts?: AiContentPart[];
    maxTokens?: number;
  },
  parse: (json: unknown) => { success: true; data: T } | { success: false },
): Promise<CallOutcome<T>> {
  const base = { model: client.model, inputTokens: null, outputTokens: null };
  try {
    const res = await client.extract({
      system: prompt.system,
      instruction: prompt.instruction,
      ...(file ? { file: { mediaType: file.mime, data: file.buffer } } : {}),
      parts: prompt.parts,
      maxTokens: prompt.maxTokens,
      jsonSchema: prompt.jsonSchema,
    });
    const usage = {
      model: res.model,
      inputTokens: res.inputTokens,
      outputTokens: res.outputTokens,
    };
    const parsed = parse(res.json);
    if (!parsed.success) {
      return { ...usage, status: 'failed', data: null, errorCode: 'AI_SCHEMA_MISMATCH' };
    }
    return { ...usage, status: 'ok', data: parsed.data, errorCode: null };
  } catch (err) {
    if (err instanceof AiUpstreamError) {
      return {
        ...base,
        status: err.code === 'AI_REFUSED' ? 'rejected' : 'failed',
        data: null,
        errorCode: err.code,
      };
    }
    logger.error('AI chaqiruvida kutilmagan xato', {
      error: err instanceof Error ? err.name : 'unknown',
    });
    return { ...base, status: 'failed', data: null, errorCode: 'AI_UPSTREAM_ERROR' };
  }
}

/** Faylni R2 ga (iz uchun) — xato bo'lsa ekstraksiya to'xtamaydi, kalit NULL qoladi. */
async function storeSourceFile(
  storage: FileStorage | null,
  companyId: string,
  file: AiValidatedFile,
): Promise<string | null> {
  if (!storage) return null;
  const key = buildKey(companyId, 'ai', file.ext);
  try {
    await storage.put(key, file.buffer, file.mime);
    return key;
  } catch (err) {
    logger.warn('AI manba faylini R2 ga yozib bo‘lmadi', {
      error: err instanceof Error ? err.name : 'unknown',
    });
    return null;
  }
}

export async function insertExtraction(
  db: pg.PoolClient | null,
  row: {
    companyId: string;
    userId: string | null;
    kind: ExtractionKind;
    fileKey: string | null;
    fileName: string | null;
    model: string;
    status: ExtractionStatus;
    imageQuality: ImageQuality | null;
    result: unknown;
    errorCode: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
    ndId?: string | null;
  },
): Promise<string> {
  const sql = `INSERT INTO ai_extractions (company_id, user_id, kind, file_key, file_name, model, status,
                 image_quality, result_json, error_code, input_tokens, output_tokens, nd_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13) RETURNING id`;
  const params = [
    row.companyId,
    row.userId,
    row.kind,
    row.fileKey,
    row.fileName,
    row.model,
    row.status,
    row.imageQuality,
    row.result === null ? null : JSON.stringify(row.result),
    row.errorCode,
    row.inputTokens,
    row.outputTokens,
    row.ndId ?? null,
  ];
  const res = db
    ? await db.query<{ id: string }>(sql, params)
    : await query<{ id: string }>(sql, params);
  return res.rows[0]!.id;
}

export function logExtraction(
  id: string,
  kind: ExtractionKind,
  o: CallOutcome<unknown>,
  companyId: string,
) {
  // Fayl mazmuni ham, ajratilgan qiymatlar ham logga yozilmaydi — faqat metama'lumot
  logger.info('AI ekstraksiya', {
    extractionId: id,
    companyId,
    kind,
    status: o.status,
    errorCode: o.errorCode,
    inputTokens: o.inputTokens,
    outputTokens: o.outputTokens,
  });
}

// ---------------------------------------------------------------- namuna / reaktiv

/** Forma maydonlari (UI va review diff shu kalitlar bilan ishlaydi). */
export const SAMPLE_AI_FIELDS = [
  'substanceName',
  'serialNumber',
  'manufacturer',
  'manufacturedAt',
  'expiryDate',
  'quantity',
  'arrivalDate',
  'analysisEnd',
] as const;
export const REAGENT_AI_FIELDS = [
  'name',
  'lotNumber',
  'manufacturer',
  'manufacturedAt',
  'expiresAt',
  'quantity',
  'unit',
  'arrivalDate',
] as const;

const field = (value: string | number | null, confidence: Confidence): AiFieldValue => ({
  value,
  confidence: value === null && confidence !== 'low' ? null : confidence,
});

const dateField = (raw: { value: string | null; confidence: Confidence }): AiFieldValue => {
  const v = normalizeDate(raw.value);
  return field(v, lowerIfInvalid(v, raw.value, raw.confidence));
};
const textFieldOf = (raw: { value: string | null; confidence: Confidence }, max: number) =>
  field(normalizeText(raw.value, max), raw.confidence);

/** Model javobi → forma maydonlari (deterministik). Past sifatda hammasi `null` (taxmin yo'q). */
export function mapDocumentFields(
  kind: 'sample' | 'reagent',
  result: DocumentResult,
): Record<string, AiFieldValue> {
  const f = result.fields;
  const blank = result.image_quality !== 'good';
  const qtyNum = normalizeNumber(f.quantity.value);
  const unit = normalizeAiUnit(f.quantity.unit);
  const unitUnknown = Boolean(f.quantity.unit && f.quantity.unit.trim()) && unit === null;

  let out: Record<string, AiFieldValue>;
  if (kind === 'sample') {
    // Namuna miqdori — erkin matn ("25 kg"); noma'lum birlik bo'lsa miqdor taklif qilinmaydi
    let qtyText: string | null = null;
    if (qtyNum !== null && !unitUnknown) qtyText = unit ? `${qtyNum} ${unit}` : String(qtyNum);
    const qtyConf: Confidence =
      unitUnknown || (f.quantity.value && qtyNum === null) ? 'low' : f.quantity.confidence;
    out = {
      substanceName: textFieldOf(f.name, 500),
      serialNumber: textFieldOf(f.series, 100),
      manufacturer: textFieldOf(f.manufacturer, 255),
      manufacturedAt: dateField(f.manufactured_date),
      expiryDate: dateField(f.expiry_date),
      quantity: field(qtyText, qtyConf),
      arrivalDate: dateField(f.arrival_date),
      analysisEnd: dateField(f.analysis_end_date),
    };
  } else {
    out = {
      name: textFieldOf(f.name, 255),
      lotNumber: textFieldOf(f.series, 100),
      manufacturer: textFieldOf(f.manufacturer, 255),
      manufacturedAt: dateField(f.manufactured_date),
      expiresAt: dateField(f.expiry_date),
      quantity: field(qtyNum, lowerIfInvalid(qtyNum, f.quantity.value, f.quantity.confidence)),
      unit: field(unit, unitUnknown ? 'low' : f.quantity.confidence),
      arrivalDate: dateField(f.arrival_date),
    };
  }

  // Muddat ishlab chiqarilgandan oldin — ikkalasi ham shubhali (qiymat saqlanadi, inson tekshiradi)
  const mfg = out.manufacturedAt?.value;
  const expKey = kind === 'sample' ? 'expiryDate' : 'expiresAt';
  const exp = out[expKey]?.value;
  if (typeof mfg === 'string' && typeof exp === 'string' && exp < mfg) {
    out.manufacturedAt = { value: mfg, confidence: 'low' };
    out[expKey] = { value: exp, confidence: 'low' };
  }

  if (blank) {
    for (const k of Object.keys(out)) out[k] = { value: null, confidence: null };
  }
  return out;
}

const nameKey = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

/** 0..1 o'xshashlik: belgi darajasidagi masofa va so'z kesishmasining eng yaxshisi. */
export function nameSimilarity(a: string, b: string): number {
  const x = nameKey(a);
  const y = nameKey(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const lev = 1 - levenshtein(x, y) / Math.max(x.length, y.length);
  const tx = new Set(x.split(/[\s,()\-/]+/).filter(Boolean));
  const ty = new Set(y.split(/[\s,()\-/]+/).filter(Boolean));
  const inter = [...tx].filter((t) => ty.has(t)).length;
  const jac = inter / (tx.size + ty.size - inter || 1);
  return Math.round(Math.max(lev, jac) * 100) / 100;
}

/** Katalogdagi eng yaqin nomlar — faqat TAKLIF (avto-yaratilmaydi, avto-bog'lanmaydi). */
export async function suggestCatalogItems(
  db: pg.PoolClient | null,
  companyId: string,
  name: string | null,
  limit = 3,
): Promise<CatalogSuggestion[]> {
  if (!name) return [];
  const sql = `SELECT id, name, unit_family FROM reagent_items WHERE company_id = $1 ORDER BY name LIMIT 5000`;
  const res = db
    ? await db.query<{ id: string; name: string; unit_family: string }>(sql, [companyId])
    : await query<{ id: string; name: string; unit_family: string }>(sql, [companyId]);
  return res.rows
    .map((r) => {
      const score = nameSimilarity(name, r.name);
      return { id: r.id, name: r.name, unitFamily: r.unit_family, score, exact: score === 1 };
    })
    .filter((s) => s.score >= 0.5)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export async function extractDocument(
  rt: AiRuntime,
  actor: AiActor,
  kind: 'sample' | 'reagent',
  incoming: IncomingFile | undefined,
): Promise<ExtractionDto> {
  const client = await assertAiAvailable(rt, actor.companyId);
  const file = assertAiFile(incoming, rt.maxFileBytes, AI_MAX_PDF_PAGES.document);
  const fileKey = await storeSourceFile(rt.storage, actor.companyId, file);

  const outcome = await callModel(
    client,
    file,
    {
      system: DOCUMENT_SYSTEM_PROMPT,
      instruction: DOCUMENT_INSTRUCTION,
      jsonSchema: DOCUMENT_JSON_SCHEMA,
    },
    (json) => documentResultSchema.safeParse(json),
  );

  let fields: Record<string, AiFieldValue> = {};
  let imageQuality: ImageQuality | null = null;
  let status = outcome.status;
  let suggestions: CatalogSuggestion[] = [];
  if (outcome.data) {
    imageQuality = outcome.data.image_quality;
    fields = mapDocumentFields(kind, outcome.data);
    if (imageQuality === 'unreadable') status = 'rejected';
    if (kind === 'reagent') {
      suggestions = await suggestCatalogItems(
        null,
        actor.companyId,
        fields.name?.value as string | null,
      );
    }
  }

  const id = await insertExtraction(null, {
    companyId: actor.companyId,
    userId: actor.userId,
    kind,
    fileKey,
    fileName: file.filename,
    model: outcome.model,
    status,
    imageQuality,
    result: outcome.data ? { imageQuality, fields, catalogSuggestions: suggestions } : null,
    errorCode: outcome.errorCode,
    inputTokens: outcome.inputTokens,
    outputTokens: outcome.outputTokens,
  });
  logExtraction(id, kind, { ...outcome, status }, actor.companyId);

  return {
    extractionId: id,
    kind,
    status,
    imageQuality,
    errorCode:
      outcome.errorCode ?? (imageQuality && imageQuality !== 'good' ? 'AI_POOR_QUALITY' : null),
    fields,
    catalogSuggestions: suggestions,
  };
}

// ---------------------------------------------------------------- AI → yakuniy qiymat (review audit)

const REVIEW_TABLE: Record<ExtractionKind, string> = {
  sample: 'samples',
  reagent: 'reagents',
  nd: 'normative_documents',
  ocr: 'ai_extractions',
  peaks: 'peak_results',
};

/** Solishtirish uchun kanonik satr: probellar siqiladi, sonlar `Number` orqali (25.0 = 25). */
export function canonicalValue(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  // pg `date` → mahalliy yarim tun; toISOString() UTC+5 da bir kun oldinga siljitadi (D-168) — mahalliy qismlar
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  if (!s) return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return String(Number(s));
  return s;
}

export interface FieldChange {
  field: string;
  aiValue: string | null;
  finalValue: string | null;
  confidence: Confidence | null;
}

export interface ReviewSummary {
  extractionId: string;
  changed: FieldChange[];
  accepted: FieldChange[];
}

/**
 * D-181: inson formani saqlaganda (yaratish tranzaksiyasi ichida) — AI to'ldirgan har maydon uchun AI qiymati
 * (serverdagi jurnaldan, mijozga ishonilmaydi) va yakuniy qiymat yoziladi; o'zgarganlari audit'ga.
 * Ekstraksiya: shu kompaniya, shu foydalanuvchi, shu tur, `ok` va hali ishlatilmagan bo'lishi shart.
 */
export async function recordAiReview(
  tx: pg.PoolClient,
  actor: AiActor,
  input: {
    extractionId: string;
    kind: 'sample' | 'reagent';
    entityId: string;
    finalValues: Record<string, unknown>;
  },
): Promise<ReviewSummary> {
  const { rows } = await tx.query<{
    id: string;
    result_json: { fields?: Record<string, AiFieldValue> } | null;
    model: string;
  }>(
    `SELECT id, result_json, model FROM ai_extractions
      WHERE id = $1 AND company_id = $2 AND user_id = $3 AND kind = $4
        AND status = 'ok' AND consumed_at IS NULL
      FOR UPDATE`,
    [input.extractionId, actor.companyId, actor.userId, input.kind],
  );
  const ext = rows[0];
  if (!ext) {
    throw new AppError(
      422,
      'AI_EXTRACTION_INVALID',
      'AI ekstraksiyasi topilmadi, boshqa turga tegishli yoki allaqachon ishlatilgan',
    );
  }
  const aiFields = ext.result_json?.fields ?? {};
  const changed: FieldChange[] = [];
  const accepted: FieldChange[] = [];
  for (const [name, ai] of Object.entries(aiFields)) {
    const aiValue = canonicalValue(ai?.value);
    if (aiValue === null) continue; // AI to'ldirmagan maydon — review emas
    const finalValue = canonicalValue(input.finalValues[name]);
    const change: FieldChange = {
      field: name,
      aiValue,
      finalValue,
      confidence: ai.confidence ?? null,
    };
    (aiValue === finalValue ? accepted : changed).push(change);
    await tx.query(
      `INSERT INTO ai_field_reviews (company_id, extraction_id, entity_type, entity_id, field, ai_value,
                                     final_value, confidence, changed, reviewed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        actor.companyId,
        ext.id,
        input.kind,
        input.entityId,
        name,
        aiValue,
        finalValue,
        change.confidence,
        aiValue !== finalValue,
        actor.userId,
      ],
    );
  }
  await tx.query(
    `UPDATE ai_extractions SET consumed_at = now(), consumed_entity_id = $2 WHERE id = $1`,
    [ext.id, input.entityId],
  );
  await writeAudit(tx, {
    userId: actor.userId,
    companyId: actor.companyId,
    action: 'ai_review',
    tableName: REVIEW_TABLE[input.kind],
    recordId: input.entityId,
    newValues: {
      extractionId: ext.id,
      model: ext.model,
      changedFields: changed,
      acceptedFields: accepted.map((a) => a.field),
    },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  return { extractionId: ext.id, changed, accepted };
}

// ---------------------------------------------------------------- ND

export interface NdSkipped {
  kind: 'equipment' | 'reagent';
  name: string | null;
  quantity: string | null;
  unit: string | null;
  methodName: string | null;
  reason:
    | 'not_in_catalog'
    | 'unknown_unit'
    | 'unit_mismatch'
    | 'invalid_quantity'
    | 'empty'
    | 'duplicate';
  suggestions: CatalogSuggestion[];
}

export interface NdExtractionDto {
  extractionId: string;
  status: ExtractionStatus;
  imageQuality: ImageQuality | null;
  errorCode: string | null;
  createdIds: string[];
  skipped: NdSkipped[];
}

export interface NdAiValue {
  kind: 'equipment' | 'reagent';
  methodName: string | null;
  equipmentCategory: string | null;
  reagentItemId: string | null;
  reagentName: string | null;
  quantity: number | null;
  unit: string | null;
  confidence: Confidence;
}

export async function extractNd(
  rt: AiRuntime,
  actor: AiActor,
  ndId: string,
): Promise<NdExtractionDto> {
  const client = await assertAiAvailable(rt, actor.companyId);
  const storage = requireStorage(rt.storage);

  const { rows } = await query<{
    status: string;
    file_path: string | null;
    file_name: string | null;
  }>(
    `SELECT status::text, file_path, file_name FROM normative_documents WHERE id = $1 AND company_id = $2`,
    [ndId, actor.companyId],
  );
  const nd = rows[0];
  if (!nd) throw new NotFoundError('Normativ hujjat (ND) topilmadi');
  if (nd.status !== 'draft') {
    throw new AppError(
      409,
      'ND_NOT_DRAFT',
      'AI talablarni faqat qoralama (draft) ND ga qo‘sha oladi',
    );
  }
  if (!nd.file_path) throw new AppError(409, 'ND_FILE_MISSING', 'Avval ND faylini yuklang');

  const buffer = await storage.get(nd.file_path);
  const file = assertAiFile(
    { originalname: nd.file_name ?? 'nd.pdf', buffer, size: buffer.length },
    rt.maxFileBytes,
    AI_MAX_PDF_PAGES.nd,
  );

  const outcome = await callModel<NdResult>(
    client,
    file,
    { system: ND_SYSTEM_PROMPT, instruction: ND_INSTRUCTION, jsonSchema: ND_JSON_SCHEMA },
    (json) => ndResultSchema.safeParse(json),
  );
  const imageQuality = outcome.data?.image_quality ?? null;
  let status = outcome.status;
  if (imageQuality === 'unreadable') status = 'rejected';
  const usable = outcome.data && imageQuality === 'good' ? outcome.data.requirements : [];

  return withTransaction(async (tx) => {
    // Qayta tekshiruv (AI chaqiruvi davomida holat o'zgargan bo'lishi mumkin)
    const lock = await tx.query<{ status: string }>(
      `SELECT status::text FROM normative_documents WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [ndId, actor.companyId],
    );
    if (lock.rows[0]?.status !== 'draft') {
      throw new AppError(
        409,
        'ND_NOT_DRAFT',
        'AI talablarni faqat qoralama (draft) ND ga qo‘sha oladi',
      );
    }
    const existing = await tx.query<{
      kind: string;
      method_name: string | null;
      equipment_category_key: string | null;
      reagent_item_id: string | null;
    }>(
      `SELECT kind::text, method_name, equipment_category_key, reagent_item_id FROM nd_requirements WHERE nd_id = $1`,
      [ndId],
    );
    const seen = new Set(
      existing.rows.map((r) =>
        [r.kind, nameKey(r.method_name ?? ''), r.equipment_category_key ?? r.reagent_item_id].join(
          '|',
        ),
      ),
    );
    const maxSort = await tx.query<{ m: number | null }>(
      `SELECT max(sort_order) AS m FROM nd_requirements WHERE nd_id = $1`,
      [ndId],
    );
    let sort = (maxSort.rows[0]?.m ?? 0) + 1;

    const createdIds: string[] = [];
    const skipped: NdSkipped[] = [];
    for (const r of usable) {
      const methodName = normalizeText(r.method_name, 255);
      const base = {
        kind: r.kind,
        name:
          r.kind === 'equipment'
            ? normalizeText(r.equipment_category, 120)
            : normalizeText(r.reagent_name, 255),
        quantity: r.quantity,
        unit: r.unit,
        methodName,
        suggestions: [] as CatalogSuggestion[],
      };
      if (!base.name) {
        skipped.push({ ...base, reason: 'empty' });
        continue;
      }
      let aiValue: NdAiValue;
      if (r.kind === 'equipment') {
        aiValue = {
          kind: 'equipment',
          methodName,
          equipmentCategory: base.name,
          reagentItemId: null,
          reagentName: null,
          quantity: null,
          unit: null,
          confidence: r.confidence,
        };
        const key = ['equipment', nameKey(methodName ?? ''), nameKey(base.name)].join('|');
        if (seen.has(key)) {
          skipped.push({ ...base, reason: 'duplicate' });
          continue;
        }
        seen.add(key);
      } else {
        const qty = normalizeNumber(r.quantity);
        if (qty === null || qty <= 0) {
          skipped.push({ ...base, reason: 'invalid_quantity' });
          continue;
        }
        const unit = normalizeAiUnit(r.unit);
        if (!unit) {
          skipped.push({ ...base, reason: 'unknown_unit' });
          continue;
        }
        // Faqat aniq (normallashtirilgan nom) moslik avtomatik bog'lanadi; qolgani — taklif
        const match = await tx.query<{ id: string; unit_family: string }>(
          `SELECT id, unit_family FROM reagent_items WHERE company_id = $1 AND name_key = $2`,
          [actor.companyId, nameKey(base.name)],
        );
        const item = match.rows[0];
        if (!item) {
          skipped.push({
            ...base,
            reason: 'not_in_catalog',
            suggestions: await suggestCatalogItems(tx, actor.companyId, base.name),
          });
          continue;
        }
        if (normalizeUnit(unit)?.family !== item.unit_family) {
          skipped.push({ ...base, reason: 'unit_mismatch' });
          continue;
        }
        const key = ['reagent', nameKey(methodName ?? ''), item.id].join('|');
        if (seen.has(key)) {
          skipped.push({ ...base, reason: 'duplicate' });
          continue;
        }
        seen.add(key);
        aiValue = {
          kind: 'reagent',
          methodName,
          equipmentCategory: null,
          reagentItemId: item.id,
          reagentName: base.name,
          quantity: qty,
          unit,
          confidence: r.confidence,
        };
      }
      const ins = await tx.query<{ id: string }>(
        `INSERT INTO nd_requirements (company_id, nd_id, kind, method_name, equipment_category, reagent_item_id,
                                      quantity_per_analysis, unit, source, ai_value, sort_order)
         VALUES ($1, $2, $3::nd_requirement_kind, $4, $5, $6, $7, $8, 'ai', $9::jsonb, $10) RETURNING id`,
        [
          actor.companyId,
          ndId,
          aiValue.kind,
          aiValue.methodName,
          aiValue.equipmentCategory,
          aiValue.reagentItemId,
          aiValue.quantity,
          aiValue.unit,
          JSON.stringify(aiValue),
          sort++,
        ],
      );
      createdIds.push(ins.rows[0]!.id);
    }

    const extractionId = await insertExtraction(tx, {
      companyId: actor.companyId,
      userId: actor.userId,
      kind: 'nd',
      fileKey: nd.file_path,
      fileName: nd.file_name,
      model: outcome.model,
      status,
      imageQuality,
      result: outcome.data ? { imageQuality, createdIds, skipped } : null,
      errorCode: outcome.errorCode,
      inputTokens: outcome.inputTokens,
      outputTokens: outcome.outputTokens,
      ndId,
    });
    if (createdIds.length) {
      await writeAudit(tx, {
        userId: actor.userId,
        companyId: actor.companyId,
        action: 'ai_extract',
        tableName: 'normative_documents',
        recordId: ndId,
        newValues: { extractionId, created: createdIds.length, skipped: skipped.length },
        ip: actor.ip,
        userAgent: actor.userAgent,
      });
    }
    logExtraction(extractionId, 'nd', { ...outcome, status }, actor.companyId);
    return {
      extractionId,
      status,
      imageQuality,
      errorCode:
        outcome.errorCode ?? (imageQuality && imageQuality !== 'good' ? 'AI_POOR_QUALITY' : null),
      createdIds,
      skipped,
    };
  });
}

/** ND talabi yorlig'i (review "maydon" nomi uchun). */
function requirementLabel(
  v: Pick<NdAiValue, 'kind' | 'equipmentCategory' | 'reagentName' | 'methodName'>,
): string {
  const what = v.kind === 'equipment' ? v.equipmentCategory : v.reagentName;
  return [v.methodName, what].filter(Boolean).join(' / ').slice(0, 60) || v.kind;
}

/**
 * D-182: ND tasdiqlanganda AI taklif qilgan har talab uchun AI qiymati → yakuniy qiymat (o'zgarganlari audit'ga).
 * O'chirilgan AI talablari `recordNdRequirementRemoval` orqali o'chirish paytida yoziladi.
 */
export async function recordNdApprovalReview(
  tx: pg.PoolClient,
  actor: AiActor,
  ndId: string,
): Promise<FieldChange[]> {
  const { rows } = await tx.query<{
    id: string;
    ai_value: NdAiValue;
    method_name: string | null;
    equipment_category: string | null;
    reagent_item_id: string | null;
    quantity_per_analysis: string | null;
    unit: string | null;
  }>(
    `SELECT id, ai_value, method_name, equipment_category, reagent_item_id, quantity_per_analysis, unit
       FROM nd_requirements
      WHERE nd_id = $1 AND company_id = $2 AND ai_value IS NOT NULL AND ai_reviewed_at IS NULL
      FOR UPDATE`,
    [ndId, actor.companyId],
  );
  const changes: FieldChange[] = [];
  for (const r of rows) {
    const ai = r.ai_value;
    const label = requirementLabel(ai);
    const pairs: [string, unknown, unknown][] = [
      ['methodName', ai.methodName, r.method_name],
      ...(ai.kind === 'equipment'
        ? ([['equipmentCategory', ai.equipmentCategory, r.equipment_category]] as [
            string,
            unknown,
            unknown,
          ][])
        : ([
            ['reagentItemId', ai.reagentItemId, r.reagent_item_id],
            ['quantity', ai.quantity, r.quantity_per_analysis],
            ['unit', ai.unit, r.unit],
          ] as [string, unknown, unknown][])),
    ];
    for (const [name, aiRaw, finalRaw] of pairs) {
      const aiValue = canonicalValue(aiRaw);
      if (aiValue === null) continue;
      const finalValue = canonicalValue(finalRaw);
      const change = { field: `${label}.${name}`, aiValue, finalValue, confidence: ai.confidence };
      if (aiValue !== finalValue) changes.push(change);
      await tx.query(
        `INSERT INTO ai_field_reviews (company_id, entity_type, entity_id, field, ai_value, final_value,
                                       confidence, changed, reviewed_by)
         VALUES ($1, 'nd', $2, $3, $4, $5, $6, $7, $8)`,
        [
          actor.companyId,
          ndId,
          change.field.slice(0, 80),
          aiValue,
          finalValue,
          ai.confidence,
          aiValue !== finalValue,
          actor.userId,
        ],
      );
    }
    await tx.query(`UPDATE nd_requirements SET ai_reviewed_at = now() WHERE id = $1`, [r.id]);
  }
  if (rows.length) {
    await writeAudit(tx, {
      userId: actor.userId,
      companyId: actor.companyId,
      action: 'ai_review',
      tableName: 'normative_documents',
      recordId: ndId,
      newValues: { reviewedRequirements: rows.length, changedFields: changes },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  }
  return changes;
}

/** AI taklif qilgan talab inson tomonidan o'chirildi — "AI qiymati → (yo'q)" sifatida yoziladi. */
export async function recordNdRequirementRemoval(
  tx: pg.PoolClient,
  actor: AiActor,
  ndId: string,
  aiValue: NdAiValue,
): Promise<void> {
  const label = requirementLabel(aiValue);
  const summary =
    aiValue.kind === 'equipment'
      ? aiValue.equipmentCategory
      : `${aiValue.reagentName ?? ''} ${aiValue.quantity ?? ''} ${aiValue.unit ?? ''}`.trim();
  await tx.query(
    `INSERT INTO ai_field_reviews (company_id, entity_type, entity_id, field, ai_value, final_value,
                                   confidence, changed, reviewed_by)
     VALUES ($1, 'nd', $2, $3, $4, NULL, $5, true, $6)`,
    [
      actor.companyId,
      ndId,
      `${label}.removed`.slice(0, 80),
      summary,
      aiValue.confidence,
      actor.userId,
    ],
  );
}
