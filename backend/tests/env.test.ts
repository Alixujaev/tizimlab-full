import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnvValidationError, loadEnv, parseEnv } from '../src/config/env.js';

const SECRET_A = 'a'.repeat(32);
const SECRET_B = 'b'.repeat(40);

const base = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: SECRET_A,
  JWT_REFRESH_SECRET: SECRET_B,
};

const prodR2 = {
  R2_ACCOUNT_ID: 'acc',
  R2_ACCESS_KEY_ID: 'key',
  R2_SECRET_ACCESS_KEY: 'r2-secret-value',
  R2_BUCKET: 'bucket',
  R2_ENDPOINT: 'https://acc.r2.cloudflarestorage.com',
  FRONTEND_URL: 'https://app.example.com',
};

function problemsOf(source: Record<string, string | undefined>) {
  try {
    parseEnv(source);
  } catch (err) {
    if (err instanceof EnvValidationError) return err;
    throw err;
  }
  throw new Error('xato kutilgan edi');
}

describe('parseEnv', () => {
  it("to'g'ri minimal env va standart qiymatlar", () => {
    const env = parseEnv(base);
    expect(env.PORT).toBe(4000);
    expect(env.SESSION_IDLE_TIMEOUT_MINUTES).toBe(30);
    expect(env.TRUST_PROXY).toBe(false);
    expect(env.R2_BUCKET).toBeUndefined();
  });

  it("bo'sh satrlar berilmagan deb hisoblanadi", () => {
    const env = parseEnv({ ...base, R2_BUCKET: '', TELEGRAM_BOT_TOKEN: ' ', FRONTEND_URL: '' });
    expect(env.R2_BUCKET).toBeUndefined();
    expect(env.TELEGRAM_BOT_TOKEN).toBeUndefined();
  });

  it("barcha noto'g'ri o'zgaruvchilarni birdaniga, nomi bilan qaytaradi", () => {
    const err = problemsOf({ NODE_ENV: 'staging', PORT: 'abc', JWT_ACCESS_SECRET: 'short' });
    const names = err.problems.map((p) => p.name).sort();
    expect(names).toEqual(
      ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'NODE_ENV', 'PORT'].sort(),
    );
    expect(err.problems.find((p) => p.name === 'DATABASE_URL')?.reason).toBe('majburiy');
  });

  it("xato xabarida sir qiymatlari yo'q", () => {
    const leaky = 'super-secret-but-too-short';
    const err = problemsOf({
      ...base,
      JWT_ACCESS_SECRET: leaky,
      DATABASE_URL: 'mysql://x:pw@h/db',
    });
    expect(err.message).toContain('JWT_ACCESS_SECRET');
    expect(err.message).toContain('DATABASE_URL');
    expect(err.message).not.toContain(leaky);
    expect(err.message).not.toContain('pw@h');
  });

  it('JWT sirlari kamida 32 belgi', () => {
    expect(problemsOf({ ...base, JWT_REFRESH_SECRET: 'x'.repeat(31) }).problems[0]?.name).toBe(
      'JWT_REFRESH_SECRET',
    );
    expect(() => parseEnv({ ...base, JWT_REFRESH_SECRET: 'x'.repeat(32) })).not.toThrow();
  });

  it('DATABASE_URL faqat postgres sxemasi', () => {
    expect(() =>
      parseEnv({ ...base, DATABASE_URL: 'postgresql://h/db?sslmode=require' }),
    ).not.toThrow();
    expect(problemsOf({ ...base, DATABASE_URL: 'http://h/db' }).problems[0]?.name).toBe(
      'DATABASE_URL',
    );
  });

  it("production'da R2_* va FRONTEND_URL majburiy", () => {
    const err = problemsOf({ ...base, NODE_ENV: 'production' });
    expect(err.problems.map((p) => p.name).sort()).toEqual([
      'FRONTEND_URL',
      'R2_ACCESS_KEY_ID',
      'R2_ACCOUNT_ID',
      'R2_BUCKET',
      'R2_ENDPOINT',
      'R2_SECRET_ACCESS_KEY',
    ]);
    expect(() => parseEnv({ ...base, NODE_ENV: 'production', ...prodR2 })).not.toThrow();
  });

  it("development'da R2_* majburiy emas", () => {
    expect(() => parseEnv(base)).not.toThrow();
  });

  it('TELEGRAM_BOT_TOKEN berilsa USERNAME majburiy', () => {
    const err = problemsOf({ ...base, TELEGRAM_BOT_TOKEN: '123:abc' });
    expect(err.problems.map((p) => p.name)).toEqual(['TELEGRAM_BOT_USERNAME']);
  });

  it("production'da token bilan WEBHOOK_URL va SECRET majburiy", () => {
    const tg = { TELEGRAM_BOT_TOKEN: '123:abc', TELEGRAM_BOT_USERNAME: 'tizimlab_bot' };
    const err = problemsOf({ ...base, NODE_ENV: 'production', ...prodR2, ...tg });
    expect(err.problems.map((p) => p.name).sort()).toEqual([
      'TELEGRAM_WEBHOOK_SECRET',
      'TELEGRAM_WEBHOOK_URL',
    ]);
    expect(() =>
      parseEnv({
        ...base,
        NODE_ENV: 'production',
        ...prodR2,
        ...tg,
        TELEGRAM_WEBHOOK_URL: 'https://api.example.com/telegram/webhook',
        TELEGRAM_WEBHOOK_SECRET: 'whsecret',
      }),
    ).not.toThrow();
  });

  it("development'da token bilan webhook majburiy emas (polling)", () => {
    expect(() =>
      parseEnv({ ...base, TELEGRAM_BOT_TOKEN: '1:a', TELEGRAM_BOT_USERNAME: 'bot' }),
    ).not.toThrow();
  });

  it('TRUST_PROXY va SESSION_IDLE_TIMEOUT_MINUTES tiplanadi', () => {
    const env = parseEnv({ ...base, TRUST_PROXY: 'true', SESSION_IDLE_TIMEOUT_MINUTES: '45' });
    expect(env.TRUST_PROXY).toBe(true);
    expect(env.SESSION_IDLE_TIMEOUT_MINUTES).toBe(45);
    expect(problemsOf({ ...base, SESSION_IDLE_TIMEOUT_MINUTES: '0' }).problems[0]?.name).toBe(
      'SESSION_IDLE_TIMEOUT_MINUTES',
    );
  });
});

describe('loadEnv', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("noto'g'ri env'da nomlarni chiqarib, exit(1) qiladi", () => {
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('JWT_ACCESS_SECRET', 'leaked-short');
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);
    const errLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => loadEnv()).toThrow('exit:1');
    expect(exit).toHaveBeenCalledWith(1);
    const printed = errLog.mock.calls.flat().join('\n');
    expect(printed).toContain('JWT_ACCESS_SECRET');
    expect(printed).not.toContain('leaked-short');
  });
});
