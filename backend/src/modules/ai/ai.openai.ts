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
  type HttpAdapterOptions,
  type ProviderTransport,
} from './ai.provider.js';

/**
 * D-201: OpenAI adapteri — Responses API (`POST /v1/responses`; rasmiy hujjat 2026-11 da tekshirildi).
 * - Rasm: `input_image` (base64 data URL); PDF: `input_file` (`file_data` data URL + `filename`).
 * - Structured output: `text.format = { type: 'json_schema', strict: true }` — keyin baribir Zod.
 * - `store: false` — so'rov/javob OpenAI tomonida saqlanmaydi.
 * - Rad etish (`refusal`) → AI_REFUSED; `incomplete` (max_output_tokens) → AI_TRUNCATED.
 */

export const OPENAI_DEFAULT_MODEL = 'gpt-6-luna';
const DEFAULT_BASE = 'https://api.openai.com';

export type OpenAiReasoningEffort = 'none' | 'low' | 'medium' | 'high';

export interface OpenAiOptions extends HttpAdapterOptions {
  /** Reasoning modellari uchun; berilmasa parametr yuborilmaydi (model standarti). */
  reasoningEffort?: OpenAiReasoningEffort;
}

type InputPart =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string }
  | { type: 'input_file'; filename: string; file_data: string };

function filePart(file: AiFileInput): InputPart {
  const url = `data:${file.mediaType};base64,${base64Of(file)}`;
  return file.mediaType === 'application/pdf'
    ? { type: 'input_file', filename: 'document.pdf', file_data: url }
    : { type: 'input_image', image_url: url };
}

function contentOf(
  files: AiFileInput[],
  parts: AiContentPart[] | undefined,
  text: string,
): InputPart[] {
  return [
    ...files.map((f) => filePart(f)),
    ...(parts ?? []).map((p): InputPart =>
      p.kind === 'file' ? filePart(p) : { type: 'input_text', text: p.text },
    ),
    { type: 'input_text', text },
  ];
}

interface ResponsesBody {
  model?: string;
  status?: string;
  incomplete_details?: { reason?: string } | null;
  output?: { type?: string; content?: { type?: string; text?: string }[] }[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

/** Javobdan matn; holat/rad etish — mos kod. */
export function parseOpenAiResponse(raw: unknown, fallbackModel: string) {
  const body = (raw ?? {}) as ResponsesBody;
  if (body.status && body.status !== 'completed') {
    const reason = body.incomplete_details?.reason;
    if (body.status === 'incomplete' && reason === 'max_output_tokens')
      throw new AiUpstreamError('AI_TRUNCATED');
    if (reason === 'content_filter') throw new AiUpstreamError('AI_REFUSED');
    throw new AiUpstreamError('AI_UPSTREAM_ERROR');
  }
  const parts = (body.output ?? [])
    .filter((o) => o.type === 'message')
    .flatMap((o) => o.content ?? []);
  if (parts.some((c) => c.type === 'refusal')) throw new AiUpstreamError('AI_REFUSED');
  return {
    text: parts
      .filter((c) => c.type === 'output_text')
      .map((c) => c.text ?? '')
      .join(''),
    model: body.model ?? fallbackModel,
    inputTokens: body.usage?.input_tokens ?? null,
    outputTokens: body.usage?.output_tokens ?? null,
  };
}

export function createOpenAiTransport(opts: OpenAiOptions): ProviderTransport {
  const url = `${opts.baseUrl ?? DEFAULT_BASE}/v1/responses`;
  const headers = { authorization: `Bearer ${opts.apiKey}` };
  const common = (maxTokens?: number) => ({
    model: opts.model,
    store: false,
    max_output_tokens: maxTokens ?? AI_MAX_OUTPUT_TOKENS,
    ...(opts.reasoningEffort ? { reasoning: { effort: opts.reasoningEffort } } : {}),
  });

  return {
    name: 'openai',
    model: opts.model,
    async extract(req) {
      const raw = await postJson(opts, url, headers, {
        ...common(req.maxTokens),
        instructions: req.system,
        input: [{ role: 'user', content: contentOf(req.files, req.parts, req.instruction) }],
        text: {
          format: { type: 'json_schema', name: 'result', schema: req.jsonSchema, strict: true },
        },
      });
      const { text, ...usage } = parseOpenAiResponse(raw, opts.model);
      return { json: parseJsonText(text), ...usage };
    },
    async chat(req: AiChatRequest) {
      const [first, ...rest] = req.messages;
      const raw = await postJson(opts, url, headers, {
        ...common(req.maxTokens),
        instructions: req.system,
        input: first
          ? [
              { role: first.role, content: contentOf([], req.context, first.content) },
              ...rest.map((m) => ({ role: m.role, content: m.content })),
            ]
          : [],
      });
      const res = parseOpenAiResponse(raw, opts.model);
      if (!res.text) throw new AiUpstreamError('AI_UPSTREAM_ERROR');
      return res;
    },
  };
}
