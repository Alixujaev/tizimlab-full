import { describe, expect, it, vi } from 'vitest';
// Erkin JSON so‘rov/javob tanalarini tekshirish uchun `any` asoslangan (faqat shu test fayli).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { parseEnv } from '../src/config/env.js';
import {
  AiUpstreamError,
  createAnthropicTransport,
  type AiFileInput,
} from '../src/modules/ai/ai.client.js';
import { aiClientFromEnv, createProvider } from '../src/modules/ai/ai.config.js';
import { createGeminiTransport, GEMINI_DEFAULT_MODEL } from '../src/modules/ai/ai.gemini.js';
import { createOpenAiTransport, OPENAI_DEFAULT_MODEL } from '../src/modules/ai/ai.openai.js';
import { createLlmProvider, type FetchLike } from '../src/modules/ai/ai.provider.js';
import { DOCUMENT_JSON_SCHEMA, documentResultSchema } from '../src/modules/ai/ai.schemas.js';
import { callModel, mapDocumentFields } from '../src/modules/ai/ai.service.js';
import { docResult } from './helpers/ai.js';

/** D-201: OpenAI va Gemini adapterlari — mock HTTP (CI da haqiqiy API yo'q). */

type Reply = { status?: number; body: unknown; headers?: Record<string, string> };

function mockFetch(...replies: Reply[]) {
  const queue = [...replies];
  const fn = vi.fn<FetchLike>(async () => {
    const r = queue.shift();
    if (!r) throw new Error('kutilmagan so‘rov');
    return new Response(JSON.stringify(r.body), {
      status: r.status ?? 200,
      headers: { 'content-type': 'application/json', ...r.headers },
    });
  });
  const bodyOf = (i = 0) => JSON.parse(String(fn.mock.calls[i]![1].body)) as Record<string, any>;
  const headersOf = (i = 0) => fn.mock.calls[i]![1].headers as Record<string, string>;
  return { fn, bodyOf, headersOf };
}

const sleep = vi.fn(async () => undefined);
const png = { mediaType: 'image/png' as const, data: Buffer.from('PNGDATA') };
const pdf = { mediaType: 'application/pdf' as const, data: Buffer.from('%PDF-1.7') };

const openAiOk = (json: unknown, over: Record<string, unknown> = {}) => ({
  body: {
    model: 'gpt-6-luna-2026',
    status: 'completed',
    output: [
      { type: 'reasoning', content: [] },
      { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(json) }] },
    ],
    usage: { input_tokens: 900, output_tokens: 120 },
    ...over,
  },
});
const geminiOk = (json: unknown, over: Record<string, unknown> = {}) => ({
  body: {
    model: 'gemini-3.1-flash-lite',
    status: 'completed',
    outputs: [{ type: 'text', text: JSON.stringify(json) }],
    usage: { total_input_tokens: 800, total_output_tokens: 100, total_thought_tokens: 20 },
    ...over,
  },
});

const ADAPTERS = {
  openai: {
    make: (fetch: FetchLike) =>
      createLlmProvider(createOpenAiTransport({ apiKey: 'sk-test', model: 'm-o', fetch, sleep })),
    ok: openAiOk,
  },
  gemini: {
    make: (fetch: FetchLike) =>
      createLlmProvider(createGeminiTransport({ apiKey: 'g-test', model: 'm-g', fetch, sleep })),
    ok: geminiOk,
  },
} as const;

const extractReq = (files: AiFileInput[] = [png]) => ({
  systemPrompt: 'SYS',
  instruction: 'GO',
  files,
  jsonSchema: DOCUMENT_JSON_SCHEMA,
  zodSchema: documentResultSchema,
});

