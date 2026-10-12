import { timingSafeEqual } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import type { Bot } from 'grammy';
import { UnauthorizedError } from '../../utils/errors.js';
import { sendOk } from '../../utils/http.js';
import {
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  type AuthConfig,
  type RequestMeta,
} from '../auth/auth.types.js';
import type { WebAppAuthBody } from './telegram.schemas.js';
import * as telegramService from './telegram.service.js';

const requestMeta = (req: Request): RequestMeta => ({
  ip: req.ip ?? null,
  userAgent: req.get('user-agent') ?? null,
});

function cookieOptions(cfg: AuthConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: cfg.secureCookies,
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
  };
}

function setRefreshCookie(res: Response, token: string, cfg: AuthConfig): void {
  res.cookie(REFRESH_COOKIE, token, {
    ...cookieOptions(cfg),
    maxAge: cfg.refreshTtlDays * 24 * 60 * 60 * 1000,
  });
}

export function createTelegramController(deps: {
  config: AuthConfig;
  botToken?: string;
  botUsername?: string;
  webhookSecret?: string;
  bot?: Bot | null;
}) {
  return {
    /** POST /telegram/link-token (auth talab qilinadi) */
    async createLinkToken(req: Request, res: Response) {
      if (!req.auth) throw new UnauthorizedError();
      const result = await telegramService.generateLinkToken(
        req.auth.userId,
        req.auth.companyId,
        deps.botUsername,
      );
      sendOk(res, result);
    },

    /** GET /telegram/status (auth talab qilinadi) */
    async getStatus(req: Request, res: Response) {
      if (!req.auth) throw new UnauthorizedError();
      const status = await telegramService.getTelegramStatus(
        req.auth.userId,
        req.auth.companyId,
      );
      sendOk(res, status);
    },

    /** POST /telegram/unlink (auth talab qilinadi) */
    async unlink(req: Request, res: Response) {
      if (!req.auth) throw new UnauthorizedError();
      const result = await telegramService.unlinkTelegram(
        req.auth.userId,
        req.auth.companyId,
        requestMeta(req),
      );
      sendOk(res, result);
    },

    /** POST /telegram/webapp-auth (ommaviy) */
    async webAppAuth(req: Request, res: Response) {
      if (!deps.botToken) {
        throw new UnauthorizedError('Telegram bot tokeni sozlanmagan');
      }
      const body = req.validated.body as WebAppAuthBody;
      const { accessToken, refreshToken, user } = await telegramService.authenticateWebApp(
        deps.config,
        body.initData,
        deps.botToken,
        requestMeta(req),
      );

      setRefreshCookie(res, refreshToken, deps.config);
      sendOk(res, { accessToken, user });
    },

    /** POST /telegram/webhook (production Telegram webhook) */
    async webhook(req: Request, res: Response) {
      const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
      const expectedSecret = deps.webhookSecret;
      if (!expectedSecret || typeof secretHeader !== 'string') {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: "Webhook secret noto'g'ri" } });
        return;
      }
      const providedBuf = Buffer.from(secretHeader);
      const expectedBuf = Buffer.from(expectedSecret);
      if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: "Webhook secret noto'g'ri" } });
        return;
      }
      if (deps.bot) {
        await deps.bot.handleUpdate(req.body);
      }
      res.status(200).send('OK');
    },
  };
}
