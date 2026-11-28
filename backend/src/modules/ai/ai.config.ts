import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import type { FileStorage } from '../files/files.storage.js';
import { createAnthropicTransport } from './ai.client.js';
import { createGeminiTransport, GEMINI_DEFAULT_MODEL } from './ai.gemini.js';
import { createMockAiClient } from './ai.mock.js';
import { createOpenAiTransport, OPENAI_DEFAULT_MODEL } from './ai.openai.js';
import {
  AI_PROVIDERS,
  createLlmProvider,
  type AiProviderName,
  type LlmProvider,
} from './ai.provider.js';
import type { AiRuntime } from './ai.service.js';

export type AiEnv = Pick<
  Env,
  'AI_ENABLED' | 'ANTHROPIC_API_KEY' | 'AI_MODEL' | 'AI_MAX_FILE_MB' | 'AI_DAILY_LIMIT_PER_COMPANY'
> &
  Partial<Pick<Env, 'AI_MOCK' | 'NODE_ENV' | 'AI_PROVIDER' | 'OPENAI_API_KEY' | 'GEMINI_API_KEY'>>;

/** D-201: provayder standart modeli (vision + PDF, eng arzon joriy). Anthropic uchun standart yo'q — AI_MODEL shart. */
export const DEFAULT_MODELS: Record<'openai' | 'gemini' | 'anthropic', string | undefined> = {
  openai: OPENAI_DEFAULT_MODEL,
  gemini: GEMINI_DEFAULT_MODEL,
  anthropic: undefined,
};

const KEY_ENV = {
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
} as const;

export function isAiProviderName(v: unknown): v is AiProviderName {
  return typeof v === 'string' && (AI_PROVIDERS as readonly string[]).includes(v);
}

/** Nom + kalit + model bo'yicha haqiqiy provayder (smoke-tool ham shuni ishlatadi). */
export function createProvider(
  name: 'openai' | 'gemini' | 'anthropic',
  opts: { apiKey: string; model?: string },
): LlmProvider {
  const model = opts.model ?? DEFAULT_MODELS[name];
  if (!model) throw new Error(`${name}: AI_MODEL berilmagan`);
  switch (name) {
    case 'openai':
      return createLlmProvider(
        createOpenAiTransport({
          apiKey: opts.apiKey,
          model,
          // Standart (reasoning) model uchun past effort — narx/kechikish; boshqa model — o'z standarti
          ...(model === OPENAI_DEFAULT_MODEL ? { reasoningEffort: 'low' as const } : {}),
        }),
      );
    case 'gemini':
      return createLlmProvider(createGeminiTransport({ apiKey: opts.apiKey, model }));
    case 'anthropic':
      return createLlmProvider(createAnthropicTransport({ apiKey: opts.apiKey, model }));
  }
}

/**
 * D-179/D-201: AI_ENABLED + tanlangan provayder kaliti (+ Anthropic uchun AI_MODEL) bo'lsa — provayder;
 * aks holda `null` (AI o'chiq, 503 — qo'lda kiritish ishlaydi).
 */
export function aiClientFromEnv(env: AiEnv): LlmProvider | null {
  // D-198: mock faqat test muhitida (env.ts ham tekshiradi — bu ikkinchi himoya qatlami)
  if (env.AI_MOCK || env.AI_PROVIDER === 'mock') {
    if (env.NODE_ENV !== 'test') throw new Error('AI_MOCK faqat NODE_ENV=test da ruxsat etiladi');
    return createMockAiClient();
  }
  const name = env.AI_PROVIDER ?? 'openai';
  if (!isAiProviderName(name)) throw new Error(`Noma'lum AI_PROVIDER: ${String(name)}`);
  if (!env.AI_ENABLED) return null;
  const apiKey = env[KEY_ENV[name]];
  const model = env.AI_MODEL ?? DEFAULT_MODELS[name];
  if (!apiKey || !model) {
    logger.warn(
      `AI_ENABLED=true, lekin ${KEY_ENV[name]}${model ? '' : ' yoki AI_MODEL'} berilmagan — AI o‘chiq`,
    );
    return null;
  }
  return createProvider(name, { apiKey, model });
}

export const AI_DEFAULT_MAX_FILE_MB = 10;
export const AI_DEFAULT_DAILY_LIMIT = 200;

export function aiRuntime(opts: {
  client: LlmProvider | null;
  storage: FileStorage | null;
  maxFileMb?: number;
  dailyLimit?: number;
}): AiRuntime {
  return {
    client: opts.client,
    storage: opts.storage,
    maxFileBytes: (opts.maxFileMb ?? AI_DEFAULT_MAX_FILE_MB) * 1024 * 1024,
    dailyLimit: opts.dailyLimit ?? AI_DEFAULT_DAILY_LIMIT,
  };
}

/** Foydalanuvchi bo'yicha (IP emas) — 1 daqiqada 10 ta AI so'rov; testlarda moslanadi. */
export const AI_USER_LIMIT = { max: 10, windowMs: 60 * 1000 } as const;
export interface AiUserLimitOptions {
  max: number;
  windowMs: number;
}

export function createAiUserLimiter({
  max,
  windowMs,
}: AiUserLimitOptions = AI_USER_LIMIT): RequestHandler {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // authenticate'dan keyin ishlaydi — kalit foydalanuvchi ID si
    keyGenerator: (req) => `ai:${req.auth?.userId ?? 'anon'}`,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: 'AI_RATE_LIMITED',
          message:
            'AI so‘rovlari juda tez-tez yuborilmoqda — bir daqiqadan so‘ng urinib ko‘ring yoki qo‘lda to‘ldiring',
          requestId: req.id,
        },
      });
    },
  });
}
