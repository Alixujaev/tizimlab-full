import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';

/** D-141: Sensor ingest rate limit — bitta IP'dan 1 daqiqada 120 ta so'rov (testlarda moslanuvchan). */
export const INGEST_LIMIT = { max: 120, windowMs: 60 * 1000 } as const;

export interface IngestLimitOptions {
  max: number;
  windowMs: number;
}

export function createIngestLimiter({
  max,
  windowMs,
}: IngestLimitOptions = INGEST_LIMIT): RequestHandler {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: "Sensor ma'lumotlarini qabul qilish chegarasi oshdi, keyinroq urinib ko'ring",
          requestId: req.id,
        },
      });
    },
  });
}
