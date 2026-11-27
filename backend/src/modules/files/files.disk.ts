import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Router, type Request, type Response } from 'express';
import { NotFoundError } from '../../utils/errors.js';
import type { FileStorage } from './files.storage.js';

/**
 * D-198: E2E uchun lokal disk xotirasi (STORAGE_DRIVER=disk) — FAQAT NODE_ENV=test (env.ts majburlaydi).
 * Imzolangan URL — nisbiy `/api/v1/__test/files/...` (frontend proksi orqali ochiladi), HMAC + muddat bilan.
 */

const keyToPath = (root: string, key: string) => {
  // Kalit `buildKey` dan: `<uuid>/<entity>/<uuid>.<ext>` — yo'l chiqib ketmasligi tekshiriladi
  const p = path.resolve(root, key);
  if (!p.startsWith(path.resolve(root) + path.sep)) throw new NotFoundError('Fayl topilmadi');
  return p;
};

const sign = (secret: string, payload: string) => createHmac('sha256', secret).update(payload).digest('hex');

export function createDiskStorage(root: string, secret: string): FileStorage {
  return {
    async put(key, body) {
      const p = keyToPath(root, key);
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, body);
    },
    async get(key) {
      return readFile(keyToPath(root, key));
    },
    async delete(key) {
      await rm(keyToPath(root, key), { force: true });
    },
    async getSignedUrl(key, opts) {
      const exp = Math.floor(Date.now() / 1000) + opts.expiresIn;
      const q = new URLSearchParams({ key, exp: String(exp), cd: opts.contentDisposition, ct: opts.contentType });
      q.set('sig', sign(secret, q.toString()));
      return `/api/v1/__test/files?${q.toString()}`;
    },
  };
}

/** Imzolangan faylni beradi (test rejimi). */
export function createDiskFilesRouter(root: string, secret: string): Router {
  const router = Router();
  router.get('/files', async (req: Request, res: Response) => {
    const params = new URLSearchParams(req.url.split('?')[1] ?? '');
    const sig = params.get('sig') ?? '';
    params.delete('sig');
    const expected = sign(secret, params.toString());
    const ok =
      sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!ok || Number(params.get('exp')) < Date.now() / 1000) throw new NotFoundError('Havola yaroqsiz');
    const body = await readFile(keyToPath(root, params.get('key') ?? '')).catch(() => {
      throw new NotFoundError('Fayl topilmadi');
    });
    res.setHeader('Content-Type', params.get('ct') ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', params.get('cd') ?? 'attachment');
    res.send(body);
  });
  return router;
}