describe('OpenAI adapteri (Responses API)', () => {
  it('so‘rov: URL, Bearer, store:false, instructions, input_image/input_file, strict json_schema', async () => {
    const m = mockFetch(openAiOk(docResult()));
    const p = createLlmProvider(
      createOpenAiTransport({
        apiKey: 'sk-test',
        model: 'm-o',
        fetch: m.fn,
        reasoningEffort: 'low',
      }),
    );
    const res = await p.extractStructured({
      ...extractReq([png, pdf]),
      parts: [{ kind: 'text', text: 'CTX' }],
    });
    expect(m.fn.mock.calls[0]![0]).toBe('https://api.openai.com/v1/responses');
    expect(m.headersOf().authorization).toBe('Bearer sk-test');
    const body = m.bodyOf();
    expect(body).toMatchObject({
      model: 'm-o',
      store: false,
      instructions: 'SYS',
      reasoning: { effort: 'low' },
      text: { format: { type: 'json_schema', strict: true, schema: DOCUMENT_JSON_SCHEMA } },
    });
    const content = body.input[0].content;
    expect(content[0]).toEqual({
      type: 'input_image',
      image_url: `data:image/png;base64,${png.data.toString('base64')}`,
    });
    expect(content[1]).toMatchObject({
      type: 'input_file',
      filename: 'document.pdf',
      file_data: `data:application/pdf;base64,${pdf.data.toString('base64')}`,
    });
    expect(content.slice(2)).toEqual([
      { type: 'input_text', text: 'CTX' },
      { type: 'input_text', text: 'GO' },
    ]);
    expect(res.data).toEqual(docResult());
    expect(res.usage).toEqual({ model: 'gpt-6-luna-2026', inputTokens: 900, outputTokens: 120 });
  });

  it('reasoningEffort berilmasa — parametr yuborilmaydi', async () => {
    const m = mockFetch(openAiOk(docResult()));
    await ADAPTERS.openai.make(m.fn).extractStructured(extractReq());
    expect(m.bodyOf()).not.toHaveProperty('reasoning');
  });

  it('refusal → AI_REFUSED; incomplete(max_output_tokens) → AI_TRUNCATED; content_filter → AI_REFUSED', async () => {
    const refusal = mockFetch({
      body: {
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }],
      },
    });
    await expect(
      ADAPTERS.openai.make(refusal.fn).extractStructured(extractReq()),
    ).rejects.toMatchObject({
      code: 'AI_REFUSED',
    });
    const cut = mockFetch({
      body: {
        status: 'incomplete',
        incomplete_details: { reason: 'max_output_tokens' },
        output: [],
      },
    });
    await expect(
      ADAPTERS.openai.make(cut.fn).extractStructured(extractReq()),
    ).rejects.toMatchObject({
      code: 'AI_TRUNCATED',
    });
    const filtered = mockFetch({
      body: { status: 'incomplete', incomplete_details: { reason: 'content_filter' }, output: [] },
    });
    await expect(
      ADAPTERS.openai.make(filtered.fn).extractStructured(extractReq()),
    ).rejects.toMatchObject({ code: 'AI_REFUSED' });
  });

  it('429 kvota tugagan — qayta urinilmaydi', async () => {
    const m = mockFetch({ status: 429, body: { error: { code: 'insufficient_quota' } } });
    await expect(ADAPTERS.openai.make(m.fn).extractStructured(extractReq())).rejects.toMatchObject({
      code: 'AI_UPSTREAM_RATE_LIMITED',
    });
    expect(m.fn).toHaveBeenCalledTimes(1);
  });
});

