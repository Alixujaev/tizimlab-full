import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express, Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import type { Logger } from 'winston';
import type { Env } from './config/env.js';
import { mountSwagger } from './config/swagger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { requestId } from './middleware/requestId.js';
import { logger as defaultLogger } from './utils/logger.js';

export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const RATE_LIMIT_MAX = 2000;

export interface AppDeps {
  env: Pick<Env, 'NODE_ENV' | 'FRONTEND_URL' | 'TRUST_PROXY'>;
  /** DB holatini tekshiradi (`/health` uchun) — testlarda almashtiriladi. */
  pingDb: () => Promise<boolean>;
  logger?: Logger;
}

/** Express ilovasini yig'adi. Server ishga tushirish `server.ts` da (D-21). */
export function createApp({ env, pingDb, logger = defaultLogger }: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(requestId(logger));
  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_URL ?? false,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  // Global rate-limit faqat production'da (spec §15)
  if (env.NODE_ENV === 'production') {
    app.use(
      rateLimit({
        windowMs: RATE_LIMIT_WINDOW_MS,
        limit: RATE_LIMIT_MAX,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        handler: (req, res) => {
          res.status(429).json({
            error: {
              code: 'RATE_LIMITED',
              message: "So'rovlar soni chegaradan oshdi, keyinroq urinib ko'ring",
              requestId: req.id,
            },
          });
        },
      }),
    );
  }

  app.get('/health', async (_req, res) => {
    const dbUp = await pingDb();
    res.status(dbUp ? 200 : 503).json({
      data: { status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'up' : 'down' },
    });
  });

  // Modul routerlari P2 dan boshlab shu yerga ulanadi
  const api = Router();
  app.use('/api/v1', api);

  if (env.NODE_ENV === 'development') mountSwagger(app);

  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
