import { createHash } from 'node:crypto';
import mammoth from 'mammoth';
import { extractText as extractPdfText, getDocumentProxy } from 'unpdf';

/**
 * D-191: matn olish. PDF — matn qatlami (unpdf/pdf.js), Word (.docx) — mammoth. Rasm yoki matnsiz (skan) PDF —
 * `null` qaytadi, chaqiruvchi P18 vision OCR ga beradi. Eski .doc qo'llab-quvvatlanmaydi.
 */

export type TextSourceKind = 'pdf' | 'docx' | 'doc' | 'jpeg' | 'png' | 'webp';

/** Skan PDF'da sahifada bir necha belgi bo'lishi mumkin — shundan kam bo'lsa "matn qatlami yo'q". */
const MIN_TEXT_CHARS = 40;

export async function extractDocumentText(buffer: Buffer, kind: TextSourceKind): Promise<string | null> {
  if (kind === 'pdf') {
    try {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractPdfText(pdf, { mergePages: true });
      const clean = normalizeWhitespace(text);
      return clean.length >= MIN_TEXT_CHARS ? clean : null;
    } catch {
      return null;
    }
  }
  if (kind === 'docx') {
    const { value } = await mammoth.extractRawText({ buffer });
    const clean = normalizeWhitespace(value);
    return clean.length ? clean : null;
  }
  return null;
}

export function normalizeWhitespace(s: string): string {
  return s
    .replace(/\r/g, '')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const CHUNK_SIZE = 1200;
export const CHUNK_OVERLAP = 150;
export const MAX_CHUNKS_PER_SOURCE = 200;

/**
 * Bo'laklash: paragraf/gap chegarasida ~CHUNK_SIZE belgi, CHUNK_OVERLAP ustma-ust. Har bo'lak boshiga
 * metadata sarlavhasi qo'shiladi (xomashyo, seriya, sana...) — FTS va vektor qidiruv kontekstni ko'rsin.
 */
export function chunkText(text: string, header: string): string[] {
  const body = normalizeWhitespace(text);
  const out: string[] = [];
  if (!body) return header ? [header] : [];
  let start = 0;
  while (start < body.length && out.length < MAX_CHUNKS_PER_SOURCE) {
    let end = Math.min(body.length, start + CHUNK_SIZE);
    if (end < body.length) {
      const window = body.slice(start, end);
      const cut = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('. '), window.lastIndexOf('\n'));
      if (cut > CHUNK_SIZE / 2) end = start + cut + 1;
    }
    const piece = body.slice(start, end).trim();
    if (piece) out.push(header ? `${header}\n${piece}` : piece);
    if (end >= body.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }
  return out;
}

export const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
