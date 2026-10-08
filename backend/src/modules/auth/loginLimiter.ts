import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';

/** D-66: bitta IP'dan 15 daqiqada 10 ta login urinish (global limiterdan alohida). */
export const LOGIN_LIMIT = { max: 10, windowMs: 15 * 60 * 1000 } as const;

export interface LoginLimitOptions {
  max: number;
  windowMs: number;
}

/** Factory — testlarda kichik qiymatlar bilan sinaladi. */
export function createLoginLimiter({
  max,
  windowMs,
}: LoginLimitOptions = LOGIN_LIMIT): RequestHandler {
  return rateLimit({
    windowMs,
    limit: max,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: "Kirish urinishlari soni chegaradan oshdi, keyinroq urinib ko'ring",
          requestId: req.id,
        },
      });
    },
  });
}
