import Anthropic from '@anthropic-ai/sdk';
import type { ProviderTransport } from './ai.provider.js';

/**
 * D-179/D-201: umumiy AI turlari va Anthropic (Claude) transporti. Servis faqat `LlmProvider` (ai.provider.ts)
 * ni biladi; Anthropic — adapterlardan biri (default EMAS). CI haqiqiy API'ga hech qachon murojaat qilmaydi.
 *
 * - Fayl: rasm (`image` bloki) yoki PDF (`document` bloki), base64.
 * - Javob shakli: structured output (`output_config.format` = JSON schema) → keyin servisda Zod bilan qat'iy tekshiruv.
 * - Timeout (standart 60s); qayta urinish 1–2 marta FAQAT 429/5xx (SDK'ning o'z retry'i o'chirilgan — nazorat bizda).
 * - SDK xatolari o'zimizning `AI_*` kodlariga o'giriladi; xabar matni/so'rov mazmuni logga tushmaydi.
 */

export type AiMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

/** P19: bir so'rovda bir nechta fayl/matn bo'lagi (chat ilovalari, OCR, retrieval konteksti). */
export type AiContentPart =
  { kind: 'file'; mediaType: AiMediaType; data: Buffer } | { kind: 'text'; text: string };

export interface AiFileInput {
  mediaType: AiMediaType;
  data: Buffer;
}

/** Transport darajasidagi so'rov: fayllar → qo'shimcha bo'laklar → instruction (shu tartibda). */
export interface AiExtractRequest {
  system: string;
  instruction: string;
  files: AiFileInput[];
  /** Qo'shimcha bo'laklar — `instruction` dan oldin, berilgan tartibda. */
  parts?: AiContentPart[];
  jsonSchema: Record<string, unknown>;
  maxTokens?: number;
}

export interface AiChatRequest {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  /** Kontekst (retrieval matni, ilova fayllari) — suhbatdan oldin. */
  context?: AiContentPart[];
  maxTokens?: number;
}

