import express, { type Express, type Router } from 'express';
import type winston from 'winston';
import Transport from 'winston-transport';
import { createApp, type AppDeps, type AppEnv } from '../../src/app.js';
import { authConfigFromEnv } from '../../src/modules/auth/auth.types.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { notFound } from '../../src/middleware/notFound.js';
import { requestId } from '../../src/middleware/requestId.js';
import { createLogger } from '../../src/utils/logger.js';

/** Log yozuvlarini xotirada yig'adi (testlarda tekshirish uchun). */
export class MemoryTransport extends Transport {
  readonly entries: Record<string, unknown>[] = [];
  override log(info: Record<string, unknown>, next: () => void): void {
    this.entries.push(info);
    next();
  }
  text(): string {
    return this.entries.map((e) => JSON.stringify(e)).join('\n');
  }
}

export function memoryLogger(nodeEnv = 'production'): {
  logger: winston.Logger;
  sink: MemoryTransport;
} {
  const sink = new MemoryTransport();
  const logger = createLogger({ nodeEnv, level: 'debug', transports: [sink] });
  return { logger, sink };
}

/** Testlar uchun soxta sirlar (≥32 belgi) va spec §15 muddatlari. */
export const TEST_ENV: AppEnv = {
  NODE_ENV: 'test',
  FRONTEND_URL: 'http://localhost:5173',
  TRUST_PROXY: false,
  JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef0123',
  JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdef012',
  JWT_ACCESS_TTL_MINUTES: 30,
  JWT_REFRESH_TTL_DAYS: 7,
  SESSION_IDLE_TIMEOUT_MINUTES: 30,
  SWAGGER_USER: undefined,
  SWAGGER_PASSWORD: undefined,
};

export const TEST_AUTH_CONFIG = authConfigFromEnv(TEST_ENV);

type TestAppDeps = Partial<Omit<AppDeps, 'env'>> & { env?: Partial<AppEnv> };

/** `env` qisman beriladi — qolgani TEST_ENV dan. Login limiti testlarda katta (alohida testda kichik). */
export function testApp(deps: TestAppDeps = {}): { app: Express; sink: MemoryTransport } {
  const { logger, sink } = memoryLogger();
  const { env, ...rest } = deps;
  const app = createApp({
    pingDb: async () => true,
    logger,
    loginLimit: { max: 1000, windowMs: 60_000 },
    ...rest,
    env: { ...TEST_ENV, ...env },
  });
  return { app, sink };
}

/** createApp bilan bir xil xato zanjiri, lekin sinov routerlari bilan. */
export function miniApp(routes: Router): { app: Express; sink: MemoryTransport } {
  const { logger, sink } = memoryLogger();
  const app = express();
  app.use(requestId(logger));
  app.use(express.json({ limit: '1mb' }));
  app.use(routes);
  app.use(notFound);
  app.use(errorHandler(logger));
  return { app, sink };
}
