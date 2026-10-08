import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { LOGIN_LIMIT } from '../src/modules/auth/loginLimiter.js';
import {
  BCRYPT_ROUNDS,
  assertPasswordPolicy,
  hashPassword,
  isPasswordValid,
  verifyPassword,
} from '../src/modules/auth/password.js';
import {
  signAccessToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../src/modules/auth/tokens.js';
import { TEST_AUTH_CONFIG, TEST_ENV, testApp } from './helpers/app.js';

describe('parol siyosati (D-66)', () => {
  it('kamida 8 belgi, kamida bitta harf va bitta raqam', () => {
    expect(isPasswordValid('Parol123')).toBe(true);
    expect(isPasswordValid('паролЬ12')).toBe(true); // kirill harflari ham harf
    expect(isPasswordValid('Parol12')).toBe(false); // 7 belgi
    expect(isPasswordValid('Parollar')).toBe(false); // raqam yo'q
    expect(isPasswordValid('12345678')).toBe(false); // harf yo'q
    expect(isPasswordValid(`a1${'x'.repeat(127)}`)).toBe(false); // > 128
    expect(() => assertPasswordPolicy('qisqa1')).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });

  it('bcrypt 10 round, $2a/$2b formati (eski tizim bilan mos — D-86)', async () => {
    expect(BCRYPT_ROUNDS).toBe(10);
    const hash = await hashPassword('Parol123');
    expect(hash).toMatch(/^\$2b\$10\$/);
    expect(await verifyPassword('Parol123', hash)).toBe(true);
    expect(await verifyPassword('Parol124', hash)).toBe(false);
    // Eski tizimdagi $2a$ prefiksli xesh ham tekshiriladi
    expect(await verifyPassword('Parol123', hash.replace(/^\$2b\$/, '$2a$'))).toBe(true);
  });
});

describe('tokenlar (D-87)', () => {
  const claims = {
    sub: '11111111-1111-1111-1111-111111111111',
    sid: '22222222-2222-2222-2222-222222222222',
    role: 'chemist' as const,
    company_id: '33333333-3333-3333-3333-333333333333',
  };

  it("verifyAccessToken — claim'lar to'liq qaytadi; refresh token access sifatida o'tmaydi", () => {
    const token = signAccessToken(claims, TEST_AUTH_CONFIG);
    expect(verifyAccessToken(token, TEST_ENV.JWT_ACCESS_SECRET)).toEqual(claims);
    const refreshLike = jwt.sign({ typ: 'refresh', sid: claims.sid }, TEST_ENV.JWT_ACCESS_SECRET, {
      subject: claims.sub,
    });
    expect(() => verifyAccessToken(refreshLike, TEST_ENV.JWT_ACCESS_SECRET)).toThrow(
      expect.objectContaining({ status: 401 }),
    );
    expect(() => verifyRefreshToken(token, TEST_ENV.JWT_ACCESS_SECRET)).toThrow(
      expect.objectContaining({ status: 401 }),
    );
  });

  it("'none' algoritmi va boshqa sir rad etiladi", () => {
    const none = jwt.sign({ typ: 'access', ...claims }, '', { algorithm: 'none' });
    expect(() => verifyAccessToken(none, TEST_ENV.JWT_ACCESS_SECRET)).toThrow();
    const other = signAccessToken(claims, { ...TEST_AUTH_CONFIG, accessSecret: 'x'.repeat(40) });
    expect(() => verifyAccessToken(other, TEST_ENV.JWT_ACCESS_SECRET)).toThrow();
  });
});

describe('login rate-limit (D-66)', () => {
  it('standart: 15 daqiqada 10 urinish', () => {
    expect(LOGIN_LIMIT).toEqual({ max: 10, windowMs: 15 * 60 * 1000 });
  });

  it('factory: max dan keyin 429 RATE_LIMITED; boshqa auth endpointlari limitga kirmaydi', async () => {
    const { app } = testApp({ loginLimit: { max: 2, windowMs: 60_000 } });
    // Bo'sh body — validatsiyada to'xtaydi (DB kerak emas), lekin urinish sanaladi
    expect((await request(app).post('/api/v1/auth/login').send({})).status).toBe(400);
    expect((await request(app).post('/api/v1/auth/login').send({})).status).toBe(400);
    const blocked = await request(app).post('/api/v1/auth/login').send({});
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect((await request(app).post('/api/v1/auth/refresh')).status).toBe(401);
  });
});