describe('Gemini adapteri (Interactions API)', () => {
  it('so‘rov: URL, x-goog-api-key, store:false, system_instruction, image/document bloklari, response_format', async () => {
    const m = mockFetch(geminiOk(docResult()));
    const res = await ADAPTERS.gemini.make(m.fn).extractStructured(extractReq([png, pdf]));
    expect(m.fn.mock.calls[0]![0]).toBe(
      'https://generativelanguage.googleapis.com/v1beta/interactions',
    );
    expect(m.headersOf()['x-goog-api-key']).toBe('g-test');
    const body = m.bodyOf();
    expect(body).toMatchObject({
      model: 'm-g',
      store: false,
      system_instruction: 'SYS',
      generation_config: { max_output_tokens: 8000 },
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: DOCUMENT_JSON_SCHEMA,
      },
    });
    expect(body.input).toEqual([
      { type: 'image', data: png.data.toString('base64'), mime_type: 'image/png' },
      { type: 'document', data: pdf.data.toString('base64'), mime_type: 'application/pdf' },
      { type: 'text', text: 'GO' },
    ]);
    expect(res.data).toEqual(docResult());
    // thinking tokenlari chiqishga qo'shiladi (narx hisobi)
    expect(res.usage).toEqual({
      model: 'gemini-3.1-flash-lite',
      inputTokens: 800,
      outputTokens: 120,
    });
  });

  it('yaroqsiz kalit: Google 400 + reason API_KEY_INVALID (massiv tana) → AI_AUTH_ERROR', async () => {
    const m = mockFetch({
      status: 400,
      body: [
        {
          error: {
            code: 400,
            status: 'INVALID_ARGUMENT',
            details: [
              { '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID' },
            ],
          },
        },
      ],
    });
    await expect(ADAPTERS.gemini.make(m.fn).extractStructured(extractReq())).rejects.toMatchObject({
      code: 'AI_AUTH_ERROR',
      httpStatus: 400,
    });
    expect(m.fn).toHaveBeenCalledTimes(1);
  });

  it('steps[].model_output shakli ham o‘qiladi', async () => {
    const m = mockFetch({
      body: {
        status: 'completed',
        steps: [
          { type: 'thought', content: [{ type: 'text', text: 'ignore' }] },
          { type: 'model_output', content: [{ type: 'text', text: JSON.stringify(docResult()) }] },
        ],
      },
    });
    const res = await ADAPTERS.gemini.make(m.fn).extractStructured(extractReq());
    expect(res.data).toEqual(docResult());
    expect(res.usage).toEqual({ model: 'm-g', inputTokens: null, outputTokens: null });
  });

  it('incomplete → AI_TRUNCATED; safety bloki → AI_REFUSED; bo‘sh javob → AI_INVALID_JSON', async () => {
    const cut = mockFetch({ body: { status: 'incomplete', outputs: [] } });
    await expect(
      ADAPTERS.gemini.make(cut.fn).extractStructured(extractReq()),
    ).rejects.toMatchObject({
      code: 'AI_TRUNCATED',
    });
    const blocked = mockFetch({ body: { status: 'failed', error: { code: 'safety' } } });
    await expect(
      ADAPTERS.gemini.make(blocked.fn).extractStructured(extractReq()),
    ).rejects.toMatchObject({ code: 'AI_REFUSED' });
    const blockedHttp = mockFetch({ status: 400, body: { error: { code: 'prohibited_content' } } });
    await expect(
      ADAPTERS.gemini.make(blockedHttp.fn).extractStructured(extractReq()),
    ).rejects.toMatchObject({ code: 'AI_REFUSED' });
    const empty = mockFetch({ body: { status: 'completed', outputs: [] } });
    await expect(
      ADAPTERS.gemini.make(empty.fn).extractStructured(extractReq()),
    ).rejects.toMatchObject({
      code: 'AI_INVALID_JSON',
    });
  });
});

