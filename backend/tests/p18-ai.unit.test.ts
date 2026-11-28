import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import {
  AiUpstreamError,
  createAnthropicTransport,
  mapAnthropicError,
  parseMessageJson,
} from '../src/modules/ai/ai.client.js';
import { aiClientFromEnv } from '../src/modules/ai/ai.config.js';
import { assertAiFile, countPdfPages, detectAiFileKind } from '../src/modules/ai/ai.files.js';
import {
  normalizeAiUnit,
  normalizeDate,
  normalizeNumber,
  normalizeText,
} from '../src/modules/ai/ai.normalize.js';
import { DOCUMENT_SYSTEM_PROMPT, ND_SYSTEM_PROMPT } from '../src/modules/ai/ai.prompts.js';
import {
  DOCUMENT_JSON_SCHEMA,
  documentResultSchema,
  ndResultSchema,
} from '../src/modules/ai/ai.schemas.js';
import { canonicalValue, mapDocumentFields, nameSimilarity } from '../src/modules/ai/ai.service.js';
import { parseEnv } from '../src/config/env.js';
import { fixtures } from './helpers/memoryStorage.js';
import { docResult } from './helpers/ai.js';

/** P18 (D-179, D-180) — AI qatlamining sof qismlari: normallashtirish, sxema, klient o'rami, fayl. */

describe('sana normallashtirish (deterministik, sana-satr)', () => {
  it.each([
    ['2027-05-31', '2027-05-31'],
    ['2027/05/31', '2027-05-31'],
    ['31.05.2027', '2027-05-31'],
    ['31/05/2027', '2027-05-31'],
    ['31-05-2027', '2027-05-31'],
    ['1.5.2027', '2027-05-01'],
    ['31.05.27', '2027-05-31'],
    ['05/2027', '2027-05-31'],
    ['05.2027', '2027-05-31'],
    ['02/2028', '2028-02-29'], // kabisa yili — oyning oxirgi kuni
    ['02.2027', '2027-02-28'],
    ['2027-05', '2027-05-31'],
    ['2027/11', '2027-11-30'],
    ['May 2027', '2027-05-31'],
    ['31 May 2027', '2027-05-31'],
    ['май 2027', '2027-05-31'],
    ['15 мая 2027', '2027-05-15'],
    ['  12.03.2026  ', '2026-03-12'],
    ['2027-05-31T00:00:00Z', '2027-05-31'],
  ])('%s → %s', (raw, iso) => {
    expect(normalizeDate(raw)).toBe(iso);
  });

  it.each([
    '31.02.2027', // kalendarda yo'q
    '13/2027', // oy 13
    '2027-13-01',
    '00.05.2027',
    '2027', // faqat yil — taxmin qilinmaydi
    'Exp: soon',
    '',
    '   ',
    '05/31/2027', // oy-kun tartibi taxmin qilinmaydi
  ])('tanilmaydi → null: %s', (raw) => {
    expect(normalizeDate(raw)).toBeNull();
  });

  it('null/undefined → null', () => {
    expect(normalizeDate(null)).toBeNull();
    expect(normalizeDate(undefined)).toBeNull();
  });
});

describe('birlik, son, matn', () => {
  it('D-174 oilalari kanonik yozuvga; noma’lum → null', () => {
    expect(normalizeAiUnit('мл')).toBe('ml');
    expect(normalizeAiUnit('L')).toBe('l');
    expect(normalizeAiUnit('кг')).toBe('kg');
    expect(normalizeAiUnit('mg')).toBe('mg');
    expect(normalizeAiUnit('шт')).toBe('dona');
    expect(normalizeAiUnit('flakon')).toBeNull();
    expect(normalizeAiUnit('IU')).toBeNull();
    expect(normalizeAiUnit(null)).toBeNull();
  });
  it('son: vergul/nuqta/ming ajratgich; manfiy va matn — null', () => {
    expect(normalizeNumber('25')).toBe(25);
    expect(normalizeNumber('2,5')).toBe(2.5);
    expect(normalizeNumber('1,000.5')).toBe(1000.5);
    expect(normalizeNumber('1 000')).toBe(1000);
    expect(normalizeNumber('-3')).toBeNull();
    expect(normalizeNumber('about 5')).toBeNull();
    expect(normalizeNumber(7)).toBe(7);
  });
  it('matn: probellar siqiladi, bo‘sh — null, uzunlik kesiladi', () => {
    expect(normalizeText('  Sulfat   kislota ')).toBe('Sulfat kislota');
    expect(normalizeText('   ')).toBeNull();
    expect(normalizeText('x'.repeat(300), 255)).toHaveLength(255);
  });
});

