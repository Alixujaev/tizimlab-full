import type { Env } from '../../config/env.js';

/** Spec §1: 6 ta rol (DB `user_role` enum bilan bir xil). */
export const ROLES = [
  'chemist',
  'lab_head',
  'director',
  'kontrolyor',
  'admin',
  'super_admin',
] as const;
export type Role = (typeof ROLES)[number];

export interface AuthConfig {
  accessSecret: string;
  refreshSecret: string;
  accessTtlMinutes: number;
  refreshTtlDays: number;
  idleMinutes: number;
  /** Refresh cookie `Secure` atributi — faqat production'da (D-88). */
  secureCookies: boolean;
}

export type AuthEnv = Pick<
  Env,
  | 'NODE_ENV'
  | 'JWT_ACCESS_SECRET'
  | 'JWT_REFRESH_SECRET'
  | 'JWT_ACCESS_TTL_MINUTES'
  | 'JWT_REFRESH_TTL_DAYS'
  | 'SESSION_IDLE_TIMEOUT_MINUTES'
>;

export function authConfigFromEnv(env: AuthEnv): AuthConfig {
  return {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTtlMinutes: env.JWT_ACCESS_TTL_MINUTES,
    refreshTtlDays: env.JWT_REFRESH_TTL_DAYS,
    idleMinutes: env.SESSION_IDLE_TIMEOUT_MINUTES,
    secureCookies: env.NODE_ENV === 'production',
  };
}

/** D-87: access token claim'lari. */
export interface AccessClaims {
  sub: string;
  role: Role;
  company_id: string | null;
  sid: string;
}

/** `authenticate` dan keyin `req.auth` da. */
export interface AuthContext {
  userId: string;
  role: Role;
  companyId: string | null;
  sessionId: string;
  /** `requirePermission` keshi — so'rov davomida bitta DB so'rovi (R-USER-10). */
  grants?: Promise<ReadonlySet<string>>;
}

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

/** `GET /auth/me` va login javobidagi foydalanuvchi — parol xeshi/token hech qachon yo'q. */
export interface MeDto {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  companyId: string | null;
  company: { id: string; name: string; slug: string } | null;
}

export const REFRESH_COOKIE = 'refresh_token';
export const REFRESH_COOKIE_PATH = '/api/v1/auth/refresh';
/** D-89: bir foydalanuvchida bir vaqtda ko'pi bilan 3 ta faol sessiya. */
export const MAX_SESSIONS = 3;
/** D-90: `last_activity` ko'pi bilan daqiqada bir marta yoziladi. */
export const ACTIVITY_WRITE_INTERVAL_SECONDS = 60;
