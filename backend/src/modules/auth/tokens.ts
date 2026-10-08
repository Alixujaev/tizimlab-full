import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../../utils/errors.js';
import { ROLES, type AccessClaims, type AuthConfig, type Role } from './auth.types.js';

const ALGORITHM = 'HS256';

export const sha256 = (value: string): string =>
  createHash('sha256').update(value, 'utf8').digest('hex');

export function signAccessToken(claims: AccessClaims, cfg: AuthConfig): string {
  return jwt.sign(
    { typ: 'access', role: claims.role, company_id: claims.company_id, sid: claims.sid },
    cfg.accessSecret,
    { algorithm: ALGORITHM, subject: claims.sub, expiresIn: `${cfg.accessTtlMinutes}m` },
  );
}

const isUuidLike = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/**
 * D-87: access tokenni tekshiradigan YAGONA funksiya — REST va (P6) Socket.IO handshake ikkalasi shuni ishlatadi.
 * Imzo, muddat, algoritm va claim tuzilmasi tekshiriladi; har qanday xato — 401.
 */
export function verifyAccessToken(token: string, secret: string): AccessClaims {
  let payload: jwt.JwtPayload | string;
  try {
    payload = jwt.verify(token, secret, { algorithms: [ALGORITHM] });
  } catch {
    throw new UnauthorizedError("Token yaroqsiz yoki muddati o'tgan");
  }
  if (
    typeof payload === 'string' ||
    payload.typ !== 'access' ||
    !isUuidLike(payload.sub) ||
    !isUuidLike(payload.sid) ||
    !ROLES.includes(payload.role as Role) ||
    !(payload.company_id === null || isUuidLike(payload.company_id))
  ) {
    throw new UnauthorizedError('Token yaroqsiz');
  }
  return {
    sub: payload.sub,
    sid: payload.sid as string,
    role: payload.role as Role,
    company_id: payload.company_id as string | null,
  };
}

export interface RefreshClaims {
  sub: string;
  sid: string;
}

/** Har chiqarilganda noyob (`jti`) — rotatsiyadan keyin eski token xeshi bilan farqlanadi. */
export function signRefreshToken(claims: RefreshClaims, cfg: AuthConfig): string {
  return jwt.sign({ typ: 'refresh', sid: claims.sid }, cfg.refreshSecret, {
    algorithm: ALGORITHM,
    subject: claims.sub,
    jwtid: randomUUID(),
    expiresIn: `${cfg.refreshTtlDays}d`,
  });
}

export function verifyRefreshToken(token: string, secret: string): RefreshClaims {
  let payload: jwt.JwtPayload | string;
  try {
    payload = jwt.verify(token, secret, { algorithms: [ALGORITHM] });
  } catch {
    throw new UnauthorizedError("Refresh token yaroqsiz yoki muddati o'tgan");
  }
  if (
    typeof payload === 'string' ||
    payload.typ !== 'refresh' ||
    !isUuidLike(payload.sub) ||
    !isUuidLike(payload.sid)
  ) {
    throw new UnauthorizedError('Refresh token yaroqsiz');
  }
  return { sub: payload.sub, sid: payload.sid as string };
}
