import express, { type Express, type Router } from 'express';
import type winston from 'winston';
import Transport from 'winston-transport';
import { createApp, type AppDeps } from '../../src/app.js';
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

export function testApp(deps: Partial<AppDeps> = {}): { app: Express; sink: MemoryTransport } {
  const { logger, sink } = memoryLogger();
  const app = createApp({
    env: { NODE_ENV: 'test', FRONTEND_URL: 'http://localhost:5173', TRUST_PROXY: false },
    pingDb: async () => true,
    logger,
    ...deps,
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
