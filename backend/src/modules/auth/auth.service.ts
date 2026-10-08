import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { query, withTransaction } from '../../config/database.js';
import { AUTH_AUDIT_TABLE, writeAudit } from '../audit/audit.service.js';
import { ValidationError } from '../../utils/errors.js';
import {
  AccountInactiveError,
  InvalidCredentialsError,
  SessionExpiredError,
  TokenReusedError,
} from './auth.errors.js';
import {
  ACTIVITY_WRITE_INTERVAL_SECONDS,
  MAX_SESSIONS,
  type AuthConfig,
  type MeDto,
  type RequestMeta,
  type Role,
} from './auth.types.js';
import {
  assertPasswordPolicy,
  getDummyHash,
  hashPassword,
  verifyPassword,
} from './password.js';
import { sha256, signAccessToken, signRefreshToken, verifyRefreshToken } from './tokens.js';

const SESSIONS_TABLE = 'sessions';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  company_id: string | null;
  company_name: string | null;
  company_slug: string | null;
  company_active: boolean | null;
}

const USER_SELECT = `
  SELECT u.id, u.email, u.password_hash, u.full_name, u.role, u.is_active, u.company_id,
         c.name AS company_name, c.slug AS company_slug, c.is_active AS company_active
  FROM users u
  LEFT JOIN companies c ON c.id = u.company_id`;

function toMe(row: UserRow): MeDto {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    companyId: row.company_id,
    company:
      row.company_id && row.company_name && row.company_slug
        ? { id: row.company_id, name: row.company_name, slug: row.company_slug }
        : null,
  };
}

/** Foydalanuvchi va uning kompaniyasi faolmi (D-34, D-91). */
const isAccountActive = (row: {
  is_active: boolean;
  company_id: string | null;
  company_active: boolean | null;
}) => row.is_active && (row.company_id === null || row.company_active === true);

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

function refreshExpiry(cfg: AuthConfig): Date {
  return new Date(Date.now() + cfg.refreshTtlDays * 24 * 60 * 60 * 1000);
}

function issueAccessToken(
  user: { id: string; role: Role; company_id: string | null },
  sessionId: string,
  cfg: AuthConfig,
): string {
  return signAccessToken(
    { sub: user.id, role: user.role, company_id: user.company_id, sid: sessionId },
    cfg,
  );
}