export interface AiChatResponse {
  text: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface AiExtractResponse {
  json: unknown;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

export type AiUpstreamCode =
  | 'AI_TIMEOUT'
  | 'AI_UPSTREAM_RATE_LIMITED'
  | 'AI_UPSTREAM_ERROR'
  | 'AI_AUTH_ERROR'
  | 'AI_BAD_REQUEST'
  | 'AI_REFUSED'
  | 'AI_TRUNCATED'
  | 'AI_INVALID_JSON'
  | 'AI_SCHEMA_MISMATCH';

/** AI xizmati javob bermadi/yaroqsiz javob — servis buni `status=failed|rejected` ga aylantiradi (5xx emas). */
export class AiUpstreamError extends Error {
  /** false — qayta urinish foydasiz (masalan, kvota tugagan 429). */
  retryable?: boolean;
  constructor(
    public readonly code: AiUpstreamCode,
    public readonly httpStatus?: number,
    /** Javob kelgan, lekin yaroqsiz bo'lsa — sarflangan tokenlar (jurnal uchun). */
    public readonly usage?: {
      model: string;
      inputTokens: number | null;
      outputTokens: number | null;
    },
  ) {
    super(code);
    this.name = 'AiUpstreamError';
  }
}

export interface AnthropicClientOptions {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  /** Qo'shimcha urinishlar soni (faqat 429/5xx). 0..2 */
  maxRetries?: number;
  /** Testlar uchun: SDK `messages.create` o'rniga. */
  create?: (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>;
  sleep?: (ms: number) => Promise<void>;
}

export const AI_DEFAULT_TIMEOUT_MS = 60_000;
const MAX_TOKENS = 8_000;

function isRetryable(err: unknown): boolean {
  if (err instanceof Anthropic.APIConnectionTimeoutError) return false;
  if (err instanceof Anthropic.APIError && typeof err.status === 'number') {
    return err.status === 429 || err.status >= 500;
  }
  return false;
}

export function mapAnthropicError(err: unknown): AiUpstreamError {
  if (err instanceof AiUpstreamError) return err;
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new AiUpstreamError('AI_TIMEOUT');
  if (err instanceof Anthropic.APIError && typeof err.status === 'number') {
    if (err.status === 429) return new AiUpstreamError('AI_UPSTREAM_RATE_LIMITED', 429);
    if (err.status === 401 || err.status === 403)
      return new AiUpstreamError('AI_AUTH_ERROR', err.status);
    if (err.status >= 500) return new AiUpstreamError('AI_UPSTREAM_ERROR', err.status);
    return new AiUpstreamError('AI_BAD_REQUEST', err.status);
  }
  // Ulanish xatosi va boshqalar
  return new AiUpstreamError('AI_UPSTREAM_ERROR');
}

function retryDelayMs(err: unknown, attempt: number): number {
  if (err instanceof Anthropic.APIError) {
    const ra = Number(err.headers?.get?.('retry-after'));
    if (Number.isFinite(ra) && ra > 0) return Math.min(ra * 1000, 5_000);
  }
  return 500 * 2 ** attempt;
}

function contentBlock(file: { mediaType: AiMediaType; data: Buffer }): Anthropic.ContentBlockParam {
  const data = file.data.toString('base64');
  if (file.mediaType === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } };
  }
  return { type: 'image', source: { type: 'base64', media_type: file.mediaType, data } };
}

/** Javobdagi matn blokidan JSON; rad etish / kesilgan javob — mos kod. */
export function parseMessageJson(message: Anthropic.Message): unknown {
  if (message.stop_reason === 'refusal') throw new AiUpstreamError('AI_REFUSED');
  if (message.stop_reason === 'max_tokens') throw new AiUpstreamError('AI_TRUNCATED');
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  try {
    return JSON.parse(text);
  } catch {
    throw new AiUpstreamError('AI_INVALID_JSON');
  }
}

function userContent(
  files: AiFileInput[],
  parts: AiContentPart[] | undefined,
  text: string,
): Anthropic.ContentBlockParam[] {
  return [
    ...files.map(contentBlock),
    ...(parts ?? []).map((p): Anthropic.ContentBlockParam =>
      p.kind === 'file'
        ? contentBlock({ mediaType: p.mediaType, data: p.data })
        : { type: 'text', text: p.text },
    ),
    { type: 'text', text },
  ];
}

export function createAnthropicTransport(opts: AnthropicClientOptions): ProviderTransport {
  const timeout = opts.timeoutMs ?? AI_DEFAULT_TIMEOUT_MS;
  const maxRetries = Math.max(0, Math.min(2, opts.maxRetries ?? 2));
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let create = opts.create;
  if (!create) {
    const sdk = new Anthropic({ apiKey: opts.apiKey, maxRetries: 0, timeout });
    create = (params) => sdk.messages.create(params);
  }
  const send = create;

  async function call(
    params: Anthropic.MessageCreateParamsNonStreaming,
  ): Promise<Anthropic.Message> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await send(params);
      } catch (err) {
        if (attempt < maxRetries && isRetryable(err)) {
          await sleep(retryDelayMs(err, attempt));
          continue;
        }
        throw mapAnthropicError(err);
      }
    }
  }

  return {
    name: 'anthropic',
    model: opts.model,
    async extract(req) {
      const params: Anthropic.MessageCreateParamsNonStreaming = {
        model: opts.model,
        max_tokens: req.maxTokens ?? MAX_TOKENS,
        system: req.system,
        output_config: { format: { type: 'json_schema', schema: req.jsonSchema } },
        messages: [{ role: 'user', content: userContent(req.files, req.parts, req.instruction) }],
      };
      const message = await call(params);
      return {
        json: parseMessageJson(message),
        model: message.model ?? opts.model,
        inputTokens: message.usage?.input_tokens ?? null,
        outputTokens: message.usage?.output_tokens ?? null,
      };
    },
    async chat(req) {
      const [first, ...rest] = req.messages;
      const messages: Anthropic.MessageParam[] = first
        ? [
            { role: first.role, content: userContent([], req.context, first.content) },
            ...rest.map((m): Anthropic.MessageParam => ({ role: m.role, content: m.content })),
          ]
        : [];
      const message = await call({
        model: opts.model,
        max_tokens: req.maxTokens ?? MAX_TOKENS,
        system: req.system,
        messages,
      });
      if (message.stop_reason === 'refusal') throw new AiUpstreamError('AI_REFUSED');
      if (message.stop_reason === 'max_tokens') throw new AiUpstreamError('AI_TRUNCATED');
      return {
        text: message.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join(''),
        model: message.model ?? opts.model,
        inputTokens: message.usage?.input_tokens ?? null,
        outputTokens: message.usage?.output_tokens ?? null,
      };
    },
  };
}
