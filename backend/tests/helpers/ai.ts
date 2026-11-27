import {
  AiUpstreamError,
  type AiClient,
  type AiExtractRequest,
} from '../../src/modules/ai/ai.client.js';
import type { DocumentResult } from '../../src/modules/ai/ai.schemas.js';

/** CI da haqiqiy Claude API chaqirilmaydi: mock klient navbatdagi javobni (yoki xatoni) qaytaradi. */
export class MockAiClient implements AiClient {
  readonly model = 'mock-model';
  readonly calls: AiExtractRequest[] = [];
  private queue: (unknown | AiUpstreamError)[] = [];

  respond(...items: (unknown | AiUpstreamError)[]): this {
    this.queue.push(...items);
    return this;
  }

  reset(): void {
    this.calls.length = 0;
    this.queue.length = 0;
  }

  async extract(req: AiExtractRequest) {
    this.calls.push(req);
    const next = this.queue.shift();
    if (next instanceof AiUpstreamError) throw next;
    if (next === undefined) throw new AiUpstreamError('AI_UPSTREAM_ERROR');
    return { json: next, model: this.model, inputTokens: 1200, outputTokens: 300 };
  }
}

type Field = { value: string | null; confidence: 'high' | 'medium' | 'low' };
const f = (value: string | null, confidence: Field['confidence'] = 'high'): Field => ({
  value,
  confidence,
});

/** Etiketka/CoA fixture javobi (model "xom" formatida — sanalar yozilganicha). */
export function docResult(
  over: Partial<Record<keyof DocumentResult['fields'], unknown>> = {},
): DocumentResult {
  return {
    image_quality: 'good',
    fields: {
      name: f('Ibuprofen'),
      series: f('B-2027-01'),
      manufacturer: f('Pharma LLC'),
      manufactured_date: f('01.05.2026'),
      expiry_date: f('04/2028'),
      quantity: { value: '25', unit: 'kg', confidence: 'high' },
      arrival_date: f(null),
      analysis_end_date: f(null),
      ...(over as Partial<DocumentResult['fields']>),
    },
  };
}

export function ndResult(
  requirements: {
    kind: 'equipment' | 'reagent';
    method_name?: string | null;
    equipment_category?: string | null;
    reagent_name?: string | null;
    quantity?: string | null;
    unit?: string | null;
    confidence?: 'high' | 'medium' | 'low';
  }[],
  image_quality: 'good' | 'poor' | 'unreadable' = 'good',
) {
  return {
    image_quality,
    requirements: requirements.map((r) => ({
      method_name: null,
      equipment_category: null,
      reagent_name: null,
      quantity: null,
      unit: null,
      confidence: 'high',
      ...r,
    })),
  };
}