export async function login(
  cfg: AuthConfig,
  credentials: { email: string; password: string },
  meta: RequestMeta,
): Promise<IssuedTokens & { user: MeDto }> {
  const { rows } = await query<UserRow>(`${USER_SELECT} WHERE u.email = $1`, [credentials.email]);
  const user = rows[0];
  // Noma'lum email'da ham bcrypt.compare — javob vaqti farqlanmasin
  const passwordOk = await verifyPassword(
    credentials.password,
    user?.password_hash ?? (await getDummyHash()),
  );

  if (!user || !passwordOk) {
    await writeAudit(undefined, {
      tableName: AUTH_AUDIT_TABLE,
      action: 'login_failed',
      userId: user?.id ?? null,
      companyId: user?.company_id ?? null,
      newValues: { email: credentials.email, reason: user ? 'invalid_password' : 'unknown_email' },
      ...auditMeta(meta),
    });
    throw new InvalidCredentialsError();
  }
  if (!isAccountActive(user)) {
    await writeAudit(undefined, {
      tableName: AUTH_AUDIT_TABLE,
      action: 'login_failed',
      userId: user.id,
      companyId: user.company_id,
      newValues: { email: credentials.email, reason: 'inactive' },
      ...auditMeta(meta),
    });
    throw new AccountInactiveError();
  }

  return withTransaction(async (client) => {
    // Bir foydalanuvchining parallel login'lari sessiya limitini buzmasligi uchun
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [user.id]);
    await client.query('DELETE FROM sessions WHERE user_id = $1 AND expires_at <= now()', [
      user.id,
    ]);

    const sessionId = randomUUID();
    const refreshToken = signRefreshToken({ sub: user.id, sid: sessionId }, cfg);
    await client.query(
      `INSERT INTO sessions (id, user_id, token_hash, ip_address, user_agent, expires_at, last_activity)
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [sessionId, user.id, sha256(refreshToken), meta.ip, meta.userAgent, refreshExpiry(cfg)],
    );

    // D-89 (Q-58): 3 tadan ortig'i — eng uzoq ishlatilmaganlari o'chiriladi
    const evicted = await client.query<{ id: string }>(
      `DELETE FROM sessions WHERE id IN (
         SELECT id FROM sessions WHERE user_id = $1
         ORDER BY COALESCE(last_activity, created_at) DESC, created_at DESC, id
         OFFSET $2)
       RETURNING id`,
      [user.id, MAX_SESSIONS],
    );
    for (const s of evicted.rows) {
      await revokedAudit(client, user, s.id, 'session_limit', meta);
    }

    await client.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
    await writeAudit(client, {
      tableName: SESSIONS_TABLE,
      recordId: sessionId,
      action: 'login_success',
      userId: user.id,
      companyId: user.company_id,
      ...auditMeta(meta),
    });

    return {
      accessToken: issueAccessToken(user, sessionId, cfg),
      refreshToken,
      user: toMe(user),
    };
  });
}

interface SessionStateRow {
  id: string;
  user_id: string;
  token_hash: string;
  expired: boolean;
  idle: boolean;
  stale: boolean;
  role: Role;
  company_id: string | null;
  is_active: boolean;
  company_active: boolean | null;
}

// Vaqt hisoblari DB soati bilan (ilova va DB soatlari farqi idle'ga ta'sir qilmasin)
const SESSION_STATE_SELECT = `
  SELECT s.id, s.user_id, s.token_hash,
         s.expires_at <= now() AS expired,
         COALESCE(s.last_activity, s.created_at) < now() - make_interval(mins => $3::int) AS idle,
         COALESCE(s.last_activity, s.created_at) < now() - make_interval(secs => $4::int) AS stale,
         u.role, u.company_id, u.is_active, c.is_active AS company_active
  FROM sessions s
  JOIN users u ON u.id = s.user_id
  LEFT JOIN companies c ON c.id = u.company_id
  WHERE s.id = $1 AND s.user_id = $2`;

type RevokeReason = 'idle' | 'expired' | 'inactive' | 'session_limit';

function revokeReason(row: SessionStateRow): RevokeReason | null {
  if (row.expired) return 'expired';
  if (row.idle) return 'idle';
  if (!isAccountActive(row)) return 'inactive';
  return null;
}

async function revokedAudit(
  db: pg.PoolClient | undefined,
  user: { id: string; company_id: string | null },
  sessionId: string,
  reason: RevokeReason,
  meta: RequestMeta,
): Promise<void> {
  await writeAudit(db, {
    tableName: SESSIONS_TABLE,
    recordId: sessionId,
    action: 'session_revoked',
    userId: user.id,
    companyId: user.company_id,
    newValues: { reason },
    ...auditMeta(meta),
  });
}

async function revokeSession(
  row: SessionStateRow,
  reason: RevokeReason,
  meta: RequestMeta,
): Promise<void> {
  await withTransaction(async (client) => {
    const { rowCount } = await client.query('DELETE FROM sessions WHERE id = $1', [row.id]);
    if (rowCount)
      await revokedAudit(
        client,
        { id: row.user_id, company_id: row.company_id },
        row.id,
        reason,
        meta,
      );
  });
}

/**
 * Har himoyalangan so'rovda (`sessionTimeout`): sessiya mavjud, muddati/idle o'tmagan, foydalanuvchi va kompaniya faol.
 * Aks holda sessiya o'chiriladi va SESSION_EXPIRED. `last_activity` daqiqada ko'pi bilan bir marta yoziladi (D-90).
 */
export async function touchSession(
  cfg: AuthConfig,
  session: { sessionId: string; userId: string },
  meta: RequestMeta,
): Promise<void> {
  const { rows } = await query<SessionStateRow>(SESSION_STATE_SELECT, [
    session.sessionId,
    session.userId,
    cfg.idleMinutes,
    ACTIVITY_WRITE_INTERVAL_SECONDS,
  ]);
  const row = rows[0];
  if (!row) throw new SessionExpiredError();
  const reason = revokeReason(row);
  if (reason) {
    await revokeSession(row, reason, meta);
    throw new SessionExpiredError();
  }
  if (row.stale) {
    await query('UPDATE sessions SET last_activity = now() WHERE id = $1', [row.id]);
  }
}

/** D-88: rotatsiya; almashtirilgan (eski) token qayta kelsa — sessiya bekor, TOKEN_REUSED. */
export async function refresh(
  cfg: AuthConfig,
  refreshToken: string,
  meta: RequestMeta,
): Promise<IssuedTokens> {
  const claims = verifyRefreshToken(refreshToken, cfg.refreshSecret);
  const { rows } = await query<SessionStateRow>(SESSION_STATE_SELECT, [
    claims.sid,
    claims.sub,
    cfg.idleMinutes,
    ACTIVITY_WRITE_INTERVAL_SECONDS,
  ]);
  const row = rows[0];
  if (!row) throw new SessionExpiredError();

  const presentedHash = sha256(refreshToken);
  if (row.token_hash !== presentedHash) {
    await withTransaction(async (client) => {
      await client.query('DELETE FROM sessions WHERE id = $1', [row.id]);
      await writeAudit(client, {
        tableName: SESSIONS_TABLE,
        recordId: row.id,
        action: 'token_refresh_reuse',
        userId: row.user_id,
        companyId: row.company_id,
        ...auditMeta(meta),
      });
    });
    throw new TokenReusedError();
  }
  const reason = revokeReason(row);
  if (reason) {
    await revokeSession(row, reason, meta);
    throw new SessionExpiredError();
  }

  const nextRefresh = signRefreshToken({ sub: row.user_id, sid: row.id }, cfg);
  // Optimistik tekshiruv: parallel refresh token'ni allaqachon almashtirgan bo'lsa — qayta ishlatish deb qaraladi
  const updated = await query(
    `UPDATE sessions SET token_hash = $1, expires_at = $2, last_activity = now()
     WHERE id = $3 AND token_hash = $4`,
    [sha256(nextRefresh), refreshExpiry(cfg), row.id, presentedHash],
  );
  if (!updated.rowCount) throw new TokenReusedError();

  return {
    accessToken: issueAccessToken(
      { id: row.user_id, role: row.role, company_id: row.company_id },
      row.id,
      cfg,
    ),
    refreshToken: nextRefresh,
  };
}

export async function logout(
  session: { sessionId: string; userId: string; companyId: string | null },
  meta: RequestMeta,
): Promise<void> {
  await withTransaction(async (client) => {
    const { rowCount } = await client.query('DELETE FROM sessions WHERE id = $1 AND user_id = $2', [
      session.sessionId,
      session.userId,
    ]);
    if (!rowCount) return;
    await writeAudit(client, {
      tableName: SESSIONS_TABLE,
      recordId: session.sessionId,
      action: 'logout',
      userId: session.userId,
      companyId: session.companyId,
      ...auditMeta(meta),
    });
  });
}

export async function getMe(userId: string): Promise<MeDto> {
  const { rows } = await query<UserRow>(`${USER_SELECT} WHERE u.id = $1`, [userId]);
  if (!rows[0]) throw new SessionExpiredError();
  return toMe(rows[0]);
}

/**
 * Parolni almashtirish: joriy parol tekshiriladi, yangi parol o'rnatiladi,
 * joriy sessiyadan boshqa barcha sessiyalar darhol bekor qilinadi.
 */
export async function changePassword(
  userId: string,
  sessionId: string,
  input: { currentPassword: string; newPassword: string },
  meta: RequestMeta,
): Promise<void> {
  const { rows } = await query<{
    password_hash: string;
    is_active: boolean;
    company_id: string | null;
  }>('SELECT password_hash, is_active, company_id FROM users WHERE id = $1', [userId]);
  const user = rows[0];
  if (!user || !user.is_active) throw new SessionExpiredError();

  if (input.currentPassword === input.newPassword) {
    throw new ValidationError("Yangi parol joriy parol bilan bir xil bo'lishi mumkin emas");
  }

  const matches = await verifyPassword(input.currentPassword, user.password_hash);
  if (!matches) {
    throw new ValidationError("Joriy parol noto'g'ri");
  }

  assertPasswordPolicy(input.newPassword);
  const newHash = await hashPassword(input.newPassword);

  await withTransaction(async (client) => {
    await client.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [
      newHash,
      userId,
    ]);

    const revoked = await client.query<{ id: string }>(
      'DELETE FROM sessions WHERE user_id = $1 AND id <> $2 RETURNING id',
      [userId, sessionId],
    );

    await writeAudit(client, {
      tableName: 'users',
      recordId: userId,
      action: 'password_change',
      userId,
      companyId: user.company_id,
      newValues: { revokedSessionsCount: revoked.rowCount ?? 0 },
      ...auditMeta(meta),
    });
  });
}

/** Profil ma'lumotlarini (ism) yangilash. */
export async function updateProfile(
  userId: string,
  input: { fullName: string },
  meta: RequestMeta,
): Promise<MeDto> {
  const { rows: currentRows } = await query<{
    full_name: string;
    company_id: string | null;
  }>('SELECT full_name, company_id FROM users WHERE id = $1', [userId]);
  const current = currentRows[0];
  if (!current) throw new SessionExpiredError();

  const updated = await withTransaction(async (client) => {
    await client.query('UPDATE users SET full_name = $1, updated_at = now() WHERE id = $2', [
      input.fullName,
      userId,
    ]);

    await writeAudit(client, {
      tableName: 'users',
      recordId: userId,
      action: 'profile_update',
      userId,
      companyId: current.company_id,
      oldValues: { fullName: current.full_name },
      newValues: { fullName: input.fullName },
      ...auditMeta(meta),
    });

    const { rows: updatedRows } = await client.query<UserRow>(
      `${USER_SELECT} WHERE u.id = $1`,
      [userId],
    );
    return toMe(updatedRows[0]!);
  });

  return updated;
}

/** Individual ruxsatlar (`resource:action`) — faqat o'z kompaniyasi doirasida (D-12, D-32). */
export async function loadUserGrants(
  userId: string,
  companyId: string | null,
): Promise<ReadonlySet<string>> {
  if (!companyId) return new Set();
  const { rows } = await query<{ resource: string; action: string }>(
    'SELECT resource, action FROM user_permissions WHERE user_id = $1 AND company_id = $2',
    [userId, companyId],
  );
  return new Set(rows.map((r) => `${r.resource}:${r.action}`));
}

function auditMeta(meta: RequestMeta) {
  return { ip: meta.ip, userAgent: meta.userAgent };
}
