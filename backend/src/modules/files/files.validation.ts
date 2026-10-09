import { AppError } from '../../utils/errors.js';

/** Generic `files` moduli limiti — 50MB (spec §12, D-06). */
export const GENERIC_MAX_BYTES = 50 * 1024 * 1024;
/** Namuna pasporti limiti — 20MB, protokol fayli bilan bir xil (D-115). */
export const PASSPORT_MAX_BYTES = 20 * 1024 * 1024;

export type FileKind = 'pdf' | 'doc' | 'docx' | 'jpeg' | 'png';

interface KindInfo {
  mime: string;
  ext: string;
  extensions: readonly string[];
}

export const FILE_KINDS: Record<FileKind, KindInfo> = {
  pdf: { mime: 'application/pdf', ext: 'pdf', extensions: ['pdf'] },
  doc: { mime: 'application/msword', ext: 'doc', extensions: ['doc'] },
  docx: {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ext: 'docx',
    extensions: ['docx'],
  },
  jpeg: { mime: 'image/jpeg', ext: 'jpg', extensions: ['jpg', 'jpeg'] },
  png: { mime: 'image/png', ext: 'png', extensions: ['png'] },
};

export const ALLOWED_EXTENSIONS = Object.values(FILE_KINDS).flatMap((k) => k.extensions);

const startsWith = (buf: Buffer, sig: readonly number[]) =>
  buf.length >= sig.length && sig.every((b, i) => buf[i] === b);

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const OLE2 = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ZIP = [0x50, 0x4b, 0x03, 0x04];

/**
 * Fayl turini mazmunidagi imzo ("magic bytes") bo'yicha aniqlaydi (D-114) — mijoz MIME sarlavhasiga ishonilmaydi.
 * docx — ZIP konteyner; oddiy ZIP'dan ajratish uchun OOXML belgilari (`[Content_Types].xml`, `word/`) qidiriladi
 * (ZIP lokal sarlavhalaridagi fayl nomlari siqilmagan holda saqlanadi).
 */
export function detectFileType(buf: Buffer): FileKind | null {
  if (startsWith(buf, PDF)) return 'pdf';
  if (startsWith(buf, PNG)) return 'png';
  if (startsWith(buf, JPEG)) return 'jpeg';
  if (startsWith(buf, OLE2)) return 'doc';
  if (startsWith(buf, ZIP)) {
    const hasContentTypes = buf.includes('[Content_Types].xml', 0, 'latin1');
    const hasWord = buf.includes('word/', 0, 'latin1');
    return hasContentTypes && hasWord ? 'docx' : null;
  }
  return null;
}

export function extensionOf(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message = 'Fayl turi qo‘llab-quvvatlanmaydi: faqat PDF, DOC, DOCX, JPEG, PNG') {
    super(415, 'UNSUPPORTED_MEDIA_TYPE', message, { allowed: ALLOWED_EXTENSIONS });
  }
}

export interface IncomingFile {
  originalname: string;
  buffer: Buffer;
  size: number;
}

export interface ValidatedFile {
  kind: FileKind;
  mime: string;
  ext: string;
  size: number;
  filename: string;
  buffer: Buffer;
}

/** Fayl yo'q / bo'sh / katta / turi noto'g'ri / kengaytma mazmunga mos emas — mos xato (D-114). */
export function assertAllowedFile(file: IncomingFile | undefined, maxBytes: number): ValidatedFile {
  if (!file) throw new AppError(400, 'VALIDATION_ERROR', 'Fayl yuborilmadi (`file` maydoni)');
  if (file.size === 0 || file.buffer.length === 0) {
    throw new AppError(422, 'EMPTY_FILE', 'Fayl bo‘sh');
  }
  if (file.size > maxBytes) {
    throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Fayl hajmi ruxsat etilgan chegaradan katta', {
      maxBytes,
    });
  }
  const kind = detectFileType(file.buffer);
  if (!kind) throw new UnsupportedMediaTypeError();
  const ext = extensionOf(file.originalname);
  if (!FILE_KINDS[kind].extensions.includes(ext)) {
    throw new UnsupportedMediaTypeError('Fayl kengaytmasi uning mazmuniga mos kelmaydi');
  }
  return {
    kind,
    mime: FILE_KINDS[kind].mime,
    ext: FILE_KINDS[kind].ext,
    size: file.size,
    filename: sanitizeFilename(file.originalname, FILE_KINDS[kind].ext),
    buffer: file.buffer,
  };
}

/**
 * Asl nomni faqat ko'rsatish/Content-Disposition uchun tozalaydi: yo'l qismlari, boshqaruv belgilari,
 * qo'shtirnoq va teskari chiziq olib tashlanadi; uzunlik 200 belgigacha. Nom R2 kalitiga hech qachon tushmaydi.
 */
export function sanitizeFilename(name: string, fallbackExt = 'bin'): string {
  const base = (name.split(/[\\/]/).pop() ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"\\<>:*?|]/g, '')
    .replace(/^\.+/, '')
    .trim();
  const cleaned = base.length > 200 ? base.slice(base.length - 200) : base;
  return cleaned || `file.${fallbackExt}`;
}

/** RFC 6266/5987: ASCII zaxira nom + `filename*` UTF-8 (kirill/o'zbek harflari saqlanadi). */
export function contentDisposition(filename: string): string {
  const safe = sanitizeFilename(filename);
  const ascii = safe.replace(/[^\x20-\x7e]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}