describe.each(Object.entries(ADAPTERS))('%s — umumiy xatti-harakat', (_name, a) => {
  it('sxemadan chiqqan javob → AI_SCHEMA_MISMATCH (tokenlar saqlanadi)', async () => {
    const m = mockFetch(a.ok({ image_quality: 'good', fields: { name: 'extra' } }));
    const err = await a
      .make(m.fn)
      .extractStructured(extractReq())
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AiUpstreamError);
    expect(err).toMatchObject({ code: 'AI_SCHEMA_MISMATCH' });
    expect((err as AiUpstreamError).usage?.inputTokens).toBeGreaterThan(0);
  });

  it('JSON bo‘lmagan matn → AI_INVALID_JSON', async () => {
    const m = mockFetch(a.ok(null));
    const raw = JSON.parse(JSON.stringify(a.ok(null).body)) as Record<string, any>;
    if (raw.output) raw.output[1].content[0].text = 'not json';
    if (raw.outputs) raw.outputs[0].text = 'not json';
    m.fn.mockResolvedValueOnce(new Response(JSON.stringify(raw), { status: 200 }));
    await expect(a.make(m.fn).extractStructured(extractReq())).rejects.toMatchObject({
      code: 'AI_INVALID_JSON',
    });
  });

  it('401/403 → AI_AUTH_ERROR, qayta urinilmaydi; 400 → AI_BAD_REQUEST', async () => {
    for (const status of [401, 403]) {
      const m = mockFetch({ status, body: { error: { code: 'invalid_api_key' } } });
      await expect(a.make(m.fn).extractStructured(extractReq())).rejects.toMatchObject({
        code: 'AI_AUTH_ERROR',
        httpStatus: status,
      });
      expect(m.fn).toHaveBeenCalledTimes(1);
    }
    const bad = mockFetch({ status: 400, body: { error: { code: 'invalid_request' } } });
    await expect(a.make(bad.fn).extractStructured(extractReq())).rejects.toMatchObject({
      code: 'AI_BAD_REQUEST',
    });
    expect(bad.fn).toHaveBeenCalledTimes(1);
  });

  it('429 va 5xx — qayta urinadi (maks 2, Retry-After hisobga olinadi), keyin muvaffaqiyat', async () => {
    sleep.mockClear();
    const m = mockFetch(
      { status: 429, body: {}, headers: { 'retry-after': '2' } },
      { status: 503, body: {} },
      a.ok(docResult()),
    );
    await expect(a.make(m.fn).extractStructured(extractReq())).resolves.toBeTruthy();
    expect(m.fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 2000);
  });

  it('urinishlar tugasa → AI_UPSTREAM_ERROR', async () => {
    const m = mockFetch(
      { status: 500, body: {} },
      { status: 500, body: {} },
      { status: 500, body: {} },
    );
    await expect(a.make(m.fn).extractStructured(extractReq())).rejects.toMatchObject({
      code: 'AI_UPSTREAM_ERROR',
    });
    expect(m.fn).toHaveBeenCalledTimes(3);
  });

  it('timeout → AI_TIMEOUT (qayta urinilmaydi); ulanish xatosi → AI_UPSTREAM_ERROR', async () => {
    const timeout = vi.fn<FetchLike>(async () => {
      throw new DOMException('timeout', 'TimeoutError');
    });
    await expect(a.make(timeout).extractStructured(extractReq())).rejects.toMatchObject({
      code: 'AI_TIMEOUT',
    });
    expect(timeout).toHaveBeenCalledTimes(1);
    const net = vi.fn<FetchLike>(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(a.make(net).extractStructured(extractReq())).rejects.toMatchObject({
      code: 'AI_UPSTREAM_ERROR',
    });
  });

  it('chat: matn + tokenlar; kontekst va tarix yuboriladi', async () => {
    const m = mockFetch(
      _name === 'openai'
        ? {
            body: {
              status: 'completed',
              output: [{ type: 'message', content: [{ type: 'output_text', text: 'Javob' }] }],
              usage: { input_tokens: 5, output_tokens: 2 },
            },
          }
        : {
            body: {
              status: 'completed',
              outputs: [{ type: 'text', text: 'Javob' }],
              usage: { total_input_tokens: 5, total_output_tokens: 2 },
            },
          },
    );
    const res = await a.make(m.fn).chat({
      system: 'SYS',
      context: [{ kind: 'text', text: 'KONTEKST' }],
      messages: [
        { role: 'user', content: 'Savol 1' },
        { role: 'assistant', content: 'Javob 1' },
        { role: 'user', content: 'Savol 2' },
      ],
    });
    expect(res.text).toBe('Javob');
    expect(res.usage.inputTokens).toBe(5);
    const sent = JSON.stringify(m.bodyOf());
    for (const s of ['SYS', 'KONTEKST', 'Savol 1', 'Javob 1', 'Savol 2']) expect(sent).toContain(s);
    expect(m.bodyOf()).not.toHaveProperty(_name === 'openai' ? 'text' : 'response_format');
  });

  it('provayder almashganda image_quality/confidence/null qoidalari bir xil (mapDocumentFields)', async () => {
    const poor = docResult({ name: { value: null, confidence: 'low' } });
    poor.image_quality = 'poor';
    const outcome = await callModel(
      a.make(mockFetch(a.ok(poor)).fn),
      null,
      { system: 's', instruction: 'i', jsonSchema: DOCUMENT_JSON_SCHEMA },
      documentResultSchema,
    );
    expect(outcome.status).toBe('ok');
    expect(outcome.data!.image_quality).toBe('poor');
    expect(mapDocumentFields('sample', outcome.data!)).toEqual(
      mapDocumentFields('sample', documentResultSchema.parse(poor)),
    );
  });

  it('callModel: sxemadan chiqqan javob → status=failed, AI_SCHEMA_MISMATCH, tokenlar jurnalga', async () => {
    const outcome = await callModel(
      a.make(mockFetch(a.ok({ wrong: true })).fn),
      null,
      { system: 's', instruction: 'i', jsonSchema: DOCUMENT_JSON_SCHEMA },
      documentResultSchema,
    );
    expect(outcome).toMatchObject({
      status: 'failed',
      data: null,
      errorCode: 'AI_SCHEMA_MISMATCH',
    });
    expect(outcome.inputTokens).toBeGreaterThan(0);
  });
});

