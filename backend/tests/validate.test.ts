import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validate } from '../src/middleware/validate.js';
import { paginationQuerySchema, toOffset } from '../src/utils/pagination.js';
import { sendOk, sendPaginated } from '../src/utils/http.js';
import { miniApp } from './helpers/app.js';

const r = Router();
r.post(
  '/items/:id',
  validate({
    params: z.object({ id: z.coerce.number().int().positive() }),
    query: z.object({ dryRun: z.enum(['true', 'false']).optional() }),
    body: z.object({ name: z.string().min(5), qty: z.number().positive() }),
  }),
  (req, res) => {
    sendOk(res, req.validated, 201);
  },
);
r.get('/list', validate({ query: paginationQuerySchema }), (req, res) => {
  const q = req.validated.query as z.infer<typeof paginationQuerySchema>;
  sendPaginated(res, [{ offset: toOffset(q) }], { page: q.page, limit: q.limit, total: 1 });
});
const { app } = miniApp(r);

describe('validate', () => {
  it("to'g'ri so'rov — tiplangan qiymatlar req.validated da", async () => {
    const res = await request(app)
      .post('/items/7?dryRun=true')
      .send({ name: 'Paracetamol', qty: 2 });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({
      params: { id: 7 },
      query: { dryRun: 'true' },
      body: { name: 'Paracetamol', qty: 2 },
    });
  });

  it("barcha qismlardagi xatolar maydonlar bo'yicha bitta 400 da", async () => {
    const res = await request(app).post('/items/abc?dryRun=maybe').send({ name: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.map((d: { path: string }) => d.path).sort();
    expect(paths).toEqual(['body.name', 'body.qty', 'params.id', 'query.dryRun']);
    expect(res.body.error.requestId).toEqual(expect.any(String));
  });
});

describe('pagination', () => {
  it('standart: page=1, limit=20', async () => {
    const res = await request(app).get('/list');
    expect(res.body).toEqual({ data: [{ offset: 0 }], meta: { page: 1, limit: 20, total: 1 } });
  });

  it('offset hisoblanadi', async () => {
    const res = await request(app).get('/list?page=3&limit=50');
    expect(res.body.data[0].offset).toBe(100);
    expect(res.body.meta).toEqual({ page: 3, limit: 50, total: 1 });
  });

  it.each(['limit=101', 'limit=0', 'page=0', 'page=-1', 'page=1.5', 'limit=abc'])(
    '%s → 400',
    async (qs) => {
      const res = await request(app).get(`/list?${qs}`);
      expect(res.status).toBe(400);
    },
  );

  it('limit=100 ruxsat (maksimum)', async () => {
    expect((await request(app).get('/list?limit=100')).status).toBe(200);
  });
});
