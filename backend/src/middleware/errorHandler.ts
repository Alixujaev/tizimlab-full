import type { ErrorRequestHandler } from 'express';
import type { Logger } from 'winston';
import { AppError } from '../utils/errors.js';

interface PgError {
  code: string;
  constraint?: string;
}

const isPgError = (err: unknown): err is PgError =>
  typeof err === 'object' &&
  err !== null &&
  typeof (err as { code?: unknown }).code === 'string' &&
  /^[0-9A-Z]{5}$/.test((err as { code: string }).code);

/** Xatoni D-22 formatiga o'giradi. Ichki tafsilot (stack, SQL) faqat logga yoziladi. */
function toAppError(err: unknown): AppError | null {
  if (err instanceof AppError) return err;
  if (isPgError(err)) {
    if (err.code === '23505')
      return new AppError(409, 'CONFLICT', 'Bunday yozuv allaqachon mavjud');
    if (err.code === '23503')
      return new AppError(409, 'CONFLICT', "Bog'langan yozuv mavjud emas yoki ishlatilmoqda");
    if (err.code === '22P02')
      return new AppError(400, 'VALIDATION_ERROR', "Qiymat formati noto'g'ri");
  }
  // body-parser xatolari (noto'g'ri JSON, juda katta body)
  const status = (err as { status?: unknown; type?: unknown } | null)?.status;
  const type = (err as { type?: unknown } | null)?.type;
  if (status === 413) return new AppError(413, 'PAYLOAD_TOO_LARGE', "So'rov hajmi juda katta");
  if (status === 400 && type === 'entity.parse.failed')
    return new AppError(400, 'VALIDATION_ERROR', "JSON formati noto'g'ri");
  return null;
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req, res, _next) => {
    const appErr = toAppError(err);
    const requestId = req.id;
    if (!appErr) {
      logger.error('unhandled', { requestId, error: err });
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Ichki server xatosi', requestId },
      });
      return;
    }
    if (appErr.status >= 500) logger.error('app error', { requestId, error: err });
    else logger.debug('client error', { requestId, code: appErr.code });
    res.status(appErr.status).json({
      error: {
        code: appErr.code,
        message: appErr.message,
        ...(appErr.details !== undefined ? { details: appErr.details } : {}),
        requestId,
      },
    });
  };
}
