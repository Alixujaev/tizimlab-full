import { CHAT_ANSWER_JSON_SCHEMA } from '../oos/oos.schemas.js';
import { AI_PEAKS_JSON_SCHEMA } from '../peaks/peaks.schemas.js';
import type { AiExtractRequest } from './ai.client.js';
import { createLlmProvider, type LlmProvider } from './ai.provider.js';
import { DOCUMENT_JSON_SCHEMA, ND_JSON_SCHEMA } from './ai.schemas.js';

/**
 * D-198: E2E uchun deterministik AI (AI_MOCK=1). Faqat NODE_ENV=test da ruxsat etiladi — env.ts va
 * `aiClientFromEnv` ikkalasi tekshiradi; production/development'da ishga tushish xato bilan to'xtaydi.
 * Tashqi API'ga hech qachon murojaat qilmaydi. Javob shakli so'ralgan JSON schema bo'yicha tanlanadi.
 */

export const MOCK_DOCUMENT = {
  image_quality: 'good',
  fields: {
    name: { value: 'E2E Ibuprofen', confidence: 'high' },
    series: { value: 'E2E-SER-01', confidence: 'high' },
    manufacturer: { value: 'E2E Pharma LLC', confidence: 'medium' },
    manufactured_date: { value: '01.05.2026', confidence: 'high' },
    expiry_date: { value: '04/2028', confidence: 'low' },
    quantity: { value: '25', unit: 'kg', confidence: 'high' },
    arrival_date: { value: null, confidence: 'low' },
    analysis_end_date: { value: null, confidence: 'low' },
  },
} as const;

function textOf(req: AiExtractRequest): string {
  return (req.parts ?? [])
    .filter((p): p is { kind: 'text'; text: string } => p.kind === 'text')
    .map((p) => p.text)
    .join('\n');
}

export function mockResponse(req: AiExtractRequest): unknown {
  const schema = req.jsonSchema;
  if (schema === DOCUMENT_JSON_SCHEMA) return MOCK_DOCUMENT;
  if (schema === ND_JSON_SCHEMA) {
    return {
      image_quality: 'good',
      requirements: [
        {
          kind: 'equipment',
          method_name: 'Assay',
          equipment_category: 'HPLC',
          reagent_name: null,
          quantity: null,
          unit: null,
          confidence: 'high',
        },
      ],
    };
  }
  if (schema === AI_PEAKS_JSON_SCHEMA) {
    return {
      image_quality: 'good',
      peaks: [
        {
          peak_name: 'Main',
          retention_time: '5.02',
          area: '1200',
          height: null,
          area_percent: '99.4',
          tailing: '1.1',
          plates: '9000',
          resolution: null,
          confidence: 'high',
        },
      ],
    };
  }
  if (schema === CHAT_ANSWER_JSON_SCHEMA) {
    const hasSource = /\[S1\]/.test(textOf(req));
    return {
      internal_findings: hasSource
        ? [{ source_ref: 'S1', summary: 'E2E: ichki bazada o‘xshash holat topildi' }]
        : [],
      peak_assessment: null,
      probable_causes: [
        hasSource
          ? { cause: 'E2E: standart eritma', basis: 'internal', source_refs: ['S1'] }
          : { cause: 'E2E: umumiy sabab', basis: 'general', source_refs: [] },
      ],
      recommended_checks: ['E2E: tizim muvofiqligini tekshiring'],
      general_knowledge: ['E2E: OOS I bosqich laboratoriya tergovi'],
    };
  }
  // OCR (rag.indexer) — { image_quality, text }
  const props = (schema.properties ?? {}) as Record<string, unknown>;
  if ('text' in props) return { image_quality: 'good', text: 'E2E OCR matni' };
  return {};
}

/** D-201: mock ham `LlmProvider` ostida — Zod tekshiruvi haqiqiy provayderlardagi kabi ishlaydi. */
export function createMockAiClient(): LlmProvider {
  return createLlmProvider({
    name: 'mock',
    model: 'e2e-mock',
    async extract(req) {
      return { json: mockResponse(req), model: 'e2e-mock', inputTokens: 10, outputTokens: 5 };
    },
    async chat() {
      return { text: 'E2E mock javob', model: 'e2e-mock', inputTokens: 10, outputTokens: 5 };
    },
  });
}
