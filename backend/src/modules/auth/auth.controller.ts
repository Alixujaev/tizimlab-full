import type { CookieOptions, Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors.js';
import { sendOk } from '../../utils/http.js';
import type { LoginBody } from './auth.schemas.js';
import * as authService from './auth.service.js';
import {
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  type AuthConfig,
  type AuthContext,
  type RequestMeta,
} from './auth.types.js';

const requestMeta = (req: Request): RequestMeta => ({
  ip: req.ip ?? null,
  userAgent: req.get('user-agent') ?? null,
});

/** D-88 (Q-61): HttpOnly, Secure (production), SameSite=Strict, faqat refresh yo'lida. */
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

/** `requireAuth` dan o'tgan so'rov konteksti. */
function authOf(req: Request): AuthContext {
  if (!req.auth) throw new UnauthorizedError();
  return req.auth;
}

export function createAuthController(cfg: AuthConfig) {
  return {
    async login(req: Request, res: Response) {
      const body = req.validated.body as LoginBody;
      const { accessToken, refreshToken, user } = await authService.login(
        cfg,
        body,
        requestMeta(req),
      );
      setRefreshCookie(res, refreshToken, cfg);
      sendOk(res, { accessToken, user });
    },

    async refresh(req: Request, res: Response) {
      const token: unknown = req.cookies?.[REFRESH_COOKIE];
      if (typeof token !== 'string' || !token)
        throw new UnauthorizedError('Refresh token topilmadi');
      try {
        const tokens = await authService.refresh(cfg, token, requestMeta(req));
        setRefreshCookie(res, tokens.refreshToken, cfg);
        sendOk(res, { accessToken: tokens.accessToken });
      } catch (err) {
        // Yaroqsiz cookie brauzerda qolib ketmasin
        res.clearCookie(REFRESH_COOKIE, cookieOptions(cfg));
        throw err;
      }
    },

    async logout(req: Request, res: Response) {
      const auth = authOf(req);
      await authService.logout(
        { sessionId: auth.sessionId, userId: auth.userId, companyId: auth.companyId },
        requestMeta(req),
      );
      res.clearCookie(REFRESH_COOKIE, cookieOptions(cfg));
      res.status(204).end();
    },

    async me(req: Request, res: Response) {
      sendOk(res, await authService.getMe(authOf(req).userId));
    },

    async changePassword(req: Request, res: Response) {
      const auth = authOf(req);
      const body = req.validated.body as { currentPassword: string; newPassword: string };
      await authService.changePassword(auth.userId, auth.sessionId, body, requestMeta(req));
      sendOk(res, { success: true });
    },

    async getProfile(req: Request, res: Response) {
      sendOk(res, await authService.getMe(authOf(req).userId));
    },

    async updateProfile(req: Request, res: Response) {
      const auth = authOf(req);
      const body = req.validated.body as { fullName: string };
      const updated = await authService.updateProfile(auth.userId, body, requestMeta(req));
      sendOk(res, updated);
    },
  };
}
