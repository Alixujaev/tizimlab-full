import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination.js';

export const stabilityStudyStatusEnum = z.enum(['active', 'completed']);
export const stabilityCheckpointStatusEnum = z.enum(['pending', 'in_progress', 'completed', 'overdue']);
export const stabilityResultStatusEnum = z.enum(['pass', 'fail', 'warning']);

export const idParamSchema = z.object({
  id: z.string().uuid('Yaroqsiz identifikator'),
});

export const studyIdParamSchema = z.object({
  id: z.string().uuid('Yaroqsiz study identifikatori'),
});

export const checkpointIdParamSchema = z.object({
  id: z.string().uuid('Yaroqsiz checkpoint identifikatori'),
});

export const parameterParamSchema = z.object({
  id: z.string().uuid('Yaroqsiz checkpoint identifikatori'),
  parameter: z.string().trim().min(1, 'Parametr nomi talab qilinadi'),
});

export const stabilityParameterInputSchema = z.object({
  parameter: z.string().trim().min(1, 'Parametr nomi kiritilishi shart').max(200),
  initialValue: z.string().trim().max(200).nullable().optional(),
  specification: z.string().trim().max(500).nullable().optional(),
});

export const stabilityCheckpointInputSchema = z.object({
  intervalTag: z.string().trim().min(1, 'Checkpoint nomi kiritilishi shart').max(50),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana formati YYYY-MM-DD bo‘lishi shart'),
  assignedTo: z.string().uuid('Yaroqsiz foydalanuvchi identifikatori').nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const createStudySchema = z.object({
  sampleId: z.string().uuid('Namuna identifikatori talab qilinadi'),
  storageConditions: z.string().trim().max(500).nullable().optional(),
  startedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Boshlangan sana formati YYYY-MM-DD bo‘lishi shart').optional(),
  parameters: z.array(stabilityParameterInputSchema).optional(),
  checkpoints: z.array(stabilityCheckpointInputSchema).optional(),
});

export const createCheckpointSchema = z.object({
  intervalTag: z.string().trim().min(1, 'Checkpoint nomi kiritilishi shart').max(50),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana formati YYYY-MM-DD bo‘lishi shart'),
  assignedTo: z.string().uuid('Yaroqsiz foydalanuvchi identifikatori').nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const updateCheckpointSchema = z.object({
  intervalTag: z.string().trim().min(1, 'Checkpoint nomi kiritilishi shart').max(50).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana formati YYYY-MM-DD bo‘lishi shart').optional(),
  assignedTo: z.string().uuid('Yaroqsiz foydalanuvchi identifikatori').nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  status: stabilityCheckpointStatusEnum.optional(),
});

export const recordSingleResultSchema = z.object({
  id: z.string().uuid().optional(),
  parameter: z.string().trim().min(1).max(200),
  currentValue: z.string().trim().min(1, 'Natija qiymati kiritilishi shart').max(200),
  specification: z.string().trim().max(500).nullable().optional(),
  resultStatus: stabilityResultStatusEnum,
});

export const recordResultsSchema = z.object({
  results: z.array(recordSingleResultSchema).min(1, 'Kamida bitta natija kiritilishi kerak'),
});

export const addParameterSchema = z.object({
  parameter: z.string().trim().min(1, 'Parametr nomi kiritilishi shart').max(200),
  initialValue: z.string().trim().max(200).nullable().optional(),
  specification: z.string().trim().max(500).nullable().optional(),
  currentValue: z.string().trim().max(200).nullable().optional(),
  resultStatus: stabilityResultStatusEnum.optional(),
});

export const completeCheckpointSchema = z.object({
  notes: z.string().trim().max(500).nullable().optional(),
});

export const listStudiesQuerySchema = paginationQuerySchema.extend({
  status: stabilityStudyStatusEnum.optional(),
  sampleId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
});

export const listCheckpointsQuerySchema = z.object({
  studyId: z.string().uuid().optional(),
  status: stabilityCheckpointStatusEnum.optional(),
  assignedTo: z.string().uuid().optional(),
  dueSoon: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export type CreateStudyInput = z.infer<typeof createStudySchema>;
export type CreateCheckpointInput = z.infer<typeof createCheckpointSchema>;
export type UpdateCheckpointInput = z.infer<typeof updateCheckpointSchema>;
export type RecordResultsInput = z.infer<typeof recordResultsSchema>;
export type AddParameterInput = z.infer<typeof addParameterSchema>;
export type CompleteCheckpointInput = z.infer<typeof completeCheckpointSchema>;
export type ListStudiesQuery = z.infer<typeof listStudiesQuerySchema>;
export type ListCheckpointsQuery = z.infer<typeof listCheckpointsQuerySchema>;
