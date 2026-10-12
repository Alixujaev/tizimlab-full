import { Router } from 'express';
import type { Bot } from 'grammy';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import type { AuthConfig } from '../auth/auth.types.js';
import { createTelegramController } from './telegram.controller.js';
import {
  createLinkTokenLimiter,
  createWebAppAuthLimiter,
  type TelegramLimitOptions,
} from './telegram.limiter.js';
import { webAppAuthBodySchema } from './telegram.schemas.js';

export function createTelegramRouter(deps: {
  auth: AuthMiddleware;
  config: AuthConfig;
  botToken?: string;
  botUsername?: string;
  webhookSecret?: string;
  bot?: Bot | null;
  linkTokenLimit?: TelegramLimitOptions;
  webAppAuthLimit?: TelegramLimitOptions;
}): Router {
  const router = Router();
  const controller = createTelegramController(deps);

  const linkTokenLimiter = createLinkTokenLimiter(deps.linkTokenLimit);
  const webAppAuthLimiter = createWebAppAuthLimiter(deps.webAppAuthLimit);

  // Himoyalangan endpointlar (foydalanuvchi sessiyasi kerak)
  router.post(
    '/link-token',
    deps.auth.requireAuth,
    linkTokenLimiter,
    controller.createLinkToken,
  );

  router.get('/status', deps.auth.requireAuth, controller.getStatus);

  router.post('/unlink', deps.auth.requireAuth, controller.unlink);

  // Ommaviy endpointlar
  router.post(
    '/webapp-auth',
    webAppAuthLimiter,
    validate({ body: webAppAuthBodySchema }),
    controller.webAppAuth,
  );

  router.post('/webhook', controller.webhook);

  return router;
}
