import type pg from 'pg';
import { query } from '../../config/database.js';
import { NotFoundError } from '../../utils/errors.js';
import { toOffset, type PaginatedResult } from '../../utils/pagination.js';
import type { ListAuditLogsOptions } from './audit.schemas.js';
import type { AuditLogDto, AuditLogRow } from './audit.types.js';

// D-64: audit ilova darajasida yoziladi (DB trigger emas) — o'zgartirish bilan BIR tranzaksiyada
// (`withTransaction` ichidagi client uzatiladi). D-62, D-147: sezgir qiymatlar audit'ga tushmaydi.

/** Auth hodisalari jadvali nomi — `record_id` faqat shunda NULL bo'lishi mumkin (D-80, DB CHECK). */
export const AUTH_AUDIT_TABLE = 'auth';

export type AuthAuditAction =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'token_refresh_reuse'
  | 'session_revoked';

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
  'apikey',
  'sensorkey',
  'keyhash',
  'secret',
  'secretaccesskey',
  'authorization',
]);
const normalizeKey = (key: string) => key.toLowerCase().replace(/[_-]/g, '');

/** Sezgir kalitlarni (D-62, D-147) rekursiv ravishda olib tashlaydi; asl ob'ekt o'zgarmaydi. */
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

function sanitizeIp(ip?: string | null): string | null {
  if (!ip) return null;
  const clean = ip.trim().replace(/^::ffff:/, '');
  // IPv4 yoki IPv6 tekshiruvi
  const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(clean);
  const isIpv6 = clean === '::1' || clean.includes(':');
  return isIpv4 || isIpv6 ? clean : null;
}

export function toAuditLogDto(row: AuditLogRow): AuditLogDto {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name ?? null,
    userEmail: row.user_email ?? null,
    userRole: row.user_role ?? null,
    companyId: row.company_id,
    companyName: row.company_name ?? null,
    tableName: row.table_name,
    recordId: row.record_id,
    action: row.action,
    oldValues: row.old_values,
    newValues: row.new_values,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

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
      entry.action.slice(0, 20),
      toJson(entry.oldValues),
      toJson(entry.newValues),
      sanitizeIp(entry.ip),
      entry.userAgent ?? null,
    ],
    db,
  );
}

export async function listAuditLogs(
  options: ListAuditLogsOptions,
): Promise<PaginatedResult<AuditLogDto>> {
  const page = options.page ?? 1;
  const limit = options.limit ?? 20;
  const offset = toOffset({ page, limit });

  const conditions: string[] = ['1=1'];
  const values: unknown[] = [];

  // Tenant cheklovi: agar companyIdConstraint berilgan bo'lsa (masalan, kompaniya rollari yoki faoliyat jurnali uchun)
  if (options.companyIdConstraint !== undefined) {
    if (options.companyIdConstraint === null) {
      // super_admin agar companyId filteri kiritgan bo'lsa
      if (options.companyId) {
        values.push(options.companyId);
        conditions.push(`al.company_id = $${values.length}`);
      }
    } else {
      values.push(options.companyIdConstraint);
      conditions.push(`al.company_id = $${values.length}`);
    }
  } else if (options.companyId) {
    values.push(options.companyId);
    conditions.push(`al.company_id = $${values.length}`);
  }

  if (options.userId) {
    values.push(options.userId);
    conditions.push(`al.user_id = $${values.length}`);
  }

  if (options.action) {
    values.push(options.action);
    conditions.push(`al.action = $${values.length}`);
  }

  const table = options.tableName || options.resource;
  if (table) {
    values.push(table);
    conditions.push(`al.table_name = $${values.length}`);
  }

  if (options.recordId) {
    values.push(options.recordId);
    conditions.push(`al.record_id = $${values.length}`);
  }

  if (options.from) {
    values.push(options.from);
    conditions.push(`al.created_at >= $${values.length}::date`);
  }

  if (options.to) {
    values.push(options.to);
    conditions.push(`al.created_at < ($${values.length}::date + INTERVAL '1 day')`);
  }

  if (options.search) {
    values.push(`%${options.search}%`);
    const idx = values.length;
    conditions.push(`(
      al.action ILIKE $${idx} OR
      al.table_name ILIKE $${idx} OR
      u.full_name ILIKE $${idx} OR
      u.email ILIKE $${idx} OR
      c.name ILIKE $${idx}
    )`);
  }

  const whereClause = conditions.join(' AND ');

  const countSql = `
    SELECT count(*)::text
    FROM audit_log al
    LEFT JOIN users u ON u.id = al.user_id
    LEFT JOIN companies c ON c.id = al.company_id
    WHERE ${whereClause}
  `;
  const countRes = await query<{ count: string }>(countSql, values);
  const total = Number(countRes.rows[0]?.count ?? '0');

  const listSql = `
    SELECT al.id, al.user_id, al.company_id, al.table_name, al.record_id,
           al.action, al.old_values, al.new_values, al.ip_address::text,
           al.user_agent, al.created_at,
           u.full_name AS user_name, u.email AS user_email, u.role AS user_role,
           c.name AS company_name
    FROM audit_log al
    LEFT JOIN users u ON u.id = al.user_id
    LEFT JOIN companies c ON c.id = al.company_id
    WHERE ${whereClause}
    ORDER BY al.created_at DESC
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}
  `;
  const listRes = await query<AuditLogRow>(listSql, [...values, limit, offset]);

  return {
    items: listRes.rows.map(toAuditLogDto),
    meta: {
      page,
      limit,
      total,
    },
  };
}

export async function getAuditLogById(
  id: string,
  companyIdConstraint?: string | null,
): Promise<AuditLogDto> {
  const conditions = ['al.id = $1'];
  const values: unknown[] = [id];

  if (companyIdConstraint !== undefined && companyIdConstraint !== null) {
    values.push(companyIdConstraint);
    conditions.push(`al.company_id = $${values.length}`);
  }

  const { rows } = await query<AuditLogRow>(
    `SELECT al.id, al.user_id, al.company_id, al.table_name, al.record_id,
            al.action, al.old_values, al.new_values, al.ip_address::text,
            al.user_agent, al.created_at,
            u.full_name AS user_name, u.email AS user_email, u.role AS user_role,
            c.name AS company_name
     FROM audit_log al
     LEFT JOIN users u ON u.id = al.user_id
     LEFT JOIN companies c ON c.id = al.company_id
     WHERE ${conditions.join(' AND ')}`,
    values,
  );

  const row = rows[0];
  if (!row) {
    throw new NotFoundError('Audit yozuvi topilmadi');
  }

  return toAuditLogDto(row);
}
