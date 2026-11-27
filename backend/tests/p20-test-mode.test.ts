import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Router } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EnvValidationError, parseEnv } from '../src/config/env.js';
import { DOCUMENT_JSON_SCHEMA, ND_JSON_SCHEMA } from '../src/modules/ai/ai.schemas.js';
import { aiClientFromEnv } from '../src/modules/ai/ai.config.js';
import { mockResponse } from '../src/modules/ai/ai.mock.js';
import { createDiskFilesRouter, createDiskStorage } from '../src/modules/files/files.disk.js';
import { CHAT_ANSWER_JSON_SCHEMA, chatAnswerSchema } from '../src/modules/oos/oos.schemas.js';
import { documentResultSchema, ndResultSchema } from '../src/modules/ai/ai.schemas.js';
import { miniApp } from './helpers/app.js';

/** P20 (D-198) — E2E uchun test-faqat rejimlar: production/development'da TAQIQLANGAN. */

const base = {
  DATABASE_URL: 'postgres://u:p@localhost/db',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};
const prodBase = {
  ...base,
  NODE_ENV: 'production',
  FRONTEND_URL: 'https://lab.example.uz',
  R2_ACCOUNT_ID: 'x',
  R2_ACCESS_KEY_ID: 'x',
  R2_SECRET_ACCESS_KEY: 'x',
  R2_BUCKET: 'x',
  R2_ENDPOINT: 'https://r2.example.com',
};

function problems(src: Record<string, string>): string[] {
  try {
    parseEnv(src);
    return [];
  } catch (err) {
    if (err instanceof EnvValidationError) return err.problems.map((p) => p.name);
    throw err;
  }
}

describe('test-faqat rejimlar (D-198)', () => {
  it.each(['production', 'development'])('AI_MOCK=1 — %s da ishga tushish xato bilan to‘xtaydi', (nodeEnv) => {
    const src = nodeEnv === 'production' ? { ...prodBase, AI_MOCK: '1' } : { ...base, NODE_ENV: nodeEnv, AI_MOCK: '1' };
    expect(problems(src)).toContain('AI_MOCK');
  });

  it('production: mock embedding va disk xotirasi ham taqiqlangan', () => {
    expect(problems({ ...prodBase, EMBEDDING_PROVIDER: 'mock' })).toContain('EMBEDDING_PROVIDER');
    expect(problems({ ...prodBase, STORAGE_DRIVER: 'disk', STORAGE_DISK_DIR: '/tmp/x' })).toContain('STORAGE_DRIVER');
    expect(problems(prodBase)).toEqual([]);
  });

  it('NODE_ENV=test — ruxsat; disk uchun papka majburiy', () => {
    expect(problems({ ...base, NODE_ENV: 'test', AI_MOCK: '1', EMBEDDING_PROVIDER: 'mock' })).toEqual([]);
    expect(problems({ ...base, NODE_ENV: 'test', STORAGE_DRIVER: 'disk' })).toContain('STORAGE_DISK_DIR');
  });

  it('ikkinchi himoya: aiClientFromEnv test bo‘lmagan muhitda mock’ni rad etadi', () => {
    const env = { AI_ENABLED: false, AI_MAX_FILE_MB: 10, AI_DAILY_LIMIT_PER_COMPANY: 1, AI_MOCK: true } as const;
    expect(() => aiClientFromEnv({ ...env, NODE_ENV: 'production' })).toThrow(/NODE_ENV=test/);
    expect(aiClientFromEnv({ ...env, NODE_ENV: 'test' })?.model).toBe('e2e-mock');
  });

  it('mock javoblari P18/P19 qat’iy sxemalaridan o‘tadi', () => {
    const req = (jsonSchema: Record<string, unknown>, text = '') => ({
      system: '',
      instruction: '',
      jsonSchema,
      parts: [{ kind: 'text' as const, text }],
    });
    expect(documentResultSchema.safeParse(mockResponse(req(DOCUMENT_JSON_SCHEMA))).success).toBe(true);
    expect(ndResultSchema.safeParse(mockResponse(req(ND_JSON_SCHEMA))).success).toBe(true);
    const withSrc = chatAnswerSchema.parse(mockResponse(req(CHAT_ANSWER_JSON_SCHEMA, '[S1] (protocol)')));
    expect(withSrc.internal_findings[0]!.source_ref).toBe('S1');
    expect(chatAnswerSchema.parse(mockResponse(req(CHAT_ANSWER_JSON_SCHEMA))).internal_findings).toEqual([]);
  });
});

describe('disk xotirasi (test rejimi)', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'e2e-files-'));
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it('put/get/delete; imzolangan havola ishlaydi, buzilgani va yo‘l chiqishi — 404', async () => {
    const s = createDiskStorage(dir, 'secret');
    await s.put('c1/protocols/f.pdf', Buffer.from('%PDF-1.4 x'), 'application/pdf');
    expect((await s.get('c1/protocols/f.pdf')).toString()).toBe('%PDF-1.4 x');
    const url = await s.getSignedUrl('c1/protocols/f.pdf', {
      contentDisposition: 'attachment; filename="f.pdf"',
      contentType: 'application/pdf',
      expiresIn: 60,
    });
    expect(url.startsWith('/api/v1/__test/files?')).toBe(true);
    const r = Router();
    r.use('/api/v1/__test', createDiskFilesRouter(dir, 'secret'));
    const { app } = miniApp(r);
    const ok = await request(app).get(url).expect(200);
    expect(ok.headers['content-disposition']).toBe('attachment; filename="f.pdf"');
    expect((await request(app).get(url.replace('f.pdf', 'g.pdf'))).status).toBe(404);
    await expect(s.get('../../etc/passwd')).rejects.toThrow();
    await s.delete('c1/protocols/f.pdf');
    await expect(s.get('c1/protocols/f.pdf')).rejects.toThrow();
  });
});
