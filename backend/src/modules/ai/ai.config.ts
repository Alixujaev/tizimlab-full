import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import type { FileStorage } from '../files/files.storage.js';
import { createAnthropicAiClient, type AiClient } from './ai.client.js';
import type { AiRuntime } from './ai.service.js';

export type AiEnv = Pick<
  Env,
  'AI_ENABLED' | 'ANTHROPIC_API_KEY' | 'AI_MODEL' | 'AI_MAX_FILE_MB' | 'AI_DAILY_LIMIT_PER_COMPANY'
>;

/** D-179: uchalasi (AI_ENABLED, kalit, model) bo'lsa — haqiqiy klient; aks holda `null` (AI o'chiq, 503). */
export function aiClientFromEnv(env: AiEnv): AiClient | null {
  if (!env.AI_ENABLED) return null;
  if (!env.ANTHROPIC_API_KEY || !env.AI_MODEL) {
    logger.warn('AI_ENABLED=true, lekin ANTHROPIC_API_KEY yoki AI_MODEL berilmagan — AI o‘chiq');
    return null;
  }
  return createAnthropicAiClient({ apiKey: env.ANTHROPIC_API_KEY, model: env.AI_MODEL });
}

export const AI_DEFAULT_MAX_FILE_MB = 10;
export const AI_DEFAULT_DAILY_LIMIT = 200;

export function aiRuntime(opts: {
  client: AiClient | null;
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
