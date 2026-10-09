import type { FileStorage, SignedUrlOptions } from '../../src/modules/files/files.storage.js';

/** Xotiradagi storage — faqat testlar uchun (haqiqiy R2 ga hech qachon ulanilmaydi). */
export class MemoryStorage implements FileStorage {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();
  readonly signed: { key: string; opts: SignedUrlOptions }[] = [];
  readonly deleted: string[] = [];
  failNextPut = false;
  failNextDelete = false;

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    if (this.failNextPut) {
      this.failNextPut = false;
      throw new Error('memory storage: put failed');
    }
    this.objects.set(key, { body, contentType });
  }

  async getSignedUrl(key: string, opts: SignedUrlOptions): Promise<string> {
    this.signed.push({ key, opts });
    return `memory://${key}?expires=${opts.expiresIn}`;
  }

  async delete(key: string): Promise<void> {
    if (this.failNextDelete) {
      this.failNextDelete = false;
      throw new Error('memory storage: delete failed');
    }
    this.deleted.push(key);
    this.objects.delete(key);
  }

  reset(): void {
    this.objects.clear();
    this.signed.length = 0;
    this.deleted.length = 0;
    this.failNextPut = false;
    this.failNextDelete = false;
  }
}

/** Haqiqiy fayl imzolari bilan kichik namunalar (magic bytes testlari uchun). */
export const fixtures = {
  pdf: () =>
    Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(64, 0x20), Buffer.from('%%EOF')]),
  png: () =>
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(32),
    ]),
  jpeg: () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]),
  doc: () =>
    Buffer.concat([
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      Buffer.alloc(64),
    ]),
  docx: () =>
    Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.alloc(26),
      Buffer.from('[Content_Types].xml'),
      Buffer.alloc(16),
      Buffer.from('word/document.xml'),
      Buffer.alloc(16),
    ]),
  zip: () =>
    Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.alloc(26),
      Buffer.from('data.txt'),
    ]),
  text: () => Buffer.from('oddiy matn fayli, imzosiz'),
};
