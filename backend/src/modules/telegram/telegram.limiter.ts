import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';

export interface TelegramLimitOptions {
  max: number;
  windowMs: number;
}

export const LINK_TOKEN_LIMIT: TelegramLimitOptions = {
  max: 10,
  windowMs: 15 * 60 * 1000,
};

export const WEBAPP_AUTH_LIMIT: TelegramLimitOptions = {
  max: 30,
  windowMs: 60 * 1000,
};

export function createLinkTokenLimiter(
  opts: TelegramLimitOptions = LINK_TOKEN_LIMIT,
): RequestHandler {
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: "Telegram bog'lash tokeni so'rovlari chegaradan oshdi, keyinroq urinib ko'ring",
          requestId: req.id,
        },
      });
    },
  });
}

export function createWebAppAuthLimiter(
  opts: TelegramLimitOptions = WEBAPP_AUTH_LIMIT,
): RequestHandler {
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: "Telegram WebApp login urinishlari soni oshdi, keyinroq urinib ko'ring",
          requestId: req.id,
        },
      });
    },
  });
}
