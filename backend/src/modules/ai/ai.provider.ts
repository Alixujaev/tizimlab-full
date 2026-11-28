import type { ZodType } from 'zod';
import {
  AI_DEFAULT_TIMEOUT_MS,
  AiUpstreamError,
  type AiChatRequest,
  type AiChatResponse,
  type AiContentPart,
  type AiExtractRequest,
  type AiExtractResponse,
  type AiFileInput,
} from './ai.client.js';

/**
 * D-201: AI provayderdan mustaqil qatlam. Servislar (ekstraksiya, ND, OCR, peak, OOS chat) FAQAT `LlmProvider`
 * ni biladi. Har provayder — yupqa "transport" (HTTP/SDK chaqiruvi + xato o'girish); Zod tekshiruvi provayderdan
 * qat'i nazar shu yerda bir xil bajariladi: javob sxemaga mos kelmasa `AI_SCHEMA_MISMATCH` (servisda status=failed).
 */

export const AI_PROVIDERS = ['openai', 'gemini', 'anthropic', 'mock'] as const;
export type AiProviderName = (typeof AI_PROVIDERS)[number];

export interface LlmUsage {
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface ExtractStructuredRequest<T> {
  systemPrompt: string;
  instruction: string;
  files: AiFileInput[];
  /** Qo'shimcha kontekst bo'laklari (retrieval matni, chat ilovalari) — `instruction` dan oldin. */
  parts?: AiContentPart[];
  /** Provayderga yuboriladigan structured-output sxemasi (Zod sxemasi bilan qo'lda sinxron). */
  jsonSchema: Record<string, unknown>;
  /** Yakuniy hakam — har provayder javobi shundan o'tadi. */
  zodSchema: ZodType<T>;
  maxTokens?: number;
}

export interface LlmProvider {
  readonly name: AiProviderName;
  readonly model: string;
  extractStructured<T>(req: ExtractStructuredRequest<T>): Promise<{ data: T; usage: LlmUsage }>;
  chat(req: AiChatRequest): Promise<{ text: string; usage: LlmUsage }>;
}

/** Provayderga xos past darajali qism. */
export interface ProviderTransport {
  readonly name: AiProviderName;
  readonly model: string;
  extract(req: AiExtractRequest): Promise<AiExtractResponse>;
  chat(req: AiChatRequest): Promise<AiChatResponse>;
}

export function createLlmProvider(transport: ProviderTransport): LlmProvider {
  return {
    name: transport.name,
    model: transport.model,
    async extractStructured<T>(req: ExtractStructuredRequest<T>) {
      const res = await transport.extract({
        system: req.systemPrompt,
        instruction: req.instruction,
        files: req.files,
        parts: req.parts,
        jsonSchema: req.jsonSchema,
        maxTokens: req.maxTokens,
      });
      const usage: LlmUsage = {
        model: res.model,
        inputTokens: res.inputTokens,
        outputTokens: res.outputTokens,
      };
      const parsed = req.zodSchema.safeParse(res.json);
      if (!parsed.success) throw new AiUpstreamError('AI_SCHEMA_MISMATCH', undefined, usage);
      return { data: parsed.data, usage };
    },
    async chat(req) {
      const res = await transport.chat(req);
      return {
        text: res.text,
        usage: { model: res.model, inputTokens: res.inputTokens, outputTokens: res.outputTokens },
      };
    },
  };
}

// ---------------------------------------------------------------- HTTP adapterlar uchun umumiy yordamchilar

export { AI_DEFAULT_TIMEOUT_MS };
export const AI_MAX_OUTPUT_TOKENS = 8_000;

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface HttpAdapterOptions {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  /** Qo'shimcha urinishlar soni (faqat 429/5xx, kvota tugagani emas). 0..2 */
  maxRetries?: number;
  /** Testlar uchun mock HTTP. */
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  baseUrl?: string;
}

/** Hisob/kvota bilan bog'liq 429 — qayta urinish foyda bermaydi (OpenAI/Gemini xato kodlari). */
const NON_RETRYABLE_429 = /quota|credit|billing|spend|usage_limit|insufficient/i;
/** Generatsiya xavfsizlik sababli bloklandi (Gemini "generation blocked" kodlari va h.k.). */
const BLOCKED_CODES =
  /^(safety|recitation|prohibited_content|spii|blocklist|image_safety|content_filter)$/i;

interface ErrorBody {
  error?: { code?: unknown; type?: unknown; status?: unknown; details?: { reason?: unknown }[] };
}

/** Xato tanasidan mashina kodlari (Google javobi massiv ichida keladi: `[{ error }]`). */
function errorCodeOf(body: unknown): string {
  const first = (Array.isArray(body) ? body[0] : body) as ErrorBody | null;
  const e = first?.error;
  const reasons = Array.isArray(e?.details) ? e.details.map((d) => d?.reason) : [];
  return [e?.code, e?.type, e?.status, ...reasons].filter((v) => typeof v === 'string').join(' ');
}

/** Kalit yaroqsiz — Google buni 400 bilan qaytaradi (rasmiy javob: `reason: API_KEY_INVALID`). */
const AUTH_CODES = /(API_KEY_INVALID|UNAUTHENTICATED|PERMISSION_DENIED|invalid_api_key)/;

/** HTTP status → bizning `AI_*` kodimiz. Provayder xabar matni hech qayerga chiqarilmaydi. */
export function mapHttpError(status: number, body: unknown): AiUpstreamError {
  const code = errorCodeOf(body);
  if (code.split(' ').some((c) => BLOCKED_CODES.test(c)))
    return new AiUpstreamError('AI_REFUSED', status);
  if (AUTH_CODES.test(code)) return new AiUpstreamError('AI_AUTH_ERROR', status);
  if (status === 401 || status === 402 || status === 403)
    return new AiUpstreamError('AI_AUTH_ERROR', status);
  if (status === 429) {
    const err = new AiUpstreamError('AI_UPSTREAM_RATE_LIMITED', 429);
    if (NON_RETRYABLE_429.test(code)) err.retryable = false;
    return err;
  }
  if (status === 408 || status >= 500) return new AiUpstreamError('AI_UPSTREAM_ERROR', status);
  return new AiUpstreamError('AI_BAD_REQUEST', status);
}

const isRetryable = (err: AiUpstreamError) =>
  err.retryable !== false &&
  typeof err.httpStatus === 'number' &&
  (err.httpStatus === 429 || err.httpStatus === 408 || err.httpStatus >= 500);

/**
 * POST JSON: timeout (AbortSignal), qayta urinish 429/408/5xx da (Retry-After ≤5s, aks holda 500ms·2^n),
 * timeout va ulanish xatosi qayta urinilmaydi (Anthropic adapteri bilan bir xil siyosat).
 */
export async function postJson(
  opts: HttpAdapterOptions,
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<unknown> {
  const doFetch = opts.fetch ?? ((u, i) => fetch(u, i));
  const timeout = opts.timeoutMs ?? AI_DEFAULT_TIMEOUT_MS;
  const maxRetries = Math.max(0, Math.min(2, opts.maxRetries ?? 2));
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const payload = JSON.stringify(body);
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await doFetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: payload,
        signal: AbortSignal.timeout(timeout),
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'TimeoutError' || name === 'AbortError') throw new AiUpstreamError('AI_TIMEOUT');
      throw new AiUpstreamError('AI_UPSTREAM_ERROR');
    }
    const json: unknown = await res.json().catch(() => null);
    if (res.ok) {
      if (json === null) throw new AiUpstreamError('AI_INVALID_JSON');
      return json;
    }
    const err = mapHttpError(res.status, json);
    if (attempt < maxRetries && isRetryable(err)) {
      const ra = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 5_000) : 500 * 2 ** attempt);
      continue;
    }
    throw err;
  }
}

export function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new AiUpstreamError('AI_INVALID_JSON');
  }
}

export const base64Of = (file: AiFileInput) => file.data.toString('base64');

/** Chat tarixini bitta matnga (rollar belgisi bilan) — tur-bo'lak tuzilmasi provayderlarda turlicha. */
export function transcriptOf(messages: AiChatRequest['messages']): string {
  return messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');
}
