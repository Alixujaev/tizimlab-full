import type { RequestHandler } from 'express';
import multer from 'multer';
import { AppError } from '../../utils/errors.js';

/**
 * Bitta faylni xotiraga qabul qiladi (spec §12: multer memory storage) — diskka hech narsa yozilmaydi.
 * Limitdan katta fayl 413; kutilmagan maydon/ortiqcha fayl 400. Tur tekshiruvi `assertAllowedFile` da (magic bytes).
 */
export function uploadSingle(field: string, maxBytes: number): RequestHandler {
  const handler = multer({
    storage: multer.memoryStorage(),
    // Kirill/o'zbek fayl nomlari buzilmasligi uchun (busboy standarti latin1)
    defParamCharset: 'utf8',
    limits: { fileSize: maxBytes, files: 1, fields: 10, fieldSize: 1024 },
  }).single(field);

  return (req, res, next) => {
    handler(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new AppError(413, 'PAYLOAD_TOO_LARGE', 'Fayl hajmi ruxsat etilgan chegaradan katta', {
              maxBytes,
            }),
          );
        }
        return next(new AppError(400, 'VALIDATION_ERROR', 'Fayl yuborish formati noto‘g‘ri'));
      }
      next(err);
    });
  };
}
