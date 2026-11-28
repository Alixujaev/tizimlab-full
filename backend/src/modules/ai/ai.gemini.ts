import {
  AiUpstreamError,
  type AiChatRequest,
  type AiContentPart,
  type AiFileInput,
} from './ai.client.js';
import {
  AI_MAX_OUTPUT_TOKENS,
  base64Of,
  parseJsonText,
  postJson,
  transcriptOf,
  type HttpAdapterOptions,
  type ProviderTransport,
} from './ai.provider.js';

/**
 * D-201: Google Gemini adapteri — Interactions API (`POST /v1beta/interactions`, `x-goog-api-key`;
 * rasmiy hujjat 2026-11 da tekshirildi — hujjatlar shu API atrofida qurilgan).
 * - Rasm: `{ type: 'image', data, mime_type }`; PDF: `{ type: 'document', data, mime_type }` (inline base64).
 * - Structured output: `response_format = { type: 'text', mime_type: 'application/json', schema }` — keyin Zod.
 * - `store: false`; `max_output_tokens` thinking tokenlarini ham o'z ichiga oladi.
 * - `incomplete` → AI_TRUNCATED; xavfsizlik bloklari (safety, recitation, ...) → AI_REFUSED.
 * Chat tarixi bitta matnga yig'iladi (tur-bo'lak tuzilmasi o'rniga — D-201).
 */

export const GEMINI_DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_BASE = 'https://generativelanguage.googleapis.com';
export const GEMINI_API_REVISION = '2026-05-20';

type Block =
  { type: 'text'; text: string } | { type: 'image' | 'document'; data: string; mime_type: string };

function fileBlock(file: AiFileInput): Block {
  return {
    type: file.mediaType === 'application/pdf' ? 'document' : 'image',
    data: base64Of(file),
    mime_type: file.mediaType,
  };
}

function blocksOf(files: AiFileInput[], parts: AiContentPart[] | undefined, text: string): Block[] {
  return [
    ...files.map((f) => fileBlock(f)),
    ...(parts ?? []).map((p): Block =>
      p.kind === 'file' ? fileBlock(p) : { type: 'text', text: p.text },
    ),
    { type: 'text', text },
  ];
}

type ContentBlock = { type?: string; text?: string };
interface InteractionBody {
  model?: string;
  status?: string;
  error?: { code?: unknown };
  outputs?: ContentBlock[];
  steps?: { type?: string; content?: ContentBlock[] }[];
  usage?: {
    total_input_tokens?: number;
    total_output_tokens?: number;
    total_thought_tokens?: number;
  };
}

const BLOCKED = /^(safety|recitation|prohibited_content|spii|blocklist|image_safety|language)$/i;

export function parseGeminiResponse(raw: unknown, fallbackModel: string) {
  const body = (raw ?? {}) as InteractionBody;
  if (body.status === 'incomplete') throw new AiUpstreamError('AI_TRUNCATED');
  if (body.status && body.status !== 'completed') {
    const code = typeof body.error?.code === 'string' ? body.error.code : '';
    throw new AiUpstreamError(BLOCKED.test(code) ? 'AI_REFUSED' : 'AI_UPSTREAM_ERROR');
  }
  // Hujjatda ikkala shakl uchraydi: `outputs[]` va `steps[].content[]` (model_output)
  const blocks = [
    ...(body.outputs ?? []),
    ...(body.steps ?? []).filter((s) => s.type === 'model_output').flatMap((s) => s.content ?? []),
  ];
  const out = body.usage?.total_output_tokens;
  const thought = body.usage?.total_thought_tokens ?? 0;
  return {
    text: blocks
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join(''),
    model: body.model ?? fallbackModel,
    inputTokens: body.usage?.total_input_tokens ?? null,
    // Narx hisobi uchun: thinking tokenlari ham chiqish sifatida to'lanadi
    outputTokens: typeof out === 'number' ? out + thought : null,
  };
}

export function createGeminiTransport(opts: HttpAdapterOptions): ProviderTransport {
  const url = `${opts.baseUrl ?? DEFAULT_BASE}/v1beta/interactions`;
  const headers = { 'x-goog-api-key': opts.apiKey, 'api-revision': GEMINI_API_REVISION };
  const common = (system: string, maxTokens?: number) => ({
    model: opts.model,
    store: false,
    system_instruction: system,
    generation_config: { max_output_tokens: maxTokens ?? AI_MAX_OUTPUT_TOKENS },
  });

  return {
    name: 'gemini',
    model: opts.model,
    async extract(req) {
      const raw = await postJson(opts, url, headers, {
        ...common(req.system, req.maxTokens),
        input: blocksOf(req.files, req.parts, req.instruction),
        response_format: { type: 'text', mime_type: 'application/json', schema: req.jsonSchema },
      });
      const { text, ...usage } = parseGeminiResponse(raw, opts.model);
      if (!text) throw new AiUpstreamError('AI_INVALID_JSON');
      return { json: parseJsonText(text), ...usage };
    },
    async chat(req: AiChatRequest) {
      const raw = await postJson(opts, url, headers, {
        ...common(req.system, req.maxTokens),
        input: blocksOf([], req.context, transcriptOf(req.messages)),
      });
      const res = parseGeminiResponse(raw, opts.model);
      if (!res.text) throw new AiUpstreamError('AI_UPSTREAM_ERROR');
      return res;
    },
  };
}
