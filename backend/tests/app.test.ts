import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from '../src/app.js';
import { testApp } from './helpers/app.js';

describe('createApp', () => {
  it('GET /health — DB ishlasa 200', async () => {
    const res = await request(testApp().app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'ok', db: 'up' } });
  });

  it("GET /health — DB yo'q bo'lsa 503 va db: down", async () => {
    const res = await request(testApp({ pingDb: async () => false }).app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.data.db).toBe('down');
  });

  it("noma'lum yo'l → 404 D-22 formatda", async () => {
    const res = await request(testApp().app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: expect.any(String), requestId: expect.any(String) },
    });
  });

  it("helmet xavfsizlik sarlavhalari va x-powered-by yo'q", async () => {
    const res = await request(testApp().app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('CORS faqat FRONTEND_URL ga, credentials bilan', async () => {
    const { app } = testApp();
    const ok = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(ok.headers['access-control-allow-credentials']).toBe('true');
    const other = await request(app).get('/health').set('Origin', 'https://evil.example');
    // Statik origin qaytariladi — brauzer begona origin uchun javobni bloklaydi
    expect(other.headers['access-control-allow-origin']).not.toBe('https://evil.example');
  });

  it("rate-limit faqat production'da: 15 daqiqa / 2000", async () => {
    expect(RATE_LIMIT_WINDOW_MS).toBe(15 * 60 * 1000);
    expect(RATE_LIMIT_MAX).toBe(2000);
    const prod = testApp({
      env: { NODE_ENV: 'production', FRONTEND_URL: 'https://app.example.com', TRUST_PROXY: false },
    }).app;
    const res = await request(prod).get('/health');
    expect(res.headers['ratelimit-policy']).toMatch(/q=2000;\s*w=900/);
    for (const nodeEnv of ['development', 'test'] as const) {
      const app = testApp({
        env: { NODE_ENV: nodeEnv, FRONTEND_URL: undefined, TRUST_PROXY: false },
      }).app;
      const r = await request(app).get('/health');
      expect(r.headers['ratelimit-policy']).toBeUndefined();
    }
  });

  it("swagger /docs faqat development'da", async () => {
    const dev = testApp({
      env: { NODE_ENV: 'development', FRONTEND_URL: undefined, TRUST_PROXY: false },
    }).app;
    expect((await request(dev).get('/docs/')).status).toBe(200);
    const prod = testApp({
      env: { NODE_ENV: 'production', FRONTEND_URL: 'https://a.example', TRUST_PROXY: false },
    }).app;
    expect((await request(prod).get('/docs/')).status).toBe(404);
  });
});
