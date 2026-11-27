import { z } from 'zod';

/**
 * D-180: model javobining QAT'IY sxemasi. Structured output (JSON schema) shaklni so'raydi, lekin javob baribir
 * shu Zod sxemadan o'tadi: sxemadan tashqari maydon (masalan hujjat ichidagi "ko'rsatma" bilan qo'shilgan) yoki
 * noto'g'ri tur — `status = failed`, hech narsa formaga tushmaydi.
 */

export const confidenceSchema = z.enum(['high', 'medium', 'low']);
export const imageQualitySchema = z.enum(['good', 'poor', 'unreadable']);
export type ImageQuality = z.infer<typeof imageQualitySchema>;

const textField = z
  .object({ value: z.string().max(1000).nullable(), confidence: confidenceSchema })
  .strict();
const quantityField = z
  .object({
    value: z.string().max(100).nullable(),
    unit: z.string().max(50).nullable(),
    confidence: confidenceSchema,
  })
  .strict();

/** Namuna va reaktiv etiketka/CoA — bir xil maydonlar; `analysis_end_date` faqat namunada ishlatiladi. */
export const documentFieldsSchema = z
  .object({
    name: textField,
    // Addendum A: seriya/lot — MAJBURIY ajratiladigan maydon (kalit doim bor; topilmasa value=null)
    series: textField,
    manufacturer: textField,
    manufactured_date: textField,
    expiry_date: textField,
    quantity: quantityField,
    arrival_date: textField,
    analysis_end_date: textField,
  })
  .strict();

export const documentResultSchema = z
  .object({ image_quality: imageQualitySchema, fields: documentFieldsSchema })
  .strict();
export type DocumentResult = z.infer<typeof documentResultSchema>;

export const ND_MAX_REQUIREMENTS = 60;

export const ndRequirementRawSchema = z
  .object({
    kind: z.enum(['equipment', 'reagent']),
    method_name: z.string().max(255).nullable(),
    equipment_category: z.string().max(120).nullable(),
    reagent_name: z.string().max(255).nullable(),
    quantity: z.string().max(50).nullable(),
    unit: z.string().max(30).nullable(),
    confidence: confidenceSchema,
  })
  .strict();

export const ndResultSchema = z
  .object({
    image_quality: imageQualitySchema,
    requirements: z.array(ndRequirementRawSchema).max(ND_MAX_REQUIREMENTS),
  })
  .strict();
export type NdResult = z.infer<typeof ndResultSchema>;

// ---- JSON Schema (structured output, `output_config.format`) — Zod sxemasi bilan qo'lda sinxron ----

const nullableString = { type: ['string', 'null'] } as const;
const confidenceJson = { type: 'string', enum: ['high', 'medium', 'low'] } as const;
const textJson = {
  type: 'object',
  properties: { value: nullableString, confidence: confidenceJson },
  required: ['value', 'confidence'],
  additionalProperties: false,
} as const;

export const DOCUMENT_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    image_quality: { type: 'string', enum: ['good', 'poor', 'unreadable'] },
    fields: {
      type: 'object',
      properties: {
        name: textJson,
        series: textJson,
        manufacturer: textJson,
        manufactured_date: textJson,
        expiry_date: textJson,
        quantity: {
          type: 'object',
          properties: { value: nullableString, unit: nullableString, confidence: confidenceJson },
          required: ['value', 'unit', 'confidence'],
          additionalProperties: false,
        },
        arrival_date: textJson,
        analysis_end_date: textJson,
      },
      required: [
        'name',
        'series',
        'manufacturer',
        'manufactured_date',
        'expiry_date',
        'quantity',
        'arrival_date',
        'analysis_end_date',
      ],
      additionalProperties: false,
    },
  },
  required: ['image_quality', 'fields'],
  additionalProperties: false,
};

export const ND_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    image_quality: { type: 'string', enum: ['good', 'poor', 'unreadable'] },
    requirements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['equipment', 'reagent'] },
          method_name: nullableString,
          equipment_category: nullableString,
          reagent_name: nullableString,
          quantity: nullableString,
          unit: nullableString,
          confidence: confidenceJson,
        },
        required: [
          'kind',
          'method_name',
          'equipment_category',
          'reagent_name',
          'quantity',
          'unit',
          'confidence',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['image_quality', 'requirements'],
  additionalProperties: false,
};

// ---- HTTP so'rov sxemalari ----

export const extractNdBodySchema = z.object({
  ndId: z.string().uuid('ND identifikatori noto‘g‘ri'),
});
export type ExtractNdBody = z.infer<typeof extractNdBodySchema>;

/** Namuna/reaktiv yaratishda AI ekstraksiyasiga havola (D-181) — server AI qiymatini o'z jurnalidan oladi. */
export const aiReviewRefSchema = z
  .object({ extractionId: z.string().uuid('AI ekstraksiya identifikatori noto‘g‘ri') })
  .strict();
export type AiReviewRef = z.infer<typeof aiReviewRefSchema>;

export const companyAiToggleSchema = z.object({ enabled: z.boolean() }).strict();
