import type pg from 'pg';
import { query } from '../../config/database.js';

// D-64: audit ilova darajasida yoziladi (DB trigger emas) — o'zgartirish bilan BIR tranzaksiyada
// (`withTransaction` ichidagi client uzatiladi). D-62: sezgir qiymatlar audit'ga tushmaydi.

/** Auth hodisalari jadvali nomi — `record_id` faqat shunda NULL bo'lishi mumkin (D-80, DB CHECK). */
export const AUTH_AUDIT_TABLE = 'auth';

export type AuthAuditAction =
  'login_success' | 'login_failed' | 'logout' | 'token_refresh_reuse' | 'session_revoked';

export interface AuditEntry {
  tableName: string;
  recordId?: string | null;
  action: string;
  userId?: string | null;
  companyId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

// Kalit nomi normallashtiriladi: `passwordHash`, `password_hash`, `refresh-token` — barchasi bir xil
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'tokenhash',
  'refreshtoken',
  'accesstoken',
]);
const normalizeKey = (key: string) => key.toLowerCase().replace(/[_-]/g, '');

/** Sezgir kalitlarni (D-62) rekursiv ravishda olib tashlaydi; asl ob'ekt o'zgarmaydi. */
export function sanitizeAuditValues(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((v) => sanitizeAuditValues(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(normalizeKey(key))) continue;
    out[key] = sanitizeAuditValues(v, depth + 1);
  }
  return out;
}

const toJson = (value: unknown) =>
  value === undefined || value === null ? null : JSON.stringify(sanitizeAuditValues(value));

export async function writeAudit(
  db: pg.Pool | pg.PoolClient | undefined,
  entry: AuditEntry,
): Promise<void> {
  await query(
    `INSERT INTO audit_log
       (user_id, company_id, table_name, record_id, action, old_values, new_values, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      entry.userId ?? null,
      entry.companyId ?? null,
      entry.tableName,
      entry.recordId ?? null,
      entry.action,
      toJson(entry.oldValues),
      toJson(entry.newValues),
      entry.ip ?? null,
      entry.userAgent ?? null,
    ],
    db,
  );
}