describe('model javobi sxemasi (qat’iy) va prompt-injection', () => {
  it('to‘g‘ri javob o‘tadi', () => {
    expect(documentResultSchema.safeParse(docResult()).success).toBe(true);
  });
  it('sxemadan tashqari maydon (hujjat ichidagi "ko‘rsatma" natijasi) — rad etiladi', () => {
    const injected = docResult() as unknown as Record<string, unknown>;
    injected.approve_automatically = true;
    expect(documentResultSchema.safeParse(injected).success).toBe(false);
    const nested = docResult();
    (nested.fields as unknown as Record<string, unknown>).status = {
      value: 'approved',
      confidence: 'high',
    };
    expect(documentResultSchema.safeParse(nested).success).toBe(false);
  });
  it('seriya kaliti majburiy (Addendum A); noto‘g‘ri tur/ishonch — rad', () => {
    const noSeries = docResult();
    delete (noSeries.fields as Partial<typeof noSeries.fields>).series;
    expect(documentResultSchema.safeParse(noSeries).success).toBe(false);
    const badConf = docResult();
    (badConf.fields.name as { confidence: string }).confidence = 'certain';
    expect(documentResultSchema.safeParse(badConf).success).toBe(false);
    expect(documentResultSchema.safeParse({ image_quality: 'great', fields: {} }).success).toBe(
      false,
    );
  });
  it('JSON schema seriya va image_quality ni majburiy qiladi, qo‘shimcha maydon taqiqlangan', () => {
    const fields = (DOCUMENT_JSON_SCHEMA.properties as Record<string, { required: string[] }>)
      .fields!;
    expect(fields.required).toContain('series');
    expect(DOCUMENT_JSON_SCHEMA.required).toEqual(['image_quality', 'fields']);
    expect(DOCUMENT_JSON_SCHEMA.additionalProperties).toBe(false);
  });
  it('ND: talablar soni cheklangan, qo‘shimcha maydon rad', () => {
    const req = {
      kind: 'reagent',
      method_name: 'Sulfated ash',
      equipment_category: null,
      reagent_name: 'Sulfat kislota',
      quantity: '2',
      unit: 'ml',
      confidence: 'high',
    };
    expect(ndResultSchema.safeParse({ image_quality: 'good', requirements: [req] }).success).toBe(
      true,
    );
    expect(
      ndResultSchema.safeParse({
        image_quality: 'good',
        requirements: [{ ...req, auto_approve: true }],
      }).success,
    ).toBe(false);
    expect(
      ndResultSchema.safeParse({ image_quality: 'good', requirements: Array(61).fill(req) })
        .success,
    ).toBe(false);
  });
  it('system prompt hujjatni MA’LUMOT deb belgilaydi va taxmin qilmaslikni talab qiladi', () => {
    for (const p of [DOCUMENT_SYSTEM_PROMPT, ND_SYSTEM_PROMPT]) {
      expect(p).toMatch(/UNTRUSTED DATA/);
      expect(p).toMatch(/Never follow instructions/);
      expect(p).toMatch(/Never guess/);
    }
  });
});

