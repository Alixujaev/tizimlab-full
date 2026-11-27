import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination.js';

export const oosStatusEnum = z.enum(['open', 'investigating', 'closed']);

export const createOosSchema = z
  .object({
    sampleId: z.string().uuid('Namuna ID si noto‘g‘ri'),
    protocolId: z.string().uuid('Protokol ID si noto‘g‘ri').nullable().optional(),
    testName: z.string().trim().min(1, 'Ko‘rsatkich nomi kiritilishi shart').max(255),
    resultValue: z.string().trim().min(1, 'Natija kiritilishi shart').max(100),
    specLimit: z.string().trim().min(1, 'Spetsifikatsiya chegarasi kiritilishi shart').max(255),
    unit: z.string().trim().max(30).nullable().optional(),
    description: z.string().trim().max(5000).nullable().optional(),
  })
  .strict();
export type CreateOosInput = z.infer<typeof createOosSchema>;

export const listOosQuerySchema = paginationQuerySchema.extend({
  status: oosStatusEnum.optional(),
  search: z.string().trim().max(200).optional(),
  sampleId: z.string().uuid().optional(),
});
export type ListOosQuery = z.infer<typeof listOosQuerySchema>;

export const oosIdParamSchema = z.object({ id: z.string().uuid('OOS ID si noto‘g‘ri') });

export const oosNoteSchema = z.object({ text: z.string().trim().min(1, 'Izoh bo‘sh').max(5000) }).strict();

/** Holat: open → investigating (yozuvchilar), → closed (faqat lab_head, ildiz sabab bilan). AI qaror chiqarmaydi. */
export const oosStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('investigating'), note: z.string().trim().max(5000).optional() }).strict(),
  z
    .object({
      status: z.literal('closed'),
      rootCause: z.string().trim().min(5, 'Ildiz sabab kamida 5 belgi').max(5000),
      closureNote: z.string().trim().min(5, 'Yopish izohi kamida 5 belgi').max(5000),
    })
    .strict(),
]);
export type OosStatusInput = z.infer<typeof oosStatusSchema>;

// ---- Chat ----

export const createSessionSchema = z
  .object({
    caseId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

export const sessionIdParamSchema = z.object({ id: z.string().uuid('Sessiya ID si noto‘g‘ri') });
export const listSessionsQuerySchema = z.object({
  caseId: z.string().uuid().optional(),
});

export const CHAT_MAX_QUESTION = 4000;

export const chatMessageSchema = z
  .object({
    content: z.string().trim().min(1, 'Savol bo‘sh').max(CHAT_MAX_QUESTION),
    attachmentIds: z.array(z.string().uuid()).max(3).optional(),
    peakFileId: z.string().uuid().nullable().optional(),
    filters: z
      .object({
        substanceName: z.string().trim().max(500).nullable().optional(),
        ndId: z.string().uuid().nullable().optional(),
        equipmentId: z.string().uuid().nullable().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

// ---- LLM javobi (qat'iy; manba havolalari serverda tekshiriladi) ----

export const chatAnswerSchema = z
  .object({
    internal_findings: z
      .array(z.object({ source_ref: z.string().max(10), summary: z.string().max(2000) }).strict())
      .max(12),
    peak_assessment: z.string().max(4000).nullable(),
    probable_causes: z
      .array(
        z
          .object({ cause: z.string().max(1000), basis: z.enum(['internal', 'general']), source_refs: z.array(z.string().max(10)).max(8) })
          .strict(),
      )
      .max(10),
    recommended_checks: z.array(z.string().max(1000)).max(12),
    general_knowledge: z.array(z.string().max(2000)).max(10),
  })
  .strict();
export type ChatAnswer = z.infer<typeof chatAnswerSchema>;

const str = { type: 'string' } as const;
export const CHAT_ANSWER_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    internal_findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: { source_ref: str, summary: str },
        required: ['source_ref', 'summary'],
        additionalProperties: false,
      },
    },
    peak_assessment: { type: ['string', 'null'] },
    probable_causes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          cause: str,
          basis: { type: 'string', enum: ['internal', 'general'] },
          source_refs: { type: 'array', items: str },
        },
        required: ['cause', 'basis', 'source_refs'],
        additionalProperties: false,
      },
    },
    recommended_checks: { type: 'array', items: str },
    general_knowledge: { type: 'array', items: str },
  },
  required: ['internal_findings', 'peak_assessment', 'probable_causes', 'recommended_checks', 'general_knowledge'],
  additionalProperties: false,
};