describe('provayder tanlovi (env)', () => {
  const base = {
    DATABASE_URL: 'postgres://u:p@localhost/db',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
  };

  it('standart provayder openai; kalit yo‘q — AI o‘chiq (null)', () => {
    const env = parseEnv({ ...base, AI_ENABLED: 'true' });
    expect(env.AI_PROVIDER).toBe('openai');
    expect(aiClientFromEnv(env)).toBeNull();
    expect(
      aiClientFromEnv(parseEnv({ ...base, AI_ENABLED: 'true', AI_PROVIDER: 'gemini' })),
    ).toBeNull();
    // Boshqa provayder kaliti yetarli emas
    expect(
      aiClientFromEnv(
        parseEnv({ ...base, AI_ENABLED: 'true', AI_PROVIDER: 'gemini', OPENAI_API_KEY: 'k' }),
      ),
    ).toBeNull();
  });

  it('AI_ENABLED=false — kalit bo‘lsa ham o‘chiq', () => {
    expect(aiClientFromEnv(parseEnv({ ...base, OPENAI_API_KEY: 'k' }))).toBeNull();
  });

  it('kalit bor — standart model (vision, eng arzon), AI_MODEL bilan almashtiriladi', () => {
    const o = aiClientFromEnv(parseEnv({ ...base, AI_ENABLED: 'true', OPENAI_API_KEY: 'k' }));
    expect(o).toMatchObject({ name: 'openai', model: OPENAI_DEFAULT_MODEL });
    const g = aiClientFromEnv(
      parseEnv({ ...base, AI_ENABLED: 'true', AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'k' }),
    );
    expect(g).toMatchObject({ name: 'gemini', model: GEMINI_DEFAULT_MODEL });
    const custom = aiClientFromEnv(
      parseEnv({
        ...base,
        AI_ENABLED: 'true',
        AI_PROVIDER: 'gemini',
        GEMINI_API_KEY: 'k',
        AI_MODEL: 'gemini-x',
      }),
    );
    expect(custom?.model).toBe('gemini-x');
  });

  it('anthropic — default EMAS, AI_MODEL majburiy', () => {
    expect(
      aiClientFromEnv(
        parseEnv({ ...base, AI_ENABLED: 'true', AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' }),
      ),
    ).toBeNull();
    expect(() => createProvider('anthropic', { apiKey: 'k' })).toThrow(/AI_MODEL/);
  });

  it('noto‘g‘ri provayder nomi — env xatosi; mock faqat NODE_ENV=test', () => {
    expect(() => parseEnv({ ...base, AI_PROVIDER: 'claude' })).toThrow();
    expect(() => parseEnv({ ...base, AI_PROVIDER: 'mock' })).toThrow();
    expect(
      aiClientFromEnv(parseEnv({ ...base, NODE_ENV: 'test', AI_PROVIDER: 'mock' }))?.model,
    ).toBe('e2e-mock');
    expect(() =>
      aiClientFromEnv({
        AI_ENABLED: true,
        AI_PROVIDER: 'claude' as never,
        AI_MAX_FILE_MB: 10,
        AI_DAILY_LIMIT_PER_COMPANY: 1,
        AI_MODEL: undefined,
        ANTHROPIC_API_KEY: undefined,
      }),
    ).toThrow(/AI_PROVIDER/);
  });

  it('Anthropic transporti ham LlmProvider ostida (chat)', async () => {
    const create = vi.fn(async () => ({
      model: 'c',
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 1, output_tokens: 1 },
    }));
    const p = createLlmProvider(
      createAnthropicTransport({ apiKey: 'k', model: 'c', create: create as never, sleep }),
    );
    expect((await p.chat({ system: 's', messages: [{ role: 'user', content: 'q' }] })).text).toBe(
      'ok',
    );
  });
});
