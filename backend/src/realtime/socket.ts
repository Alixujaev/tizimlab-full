import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { touchSession } from '../modules/auth/auth.service.js';
import type { AuthConfig } from '../modules/auth/auth.types.js';
import { verifyAccessToken } from '../modules/auth/tokens.js';
import { setNotificationChannel } from '../modules/notifications/notifications.service.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export const NOTIFICATION_EVENT = 'notification:new';
export const userRoom = (userId: string): string => `user:${userId}`;

interface SocketData {
  userId: string;
  companyId: string;
}

export interface SocketServerOptions {
  auth: AuthConfig;
  /** CORS origin (`FRONTEND_URL`); `undefined` — faqat bir xil origin. */
  corsOrigin?: string;
}

/** Handshake xatosi: client `connect_error` da `err.message` (kod) va `err.data` ni oladi. */
function handshakeError(code: string): Error & { data: { code: string } } {
  return Object.assign(new Error(code), { data: { code } });
}

/**
 * Socket.IO bir xil HTTP server ustida (R-ARCH-16). Handshake REST bilan bir xil tekshiriladi:
 * `verifyAccessToken` (R-AUTH-15) + sessiya/foydalanuvchi/kompaniya faolligi (`touchSession`).
 * Har ulanish faqat o'z `user:<id>` xonasiga qo'shiladi (R-NOTIF-15) — kompaniya xonasi yo'q,
 * shuning uchun push faqat qabul qiluvchining o'ziga boradi.
 */
export function createSocketServer(httpServer: HttpServer, opts: SocketServerOptions): Server {
  const io = new Server<
    Record<string, never>,
    Record<string, never>,
    Record<string, never>,
    SocketData
  >(httpServer, {
    cors: { origin: opts.corsOrigin ?? false, credentials: true },
    serveClient: false,
  });

  io.use(async (socket: Socket, next) => {
    const token: unknown = socket.handshake.auth?.token;
    if (typeof token !== 'string' || token.length === 0)
      return next(handshakeError('UNAUTHORIZED'));
    try {
      const claims = verifyAccessToken(token, opts.auth.accessSecret);
      // super_admin kompaniyasiz — xabarnomalar faqat kompaniya foydalanuvchilariga (D-13)
      if (!claims.company_id) return next(handshakeError('COMPANY_REQUIRED'));
      await touchSession(
        opts.auth,
        { sessionId: claims.sid, userId: claims.sub },
        {
          ip: socket.handshake.address ?? null,
          userAgent: socket.handshake.headers['user-agent'] ?? null,
        },
      );
      socket.data = { userId: claims.sub, companyId: claims.company_id } satisfies SocketData;
      next();
    } catch (err) {
      next(handshakeError(err instanceof AppError ? String(err.code) : 'UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    void socket.join(userRoom(socket.data.userId));
  });

  setNotificationChannel('socket', (userId, notification) => {
    io.to(userRoom(userId)).emit(NOTIFICATION_EVENT, notification);
  });

  io.engine.on('connection_error', (err: { code?: number; message?: string }) => {
    logger.debug('Socket.IO ulanish xatosi', { code: err.code, message: err.message });
  });

  return io;
}

/** Graceful shutdown va testlar uchun: kanalni uzib, serverni yopadi. */
export async function closeSocketServer(io: Server): Promise<void> {
  setNotificationChannel('socket', null);
  await io.close();
}
