import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../src/utils/errors.js';
import { asyncHandler } from '../src/utils/http.js';
import { miniApp } from './helpers/app.js';

function appThrowing(err: unknown) {
  const r = Router();
  r.get('/boom', () => {
    throw err;
  });
  r.get(
    '/async-boom',
    asyncHandler(async () => {
      throw err;
    }),
  );
  r.post('/echo', (req, res) => {
    res.json({ data: req.body });
  });
  return miniApp(r);
}

const pgError = (code: string) =>
  Object.assign(new Error(`pg says ${code} SELECT secret_column`), { code });

describe('errorHandler', () => {
  it.each([
    [new ValidationError('yomon', [{ path: 'body.x', message: 'kerak' }]), 400, 'VALIDATION_ERROR'],
    [new UnauthorizedError(), 401, 'UNAUTHORIZED'],
    [new ForbiddenError(), 403, 'FORBIDDEN'],
    [new NotFoundError(), 404, 'NOT_FOUND'],
    [new ConflictError(), 409, 'CONFLICT'],
    [new AppError(422, 'SAMPLE_INVALID_STATE', 'Holat mos emas'), 422, 'SAMPLE_INVALID_STATE'],
  ])('%s → %i %s', async (err, status, code) => {
    const { app } = appThrowing(err);
    const res = await request(app).get('/boom');
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
    expect(res.body.error.message).toBe((err as Error).message);
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
  });

  it('details faqat berilganda chiqadi', async () => {
    const withDetails = await request(
      appThrowing(new ValidationError('x', [{ path: 'a' }])).app,
    ).get('/boom');
    expect(withDetails.body.error.details).toEqual([{ path: 'a' }]);
    const without = await request(appThrowing(new ForbiddenError()).app).get('/boom');
    expect(without.body.error).not.toHaveProperty('details');
  });

  it('async handler xatosi ham ushlanadi', async () => {
    const res = await request(appThrowing(new NotFoundError("yo'q")).app).get('/async-boom');
    expect(res.status).toBe(404);
  });

  it.each([
    ['23505', 409, 'CONFLICT'],
    ['23503', 409, 'CONFLICT'],
    ['22P02', 400, 'VALIDATION_ERROR'],
  ])('pg %s → %i', async (code, status, appCode) => {
    const res = await request(appThrowing(pgError(code)).app).get('/boom');
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(appCode);
    expect(JSON.stringify(res.body)).not.toContain('secret_column');
  });

  it("noma'lum xato → 500 umumiy xabar, stack va ichki matn sizmaydi, logda bor", async () => {
    const err = new Error('DB parol: hunter2 at /srv/app.ts');
    const { app, sink } = appThrowing(err);
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Ichki server xatosi',
        requestId: expect.any(String),
      },
    });
    expect(res.text).not.toContain('hunter2');
    expect(res.text).not.toContain('stack');
    expect(sink.text()).toContain('DB parol');
    expect(sink.text()).toContain('stack');
  });

  it("noto'g'ri JSON → 400 VALIDATION_ERROR", async () => {
    const res = await request(appThrowing(null).app)
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{"a":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('1mb dan katta body → 413', async () => {
    const res = await request(appThrowing(null).app)
      .post('/echo')
      .send({ big: 'x'.repeat(1024 * 1024 + 10) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it("kiruvchi to'g'ri X-Request-Id qayta ishlatiladi, noto'g'risi almashtiriladi", async () => {
    const { app } = appThrowing(new NotFoundError());
    const ok = await request(app).get('/boom').set('X-Request-Id', 'abc12345-req');
    expect(ok.body.error.requestId).toBe('abc12345-req');
    const bad = await request(app).get('/boom').set('X-Request-Id', '<script>');
    expect(bad.body.error.requestId).not.toBe('<script>');
  });
});
