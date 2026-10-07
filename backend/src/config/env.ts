import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// Bo'sh satr (`KEY=`) "berilmagan" deb hisoblanadi
const optionalString = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().optional(),
);
const optionalUrl = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.url().optional(),
);

const postgresUrl = z
  .string()
  .regex(/^postgres(ql)?:\/\//, 'postgres:// yoki postgresql:// bilan boshlanishi kerak');

const secret = z.string().min(32, 'kamida 32 belgi');

const R2_KEYS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_ENDPOINT',
] as const;

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: postgresUrl,
    JWT_ACCESS_SECRET: secret,
    JWT_REFRESH_SECRET: secret,
    SESSION_IDLE_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(30),
    R2_ACCOUNT_ID: optionalString,
    R2_ACCESS_KEY_ID: optionalString,
    R2_SECRET_ACCESS_KEY: optionalString,
    R2_BUCKET: optionalString,
    R2_ENDPOINT: optionalUrl,
    TELEGRAM_BOT_TOKEN: optionalString,
    TELEGRAM_BOT_USERNAME: optionalString,
    TELEGRAM_WEBHOOK_URL: optionalUrl,
    TELEGRAM_WEBHOOK_SECRET: optionalString,
    // Quyidagilar spec'da yo'q, biz qo'shdik (D-26)
    TEST_DATABASE_URL: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      postgresUrl.optional(),
    ),
    FRONTEND_URL: optionalUrl,
    TRUST_PROXY: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
  })
  .superRefine((env, ctx) => {
    const require = (key: keyof typeof env, why: string) => {
      if (env[key] === undefined) ctx.addIssue({ code: 'custom', path: [key], message: why });
    };
    if (env.NODE_ENV === 'production') {
      for (const key of R2_KEYS) require(key, "production'da majburiy");
      require('FRONTEND_URL', "production'da majburiy");
    }
    if (env.TELEGRAM_BOT_TOKEN) {
      require('TELEGRAM_BOT_USERNAME', 'TELEGRAM_BOT_TOKEN berilganda majburiy');
      if (env.NODE_ENV === 'production') {
        require('TELEGRAM_WEBHOOK_URL', "production'da TELEGRAM_BOT_TOKEN bilan majburiy");
        require('TELEGRAM_WEBHOOK_SECRET', "production'da TELEGRAM_BOT_TOKEN bilan majburiy");
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(public readonly problems: { name: string; reason: string }[]) {
    super(
      "Muhit o'zgaruvchilari noto'g'ri:\n" +
        problems.map((p) => `  - ${p.name}: ${p.reason}`).join('\n'),
    );
    this.name = 'EnvValidationError';
  }
}

/** Sof funksiya: xato bo'lsa BARCHA noto'g'ri o'zgaruvchilarni nomi bilan qaytaradi (qiymatsiz). */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;
  const problems = result.error.issues.map((issue) => {
    const name = String(issue.path[0] ?? '(umumiy)');
    const missing = issue.code === 'invalid_type' && !source[name];
    // Zod xabarlari qiymatni o'z ichiga olmaydi — sir logga tushmaydi
    return { name, reason: missing ? 'majburiy' : issue.message };
  });
  throw new EnvValidationError(problems);
}

/** `.env` ni o'qib, tekshiradi; xato bo'lsa sabablarni chiqarib jarayonni to'xtatadi. */
export function loadEnv(): Env {
  loadDotenv({ quiet: true });
  try {
    return parseEnv(process.env);
  } catch (err) {
    if (err instanceof EnvValidationError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }
}
