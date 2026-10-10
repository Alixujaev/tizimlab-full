import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express, Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import type { Logger } from 'winston';
import type { Env } from './config/env.js';
import { mountSwagger } from './config/swagger.js';
import { createAuthMiddleware } from './middleware/authenticate.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { requestId } from './middleware/requestId.js';
import { createAdminRouter } from './modules/admin/admin.router.js';
import { createAuthRouter } from './modules/auth/auth.router.js';
import { authConfigFromEnv, type AuthEnv } from './modules/auth/auth.types.js';
import {
  createLoginLimiter,
  LOGIN_LIMIT,
  type LoginLimitOptions,
} from './modules/auth/loginLimiter.js';
import { createRegistryRouter } from './modules/registry/registry.router.js';
import { createCompaniesRouter } from './modules/companies/companies.router.js';
import { createDashboardRouter } from './modules/dashboard/dashboard.router.js';
import { createNotificationsRouter } from './modules/notifications/notifications.router.js';
import { createProtocolsRouter } from './modules/protocols/protocols.router.js';
import { createSamplesRouter } from './modules/samples/samples.router.js';
import { createSubstancesRouter } from './modules/substances/substances.router.js';
import {
  createExpensesRouter,
  createReagentsRouter,
} from './modules/reagents/reagents.router.js';
import {
  createIngestLimiter,
  INGEST_LIMIT,
  type IngestLimitOptions,
} from './modules/temperature/ingestLimiter.js';
import { createTemperatureRouter } from './modules/temperature/temperature.router.js';
import { createStabilityRouter } from './modules/stability/stability.router.js';
import type { FileStorage } from './modules/files/files.storage.js';
import { logger as defaultLogger } from './utils/logger.js';

export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const RATE_LIMIT_MAX = 2000;

export type AppEnv = AuthEnv &
  Pick<Env, 'FRONTEND_URL' | 'TRUST_PROXY' | 'SWAGGER_USER' | 'SWAGGER_PASSWORD'>;

export interface AppDeps {
  env: AppEnv;
  /** DB holatini tekshiradi (`/health` uchun) — testlarda almashtiriladi. */
  pingDb: () => Promise<boolean>;
  logger?: Logger;
  /** Login rate-limit (D-66) — testlarda kichik/katta qiymat bilan almashtiriladi. */
  loginLimit?: LoginLimitOptions;
  /** Ingest rate-limit (D-141) — testlarda kichik/katta qiymat bilan almashtiriladi. */
  ingestLimit?: IngestLimitOptions;
  /** Fayl xotirasi (R2); `null`/berilmagan — fayl endpointlari 503 (D-121). Testlarda xotiradagi adapter. */
  storage?: FileStorage | null;
}

/** Express ilovasini yig'adi. Server ishga tushirish `server.ts` da (D-21). */
export function createApp({
  env,
  pingDb,
  logger = defaultLogger,
  loginLimit = LOGIN_LIMIT,
  ingestLimit = INGEST_LIMIT,
  storage = null,
}: AppDeps): Express {
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

  // Modul routerlari: himoyalanganlari `auth.requireAuth` → `requireCompany` → `requireRole`/`requirePermission`
  const authConfig = authConfigFromEnv(env);
  const auth = createAuthMiddleware(authConfig);
  const api = Router();
  api.use(
    '/auth',
    createAuthRouter({ config: authConfig, auth, loginLimiter: createLoginLimiter(loginLimit) }),
  );
  api.use('/companies', createCompaniesRouter({ auth }));
  api.use('/admin', createAdminRouter({ auth }));
  api.use('/substances', createSubstancesRouter({ auth }));
  api.use('/samples', createSamplesRouter({ auth, storage }));
  api.use('/protocols', createProtocolsRouter({ auth, storage }));
  api.use('/registry', createRegistryRouter({ auth, storage }));
  api.use('/notifications', createNotificationsRouter({ auth }));
  api.use('/dashboard', createDashboardRouter({ auth }));
  api.use('/reagents', createReagentsRouter({ auth, storage }));
  api.use('/expenses', createExpensesRouter({ auth, storage }));
  api.use(
    '/temperature',
    createTemperatureRouter({ auth, ingestLimiter: createIngestLimiter(ingestLimit) }),
  );
  api.use('/stability', createStabilityRouter({ auth }));
  app.use('/api/v1', api);

  if (env.NODE_ENV === 'development' && env.SWAGGER_USER && env.SWAGGER_PASSWORD) {
    mountSwagger(app, { user: env.SWAGGER_USER, password: env.SWAGGER_PASSWORD });
  }

  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
