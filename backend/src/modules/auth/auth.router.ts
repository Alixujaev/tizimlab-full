import { type RequestHandler, Router } from 'express';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { createAuthController } from './auth.controller.js';
import {
  changePasswordSchema,
  loginBodySchema,
  updateProfileSchema,
} from './auth.schemas.js';
import type { AuthConfig } from './auth.types.js';

/**
 * @openapi
 * components:
 *   schemas:
 *     Me:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         email: { type: string, format: email }
 *         fullName: { type: string }
 *         role: { type: string, enum: [chemist, lab_head, director, kontrolyor, admin, super_admin] }
 *         companyId: { type: string, format: uuid, nullable: true }
 *         company:
 *           type: object
 *           nullable: true
 *           properties:
 *             id: { type: string, format: uuid }
 *             name: { type: string }
 *             slug: { type: string }
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: object
 *           properties:
 *             code: { type: string }
 *             message: { type: string }
 *             details: {}
 *             requestId: { type: string }
 */
export function createAuthRouter(deps: {
  config: AuthConfig;
  auth: AuthMiddleware;
  loginLimiter: RequestHandler;
}): Router {
  const router = Router();
  const controller = createAuthController(deps.config);

  /**
   * @openapi
   * /auth/login:
   *   post:
   *     tags: [Auth]
   *     summary: Email va parol bilan kirish
   *     description: Muvaffaqiyatda access token qaytaradi va refresh tokenni HttpOnly cookie'ga yozadi (path /api/v1/auth/refresh).
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, password]
   *             properties:
   *               email: { type: string, format: email }
   *               password: { type: string, format: password }
   *     responses:
   *       200:
   *         description: Kirildi
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   properties:
   *                     accessToken: { type: string }
   *                     user: { $ref: '#/components/schemas/Me' }
   *       400: { description: Validatsiya xatosi, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
   *       401: { description: INVALID_CREDENTIALS, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
   *       403: { description: ACCOUNT_INACTIVE, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
   *       429: { description: RATE_LIMITED (15 daqiqada 10 urinish), content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
   */
  router.post('/login', deps.loginLimiter, validate({ body: loginBodySchema }), controller.login);

  /**
   * @openapi
   * /auth/refresh:
   *   post:
   *     tags: [Auth]
   *     summary: Refresh cookie bo'yicha yangi access token (rotatsiya bilan)
   *     responses:
   *       200:
   *         description: Yangi access token; refresh cookie almashtiriladi
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   properties:
   *                     accessToken: { type: string }
   *       401: { description: UNAUTHORIZED / SESSION_EXPIRED / TOKEN_REUSED, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
   */
  router.post('/refresh', controller.refresh);

  /**
   * @openapi
   * /auth/logout:
   *   post:
   *     tags: [Auth]
   *     summary: Joriy sessiyani bekor qilish
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       204: { description: Chiqildi, refresh cookie tozalandi }
   *       401: { description: UNAUTHORIZED / SESSION_EXPIRED, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
   */
  router.post('/logout', ...deps.auth.requireAuth, controller.logout);

  /**
   * @openapi
   * /auth/me:
   *   get:
   *     tags: [Auth]
   *     summary: Joriy foydalanuvchi
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: Foydalanuvchi
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data: { $ref: '#/components/schemas/Me' }
   *       401: { description: UNAUTHORIZED / SESSION_EXPIRED, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
   */
  router.get('/me', ...deps.auth.requireAuth, controller.me);

  router.put(
    '/password',
    ...deps.auth.requireAuth,
    validate({ body: changePasswordSchema }),
    controller.changePassword,
  );

  router.get('/profile', ...deps.auth.requireAuth, controller.getProfile);

  router.patch(
    '/profile',
    ...deps.auth.requireAuth,
    validate({ body: updateProfileSchema }),
    controller.updateProfile,
  );

  return router;
}
