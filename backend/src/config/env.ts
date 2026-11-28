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
    TELEGRAM_WEBAPP_URL: optionalUrl,
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
    // Token muddatlari (spec §15: access 30 daqiqa, refresh 7 kun) — env nomi spec'da yo'q, biz qo'shdik
    JWT_ACCESS_TTL_MINUTES: z.coerce.number().int().positive().default(30),
    JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
    // D-200: almashtirilgan refresh token shu soniya ichida qayta kelsa — sessiya bekor qilinmaydi
    AUTH_REFRESH_REUSE_GRACE_SECONDS: z.coerce.number().int().min(0).max(120).default(10),
    // Swagger HTTP Basic (D-93) — spec'da yo'q, biz qo'shdik; ikkalasi berilmasa /docs o'chiq
    SWAGGER_USER: optionalString,
    SWAGGER_PASSWORD: optionalString,
    // P18 AI yordamchi (D-179): kalit yoki model berilmasa AI o'chiq — qo'lda kiritish o'zgarishsiz ishlaydi
    AI_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    // D-201: provayder tanlovi; kalit faqat tanlangan provayder uchun kerak
    AI_PROVIDER: z.enum(['openai', 'gemini', 'anthropic', 'mock']).default('openai'),
    OPENAI_API_KEY: optionalString,
    GEMINI_API_KEY: optionalString,
    ANTHROPIC_API_KEY: optionalString,
    AI_MODEL: optionalString,
    AI_MAX_FILE_MB: z.coerce.number().int().min(1).max(30).default(10),
    AI_DAILY_LIMIT_PER_COMPANY: z.coerce.number().int().min(0).default(200),
    // P19 (D-190): embedding (RAG). Kalit/model yo'q — vektor qidiruv o'chiq, FTS fallback
    EMBEDDING_PROVIDER: z.enum(['voyage', 'mock', 'none']).default('voyage'),
    EMBEDDING_API_KEY: optionalString,
    EMBEDDING_MODEL: optionalString,
    EMBEDDING_DIM: z.coerce.number().int().positive().default(1024),
    EMBEDDING_API_URL: optionalUrl,
    // P19 (D-195): OOS chat — kompaniya bo'yicha kunlik AI javoblar limiti
    OOS_CHAT_DAILY_LIMIT_PER_COMPANY: z.coerce.number().int().min(0).default(300),
    // P20 (D-198): E2E rejimi — FAQAT NODE_ENV=test (boshqa muhitda ishga tushish xato bilan to'xtaydi)
    AI_MOCK: z
      .enum(['true', 'false', '1', '0'])
      .default('false')
      .transform((v) => v === 'true' || v === '1'),
    STORAGE_DRIVER: z.enum(['r2', 'disk']).default('r2'),
    STORAGE_DISK_DIR: optionalString,
  })
  .superRefine((env, ctx) => {
    const require = (key: keyof typeof env, why: string) => {
      if (env[key] === undefined) ctx.addIssue({ code: 'custom', path: [key], message: why });
    };
    if (env.NODE_ENV === 'production') {
      for (const key of R2_KEYS) require(key, "production'da majburiy");
      require('FRONTEND_URL', "production'da majburiy");
    }
    // D-198: test-faqat rejimlar production/development'da TAQIQLANGAN
    const testOnly = (key: keyof typeof env, active: boolean) => {
      if (active && env.NODE_ENV !== 'test') {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'faqat NODE_ENV=test da ruxsat etiladi',
        });
      }
    };
    testOnly('AI_MOCK', env.AI_MOCK);
    testOnly('AI_PROVIDER', env.AI_PROVIDER === 'mock');
    testOnly('EMBEDDING_PROVIDER', env.EMBEDDING_PROVIDER === 'mock');
    testOnly('STORAGE_DRIVER', env.STORAGE_DRIVER === 'disk');
    if (env.STORAGE_DRIVER === 'disk')
      require('STORAGE_DISK_DIR', 'STORAGE_DRIVER=disk da majburiy');
    if (env.SWAGGER_USER && !env.SWAGGER_PASSWORD)
      require('SWAGGER_PASSWORD', 'SWAGGER_USER berilganda majburiy');
    if (env.SWAGGER_PASSWORD && !env.SWAGGER_USER)
      require('SWAGGER_USER', 'SWAGGER_PASSWORD berilganda majburiy');
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