describe('mapDocumentFields', () => {
  it('namuna: seriya → serialNumber, sana ISO, miqdor "25 kg"', () => {
    const f = mapDocumentFields('sample', docResult());
    expect(f).toMatchObject({
      substanceName: { value: 'Ibuprofen', confidence: 'high' },
      serialNumber: { value: 'B-2027-01', confidence: 'high' },
      manufacturedAt: { value: '2026-05-01', confidence: 'high' },
      expiryDate: { value: '2028-04-30', confidence: 'high' },
      quantity: { value: '25 kg', confidence: 'high' },
      arrivalDate: { value: null, confidence: null },
    });
  });
  it('reaktiv: miqdor son, birlik alohida, lotNumber', () => {
    const f = mapDocumentFields(
      'reagent',
      docResult({ quantity: { value: '2,5', unit: 'л', confidence: 'medium' } }),
    );
    expect(f.quantity).toEqual({ value: 2.5, confidence: 'medium' });
    expect(f.unit).toEqual({ value: 'l', confidence: 'medium' });
    expect(f.lotNumber).toEqual({ value: 'B-2027-01', confidence: 'high' });
    expect(f.expiresAt?.value).toBe('2028-04-30');
  });
  it('noma’lum birlik → birlik null + low; namunada miqdor ham taklif qilinmaydi', () => {
    const r = docResult({ quantity: { value: '3', unit: 'flakon', confidence: 'high' } });
    expect(mapDocumentFields('reagent', r).unit).toEqual({ value: null, confidence: 'low' });
    expect(mapDocumentFields('sample', r).quantity).toEqual({ value: null, confidence: 'low' });
  });
  it('tanilmagan sana → null + low (taxmin yo‘q)', () => {
    const r = docResult({ expiry_date: { value: '05/31/2027', confidence: 'high' } });
    expect(mapDocumentFields('sample', r).expiryDate).toEqual({ value: null, confidence: 'low' });
  });
  it('muddat ishlab chiqarilgandan oldin — ikkalasi low', () => {
    const r = docResult({ expiry_date: { value: '01.01.2026', confidence: 'high' } });
    const f = mapDocumentFields('sample', r);
    expect(f.expiryDate).toEqual({ value: '2026-01-01', confidence: 'low' });
    expect(f.manufacturedAt?.confidence).toBe('low');
  });
  it.each(['poor', 'unreadable'] as const)('sifat %s → barcha maydonlar null', (q) => {
    const f = mapDocumentFields('sample', { ...docResult(), image_quality: q });
    expect(Object.values(f).every((v) => v.value === null)).toBe(true);
  });
});

describe('o‘xshashlik va kanonik qiymat', () => {
  it('nameSimilarity', () => {
    expect(nameSimilarity('Sulfat kislota', ' sulfat  KISLOTA ')).toBe(1);
    expect(nameSimilarity('Sulfat kislota 96%', 'Sulfat kislota')).toBeGreaterThanOrEqual(0.5);
    expect(nameSimilarity('Atseton', 'Natriy xlorid')).toBeLessThan(0.5);
  });
  it('canonicalValue: 25.0 = 25, probellar, mahalliy sana', () => {
    expect(canonicalValue('25.0')).toBe('25');
    expect(canonicalValue(25)).toBe('25');
    expect(canonicalValue('  a   b ')).toBe('a b');
    expect(canonicalValue('')).toBeNull();
    expect(canonicalValue(new Date(2027, 4, 31))).toBe('2027-05-31');
  });
});

function message(over: Partial<Anthropic.Message>): Anthropic.Message {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'test-model',
    content: [{ type: 'text', text: JSON.stringify(docResult()), citations: null }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 50 },
    ...over,
  } as unknown as Anthropic.Message;
}

