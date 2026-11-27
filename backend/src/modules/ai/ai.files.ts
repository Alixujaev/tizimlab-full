import { AppError } from '../../utils/errors.js';
import {
  detectFileType,
  extensionOf,
  sanitizeFilename,
  type IncomingFile,
} from '../files/files.validation.js';
import type { AiMediaType } from './ai.client.js';

/** D-180: AI uchun fayl — faqat JPEG/PNG/WEBP/PDF, imzo (magic bytes) bo'yicha; hajm va PDF sahifa limiti. */

export type AiFileKind = 'jpeg' | 'png' | 'webp' | 'pdf';

const KINDS: Record<AiFileKind, { mime: AiMediaType; ext: string; extensions: string[] }> = {
  jpeg: { mime: 'image/jpeg', ext: 'jpg', extensions: ['jpg', 'jpeg'] },
  png: { mime: 'image/png', ext: 'png', extensions: ['png'] },
  webp: { mime: 'image/webp', ext: 'webp', extensions: ['webp'] },
  pdf: { mime: 'application/pdf', ext: 'pdf', extensions: ['pdf'] },
};

export const AI_ALLOWED_EXTENSIONS = Object.values(KINDS).flatMap((k) => k.extensions);

/** CoA/etiketka — bir necha sahifa; ND — uzunroq. */
export const AI_MAX_PDF_PAGES = { document: 10, nd: 40 } as const;

export interface AiValidatedFile {
  kind: AiFileKind;
  mime: AiMediaType;
  ext: string;
  size: number;
  filename: string;
  buffer: Buffer;
}

function isWebp(buf: Buffer): boolean {
  return (
    buf.length >= 12 &&
    buf.toString('latin1', 0, 4) === 'RIFF' &&
    buf.toString('latin1', 8, 12) === 'WEBP'
  );
}

export function detectAiFileKind(buf: Buffer): AiFileKind | null {
  if (isWebp(buf)) return 'webp';
  const k = detectFileType(buf);
  return k === 'pdf' || k === 'jpeg' || k === 'png' ? k : null;
}

/**
 * PDF sahifalari soni (taxminiy, xavfsiz tomonga): `/Type /Page` obyektlari sanaladi (`/Pages` emas).
 * Siqilgan obyekt oqimlarida topilmasa 0 — limit faqat aniq sanalganda qo'llanadi, qolganini API o'zi cheklaydi.
 */
export function countPdfPages(buf: Buffer): number {
  const text = buf.toString('latin1');
  const matches = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g);
  return matches ? matches.length : 0;
}

export class AiUnsupportedFileError extends AppError {
  constructor(
    message = 'AI uchun fayl turi qo‘llab-quvvatlanmaydi: faqat JPEG, PNG, WEBP yoki PDF',
  ) {
    super(415, 'UNSUPPORTED_MEDIA_TYPE', message, { allowed: AI_ALLOWED_EXTENSIONS });
  }
}

export function assertAiFile(
  file: IncomingFile | undefined,
  maxBytes: number,
  maxPdfPages: number,
): AiValidatedFile {
  if (!file) throw new AppError(400, 'VALIDATION_ERROR', 'Fayl yuborilmadi (`file` maydoni)');
  if (file.size === 0 || file.buffer.length === 0)
    throw new AppError(422, 'EMPTY_FILE', 'Fayl bo‘sh');
  if (file.size > maxBytes) {
    throw new AppError(
      413,
      'PAYLOAD_TOO_LARGE',
      'Fayl hajmi AI uchun ruxsat etilgan chegaradan katta',
      {
        maxBytes,
      },
    );
  }
  const kind = detectAiFileKind(file.buffer);
  if (!kind) throw new AiUnsupportedFileError();
  const info = KINDS[kind];
  const ext = extensionOf(file.originalname);
  if (!info.extensions.includes(ext)) {
    throw new AiUnsupportedFileError('Fayl kengaytmasi uning mazmuniga mos kelmaydi');
  }
  if (kind === 'pdf') {
    const pages = countPdfPages(file.buffer);
    if (pages > maxPdfPages) {
      throw new AppError(
        422,
        'AI_TOO_MANY_PAGES',
        `PDF sahifalari ko‘p: AI uchun ${maxPdfPages} tagacha`,
        {
          maxPages: maxPdfPages,
          pages,
        },
      );
    }
  }
  return {
    kind,
    mime: info.mime,
    ext: info.ext,
    size: file.size,
    filename: sanitizeFilename(file.originalname, info.ext),
    buffer: file.buffer,
  };
}
