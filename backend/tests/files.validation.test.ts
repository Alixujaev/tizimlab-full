import { describe, expect, it } from 'vitest';
import {
  assertAllowedFile,
  contentDisposition,
  detectFileType,
  GENERIC_MAX_BYTES,
  PASSPORT_MAX_BYTES,
  sanitizeFilename,
} from '../src/modules/files/files.validation.js';
import { fixtures } from './helpers/memoryStorage.js';

const file = (originalname: string, buffer: Buffer) => ({
  originalname,
  buffer,
  size: buffer.length,
});

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return { status: (e as { status: number }).status, code: (e as { code: string }).code };
  }
  return null;
};

describe('files: magic bytes (D-114, R-FILE-09)', () => {
  it.each([
    ['pdf', fixtures.pdf()],
    ['png', fixtures.png()],
    ['jpeg', fixtures.jpeg()],
    ['doc', fixtures.doc()],
    ['docx', fixtures.docx()],
  ] as const)('%s imzosi aniqlanadi', (kind, buf) => {
    expect(detectFileType(buf)).toBe(kind);
  });

  it('oddiy ZIP docx deb hisoblanmaydi, matn — hech narsa', () => {
    expect(detectFileType(fixtures.zip())).toBeNull();
    expect(detectFileType(fixtures.text())).toBeNull();
    expect(detectFileType(Buffer.alloc(0))).toBeNull();
  });

  it.each([
    ['hujjat.pdf', fixtures.pdf(), 'application/pdf', 'pdf'],
    ['RASM.PNG', fixtures.png(), 'image/png', 'png'],
    ['foto.jpeg', fixtures.jpeg(), 'image/jpeg', 'jpg'],
    ['foto.jpg', fixtures.jpeg(), 'image/jpeg', 'jpg'],
    ['eski.doc', fixtures.doc(), 'application/msword', 'doc'],
    [
      'yangi.docx',
      fixtures.docx(),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'docx',
    ],
  ])('ruxsat etilgan: %s → %s', (name, buf, mime, ext) => {
    const v = assertAllowedFile(file(name, buf), PASSPORT_MAX_BYTES);
    expect(v.mime).toBe(mime);
    expect(v.ext).toBe(ext);
  });

  it('soxta kengaytma: PDF mazmunli .png → 415', () => {
    expect(
      codeOf(() => assertAllowedFile(file('rasm.png', fixtures.pdf()), PASSPORT_MAX_BYTES)),
    ).toEqual({
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  });

  it('soxta kengaytma: oddiy ZIP .docx nomi bilan → 415', () => {
    expect(
      codeOf(() => assertAllowedFile(file('a.docx', fixtures.zip()), PASSPORT_MAX_BYTES))?.status,
    ).toBe(415);
  });

  it('noto‘g‘ri tur (matn .pdf nomi bilan, .exe) → 415', () => {
    expect(
      codeOf(() => assertAllowedFile(file('a.pdf', fixtures.text()), PASSPORT_MAX_BYTES))?.status,
    ).toBe(415);
    expect(
      codeOf(() => assertAllowedFile(file('a.exe', fixtures.pdf()), PASSPORT_MAX_BYTES))?.status,
    ).toBe(415);
    expect(
      codeOf(() => assertAllowedFile(file('kengaytmasiz', fixtures.pdf()), PASSPORT_MAX_BYTES))
        ?.status,
    ).toBe(415);
  });

  it('bo‘sh fayl → 422 EMPTY_FILE; fayl yo‘q → 400', () => {
    expect(
      codeOf(() => assertAllowedFile(file('a.pdf', Buffer.alloc(0)), PASSPORT_MAX_BYTES)),
    ).toEqual({
      status: 422,
      code: 'EMPTY_FILE',
    });
    expect(codeOf(() => assertAllowedFile(undefined, PASSPORT_MAX_BYTES))?.status).toBe(400);
  });

  it('limitdan katta → 413; limitlar 20MB va 50MB (D-06, D-115)', () => {
    expect(PASSPORT_MAX_BYTES).toBe(20 * 1024 * 1024);
    expect(GENERIC_MAX_BYTES).toBe(50 * 1024 * 1024);
    const big = { originalname: 'a.pdf', buffer: fixtures.pdf(), size: PASSPORT_MAX_BYTES + 1 };
    expect(codeOf(() => assertAllowedFile(big, PASSPORT_MAX_BYTES))?.status).toBe(413);
  });
});

describe('files: nom tozalash va Content-Disposition', () => {
  it('yo‘l bo‘laklari va xavfli belgilar olib tashlanadi', () => {
    expect(sanitizeFilename('../../etc/passwd.pdf')).toBe('passwd.pdf');
    expect(sanitizeFilename('C:\\Windows\\a"b<c>.pdf')).toBe('abc.pdf');
    expect(sanitizeFilename('..\u0000.pdf')).toBe('pdf');
    expect(sanitizeFilename('', 'pdf')).toBe('file.pdf');
    expect(sanitizeFilename(`${'a'.repeat(300)}.pdf`)).toHaveLength(200);
  });

  it('unicode nom filename* da saqlanadi, ASCII zaxira', () => {
    const cd = contentDisposition('Паспорт o‘zbek.pdf');
    expect(cd).toContain('attachment;');
    expect(cd).toContain(`filename*=UTF-8''${encodeURIComponent('Паспорт o‘zbek.pdf')}`);
    expect(cd).toMatch(/filename="[\x20-\x7e]+"/);
  });
});