describe('Anthropic transporti (haqiqiy API chaqirilmaydi)', () => {
  const headers = new Headers();
  const rateLimit = () => new Anthropic.RateLimitError(429, undefined, 'rate', headers);
  const server = () => new Anthropic.InternalServerError(500, undefined, 'boom', headers);
  const bad = () => new Anthropic.BadRequestError(400, undefined, 'bad', headers);
  const sleep = vi.fn(async () => undefined);

  it('so‘rov: model env’dan, structured output JSON schema, PDF document bloki', async () => {
    const create = vi.fn(async (_params: Anthropic.MessageCreateParamsNonStreaming) => message({}));
    const c = createAnthropicTransport({ apiKey: 'k', model: 'env-model', create, sleep });
    const res = await c.extract({
      system: 'sys',
      instruction: 'go',
      files: [{ mediaType: 'application/pdf', data: Buffer.from('%PDF-1.7') }],
      jsonSchema: DOCUMENT_JSON_SCHEMA,
    });
    const params = create.mock.calls[0]![0] as unknown as Anthropic.MessageCreateParamsNonStreaming;
    expect(params.model).toBe('env-model');
    expect(params.output_config?.format).toEqual({
      type: 'json_schema',
      schema: DOCUMENT_JSON_SCHEMA,
    });
    const content = params.messages[0]!.content as Anthropic.ContentBlockParam[];
    expect(content[0]).toMatchObject({
      type: 'document',
      source: { media_type: 'application/pdf' },
    });
    expect(res).toMatchObject({ inputTokens: 100, outputTokens: 50, json: docResult() });
  });

  it('rasm — image bloki (webp)', async () => {
    const create = vi.fn(async (_params: Anthropic.MessageCreateParamsNonStreaming) => message({}));
    const c = createAnthropicTransport({ apiKey: 'k', model: 'm', create, sleep });
    await c.extract({
      system: 's',
      instruction: 'i',
      files: [{ mediaType: 'image/webp', data: Buffer.from('x') }],
      jsonSchema: {},
    });
    const content = (
      create.mock.calls[0]![0] as unknown as Anthropic.MessageCreateParamsNonStreaming
    ).messages[0]!.content as Anthropic.ContentBlockParam[];
    expect(content[0]).toMatchObject({
      type: 'image',
      source: { media_type: 'image/webp', type: 'base64' },
    });
  });

  it('429 va 5xx — qayta urinadi (maks 2), keyin muvaffaqiyat', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(rateLimit())
      .mockRejectedValueOnce(server())
      .mockResolvedValueOnce(message({}));
    const c = createAnthropicTransport({ apiKey: 'k', model: 'm', create, sleep });
    await expect(
      c.extract({
        system: '',
        instruction: '',
        files: [{ mediaType: 'image/png', data: Buffer.alloc(1) }],
        jsonSchema: {},
      }),
    ).resolves.toBeTruthy();
    expect(create).toHaveBeenCalledTimes(3);
  });

  it('urinishlar tugasa — o‘z kodimiz; 400 qayta urinilmaydi', async () => {
    const create = vi.fn().mockRejectedValue(server());
    const c = createAnthropicTransport({ apiKey: 'k', model: 'm', create, sleep });
    const req = {
      system: '',
      instruction: '',
      files: [{ mediaType: 'image/png' as const, data: Buffer.alloc(1) }],
      jsonSchema: {},
    };
    await expect(c.extract(req)).rejects.toMatchObject({ code: 'AI_UPSTREAM_ERROR' });
    expect(create).toHaveBeenCalledTimes(3);
    const create400 = vi.fn().mockRejectedValue(bad());
    await expect(
      createAnthropicTransport({ apiKey: 'k', model: 'm', create: create400, sleep }).extract(req),
    ).rejects.toMatchObject({ code: 'AI_BAD_REQUEST' });
    expect(create400).toHaveBeenCalledTimes(1);
  });

  it('timeout qayta urinilmaydi → AI_TIMEOUT', async () => {
    const create = vi.fn().mockRejectedValue(new Anthropic.APIConnectionTimeoutError());
    const c = createAnthropicTransport({ apiKey: 'k', model: 'm', create, sleep });
    await expect(
      c.extract({
        system: '',
        instruction: '',
        files: [{ mediaType: 'image/png', data: Buffer.alloc(1) }],
        jsonSchema: {},
      }),
    ).rejects.toMatchObject({ code: 'AI_TIMEOUT' });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('xato kodlari xaritasi', () => {
    expect(mapAnthropicError(rateLimit()).code).toBe('AI_UPSTREAM_RATE_LIMITED');
    expect(
      mapAnthropicError(new Anthropic.AuthenticationError(401, undefined, 'x', headers)).code,
    ).toBe('AI_AUTH_ERROR');
    expect(mapAnthropicError(new Error('net')).code).toBe('AI_UPSTREAM_ERROR');
  });

  it('javob: refusal / max_tokens / yaroqsiz JSON', () => {
    expect(() => parseMessageJson(message({ stop_reason: 'refusal' }))).toThrow(AiUpstreamError);
    expect(() => parseMessageJson(message({ stop_reason: 'refusal' }))).toThrow('AI_REFUSED');
    expect(() => parseMessageJson(message({ stop_reason: 'max_tokens' }))).toThrow('AI_TRUNCATED');
    expect(() =>
      parseMessageJson(message({ content: [{ type: 'text', text: 'not json', citations: null }] })),
    ).toThrow('AI_INVALID_JSON');
  });
});

describe('AI fayl tekshiruvi', () => {
  const webp = () =>
    Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.alloc(4),
      Buffer.from('WEBPVP8 '),
      Buffer.alloc(16),
    ]);
  const gif = () => Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(16)]);
  const f = (buffer: Buffer, name: string) => ({ originalname: name, buffer, size: buffer.length });

  it('turi imzo bo‘yicha: jpeg/png/webp/pdf; gif, docx — yo‘q', () => {
    expect(detectAiFileKind(fixtures.jpeg())).toBe('jpeg');
    expect(detectAiFileKind(fixtures.png())).toBe('png');
    expect(detectAiFileKind(webp())).toBe('webp');
    expect(detectAiFileKind(fixtures.pdf())).toBe('pdf');
    expect(detectAiFileKind(gif())).toBeNull();
    expect(detectAiFileKind(fixtures.docx())).toBeNull();
  });
  it('xatolar: 415 tur, 415 kengaytma mos emas, 413 hajm, 422 bo‘sh, 400 fayl yo‘q', () => {
    expect(() => assertAiFile(f(gif(), 'a.gif'), 1e6, 10)).toThrow(
      expect.objectContaining({ status: 415 }),
    );
    expect(() => assertAiFile(f(fixtures.png(), 'a.pdf'), 1e6, 10)).toThrow(
      expect.objectContaining({ status: 415 }),
    );
    expect(() => assertAiFile(f(fixtures.png(), 'a.png'), 10, 10)).toThrow(
      expect.objectContaining({ status: 413 }),
    );
    expect(() => assertAiFile(f(Buffer.alloc(0), 'a.png'), 1e6, 10)).toThrow(
      expect.objectContaining({ status: 422 }),
    );
    expect(() => assertAiFile(undefined, 1e6, 10)).toThrow(
      expect.objectContaining({ status: 400 }),
    );
    expect(assertAiFile(f(webp(), 'label.webp'), 1e6, 10)).toMatchObject({
      kind: 'webp',
      mime: 'image/webp',
    });
  });
  it('PDF sahifa limiti', () => {
    const pages = (n: number) =>
      Buffer.from(
        `%PDF-1.7\n${'1 0 obj << /Type /Page >> endobj\n'.repeat(n)}<< /Type /Pages >>\n%%EOF`,
      );
    expect(countPdfPages(pages(3))).toBe(3);
    expect(() => assertAiFile(f(pages(11), 'coa.pdf'), 1e6, 10)).toThrow(
      expect.objectContaining({ status: 422, code: 'AI_TOO_MANY_PAGES' }),
    );
    expect(assertAiFile(f(pages(10), 'coa.pdf'), 1e6, 10).kind).toBe('pdf');
  });
});

