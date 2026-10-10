import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination.js';

export const idParamSchema = z.object({
  id: z.string().uuid('Yaroqsiz identifikator'),
});

export const createSensorConfigSchema = z
  .object({
    sensorId: z.string().trim().min(1, 'Sensor identifikatori kiritilishi shart').max(100),
    locationName: z.string().trim().min(1, 'Joylashuv nomi kiritilishi shart').max(255),
    tempMin: z.coerce
      .number()
      .min(-100, 'Harorat -100 dan kam bo‘lmasligi kerak')
      .max(100, 'Harorat 100 dan yuqori bo‘lmasligi kerak'),
    tempMax: z.coerce
      .number()
      .min(-100, 'Harorat -100 dan kam bo‘lmasligi kerak')
      .max(100, 'Harorat 100 dan yuqori bo‘lmasligi kerak'),
    humidityMin: z.coerce
      .number()
      .min(0, 'Namlik 0 dan kam bo‘lmasligi kerak')
      .max(100, 'Namlik 100 dan yuqori bo‘lmasligi kerak')
      .nullable()
      .optional(),
    humidityMax: z.coerce
      .number()
      .min(0, 'Namlik 0 dan kam bo‘lmasligi kerak')
      .max(100, 'Namlik 100 dan yuqori bo‘lmasligi kerak')
      .nullable()
      .optional(),
    isActive: z.boolean().default(true),
    apiKey: z.string().trim().max(255).nullable().optional(),
  })
  .refine((data) => data.tempMin < data.tempMax, {
    message: 'Minimal harorat maksimal haroratdan kichik bo‘lishi shart',
    path: ['tempMin'],
  })
  .refine(
    (data) => {
      if (data.humidityMin != null && data.humidityMax != null) {
        return data.humidityMin < data.humidityMax;
      }
      return true;
    },
    {
      message: 'Minimal namlik maksimal namlikdan kichik bo‘lishi shart',
      path: ['humidityMin'],
    },
  );

export const updateSensorConfigSchema = z
  .object({
    sensorId: z.string().trim().min(1).max(100).optional(),
    locationName: z.string().trim().min(1).max(255).optional(),
    tempMin: z.coerce.number().min(-100).max(100).optional(),
    tempMax: z.coerce.number().min(-100).max(100).optional(),
    humidityMin: z.coerce.number().min(0).max(100).nullable().optional(),
    humidityMax: z.coerce.number().min(0).max(100).nullable().optional(),
    isActive: z.boolean().optional(),
    apiKey: z.string().trim().max(255).nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.tempMin != null && data.tempMax != null) {
        return data.tempMin < data.tempMax;
      }
      return true;
    },
    {
      message: 'Minimal harorat maksimal haroratdan kichik bo‘lishi shart',
      path: ['tempMin'],
    },
  )
  .refine(
    (data) => {
      if (data.humidityMin != null && data.humidityMax != null) {
        return data.humidityMin < data.humidityMax;
      }
      return true;
    },
    {
      message: 'Minimal namlik maksimal namlikdan kichik bo‘lishi shart',
      path: ['humidityMin'],
    },
  );

export const createManualReadingSchema = z.object({
  sensorConfigId: z.string().uuid('Yaroqsiz sensor konfiguratsiya identifikatori'),
  temperature: z.coerce
    .number()
    .min(-100, 'Harorat -100 dan kam bo‘lmasligi kerak')
    .max(100, 'Harorat 100 dan yuqori bo‘lmasligi kerak'),
  humidity: z.coerce
    .number()
    .min(0, 'Namlik 0 dan kam bo‘lmasligi kerak')
    .max(100, 'Namlik 100 dan yuqori bo‘lmasligi kerak')
    .nullable()
    .optional(),
  recordedAt: z.string().datetime().optional(),
});

export const ingestReadingSchema = z.object({
  sensorId: z.string().trim().max(100).optional(),
  sensorConfigId: z.string().uuid().optional(),
  apiKey: z.string().trim().max(255).optional(),
  temperature: z.coerce
    .number()
    .min(-100, 'Harorat -100 dan kam bo‘lmasligi kerak')
    .max(100, 'Harorat 100 dan yuqori bo‘lmasligi kerak'),
  humidity: z.coerce
    .number()
    .min(0, 'Namlik 0 dan kam bo‘lmasligi kerak')
    .max(100, 'Namlik 100 dan yuqori bo‘lmasligi kerak')
    .nullable()
    .optional(),
  recordedAt: z.string().datetime().optional(),
});

export const listReadingsQuerySchema = paginationQuerySchema.extend({
  sensorConfigId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  isManual: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  alertOnly: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const listAlertsQuerySchema = paginationQuerySchema.extend({
  sensorConfigId: z.string().uuid().optional(),
  unresolvedOnly: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const resolveAlertSchema = z.object({
  resolutionNote: z.string().trim().max(1000).nullable().optional(),
});

export type CreateSensorConfigInput = z.infer<typeof createSensorConfigSchema>;
export type UpdateSensorConfigInput = z.infer<typeof updateSensorConfigSchema>;
export type CreateManualReadingInput = z.infer<typeof createManualReadingSchema>;
export type IngestReadingInput = z.infer<typeof ingestReadingSchema>;
export type ListReadingsQuery = z.infer<typeof listReadingsQuerySchema>;
export type ListAlertsQuery = z.infer<typeof listAlertsQuerySchema>;
export type ResolveAlertInput = z.infer<typeof resolveAlertSchema>;