describe('env va konfiguratsiya (D-179)', () => {
  const base = {
    DATABASE_URL: 'postgres://u:p@localhost/db',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
  };
  it('standart: AI o‘chiq, 10 MB, kunlik limit 200', () => {
    const env = parseEnv(base);
    expect(env).toMatchObject({
      AI_ENABLED: false,
      AI_MAX_FILE_MB: 10,
      AI_DAILY_LIMIT_PER_COMPANY: 200,
    });
    expect(aiClientFromEnv(env)).toBeNull();
  });
  it('AI_ENABLED=true, lekin kalit yoki model yo‘q — klient yo‘q (ishga tushish yiqilmaydi)', () => {
    expect(aiClientFromEnv(parseEnv({ ...base, AI_ENABLED: 'true', AI_MODEL: 'm' }))).toBeNull();
    expect(
      aiClientFromEnv(
        parseEnv({ ...base, AI_ENABLED: 'true', AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' }),
      ),
    ).toBeNull();
  });
  it('uchalasi bo‘lsa — klient, model env’dan', () => {
    const c = aiClientFromEnv(
      parseEnv({
        ...base,
        AI_ENABLED: 'true',
        AI_PROVIDER: 'anthropic',
        ANTHROPIC_API_KEY: 'k',
        AI_MODEL: 'some-model',
      }),
    );
    expect(c?.model).toBe('some-model');
  });
  it('AI_MAX_FILE_MB chegarasi', () => {
    expect(() => parseEnv({ ...base, AI_MAX_FILE_MB: '0' })).toThrow();
    expect(() => parseEnv({ ...base, AI_MAX_FILE_MB: '31' })).toThrow();
  });
});
