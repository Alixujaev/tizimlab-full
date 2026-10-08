import { query, withTransaction } from '../../config/database.js';
import {
  type PermissionKey,
  ROLE_PERMISSIONS,
} from '../../config/permissions.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors.js';
import type { PaginatedResult } from '../../utils/pagination.js';
import { writeAudit } from '../audit/audit.service.js';
import type { RequestMeta, Role } from '../auth/auth.types.js';
import { assertPasswordPolicy, hashPassword } from '../auth/password.js';
import type {
  CreateUserInput,
  ListUsersQuery,
  ResetUserPasswordInput,
  SetUserPermissionsInput,
  UpdateUserInput,
} from './admin.schemas.js';
import type {
  AdminUserDto,
  UserAuditLogDto,
  UserPermissionsDto,
  UserStatsDto,
} from './admin.types.js';

interface DbUserRow {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  company_id: string;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
}

function toDto(row: DbUserRow): AdminUserDto {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    companyId: row.company_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    lastLoginAt: row.last_login_at ? row.last_login_at.toISOString() : null,
  };
}

export async function listUsers(
  companyId: string,
  params: ListUsersQuery,
): Promise<PaginatedResult<AdminUserDto>> {
  const whereClauses: string[] = ['u.company_id = $1'];
  const values: unknown[] = [companyId];

  if (params.role) {
    values.push(params.role);
    whereClauses.push(`u.role = $${values.length}`);
  }

  if (params.isActive !== undefined) {
    values.push(params.isActive);
    whereClauses.push(`u.is_active = $${values.length}`);
  }

  if (params.search) {
    values.push(`%${params.search}%`);
    whereClauses.push(`(u.email ILIKE $${values.length} OR u.full_name ILIKE $${values.length})`);
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

  const countRes = await query<{ count: string }>(
    `SELECT count(*)::text FROM users u ${whereSql}`,
    values,
  );
  const total = Number(countRes.rows[0]?.count ?? '0');

  const offset = (params.page - 1) * params.limit;
  const listValues = [...values, params.limit, offset];

  const { rows } = await query<DbUserRow>(
    `SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.company_id,
            u.created_at, u.updated_at, u.last_login_at
     FROM users u
     ${whereSql}
     ORDER BY u.created_at DESC
     LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    listValues,
  );

  return {
    items: rows.map(toDto),
    meta: {
      page: params.page,
      limit: params.limit,
      total,
    },
  };
}

export async function getUserStats(companyId: string): Promise<UserStatsDto> {
  const { rows } = await query<{ role: Role; is_active: boolean; count: string }>(
    `SELECT role, is_active, count(*)::text
     FROM users
     WHERE company_id = $1
     GROUP BY role, is_active`,
    [companyId],
  );

  let total = 0;
  let active = 0;
  let inactive = 0;
  const byRole: Record<string, number> = {};

  for (const r of rows) {
    const c = Number(r.count);
    total += c;
    if (r.is_active) active += c;
    else inactive += c;
    byRole[r.role] = (byRole[r.role] ?? 0) + c;
  }

  return { total, active, inactive, byRole };
}

export async function getUserById(companyId: string, userId: string): Promise<AdminUserDto> {
  const { rows } = await query<DbUserRow>(
    `SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.company_id,
            u.created_at, u.updated_at, u.last_login_at
     FROM users u
     WHERE u.id = $1 AND u.company_id = $2`,
    [userId, companyId],
  );
  if (!rows[0]) throw new NotFoundError('Foydalanuvchi topilmadi');
  return toDto(rows[0]);
}

/**
 * D-16: lab_head faqat kontrolyor va chemist yarata oladi.
 */
export async function createUser(
  companyId: string,
  actor: { userId: string; role: Role },
  input: CreateUserInput,
  meta: RequestMeta,
): Promise<AdminUserDto> {
  if (actor.role === 'lab_head') {
    if (input.role !== 'kontrolyor' && input.role !== 'chemist') {
      throw new ForbiddenError("Lab boshlig'i faqat kontrolyor va kimyogar yarata oladi");
    }
  }

  assertPasswordPolicy(input.password);
  const passwordHash = await hashPassword(input.password);

  try {
    return await withTransaction(async (client) => {
      const { rows } = await client.query<DbUserRow>(
        `INSERT INTO users (email, password_hash, full_name, role, company_id, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING id, email, full_name, role, is_active, company_id, created_at, updated_at, last_login_at`,
        [input.email, passwordHash, input.fullName, input.role, companyId],
      );
      const user = rows[0]!;

      await writeAudit(client, {
        tableName: 'users',
        recordId: user.id,
        action: 'user_create',
        userId: actor.userId,
        companyId,
        newValues: { email: user.email, role: user.role, fullName: user.full_name },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return toDto(user);
    });
  } catch (err) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      throw new ConflictError(`Bu email bilan foydalanuvchi allaqachon mavjud: ${input.email}`);
    }
    throw err;
  }
}

/**
 * D-16: lab_head faqat kontrolyor va chemist tahrirlay oladi.
 * Oxirgi admin himoyasi: kompaniyadagi oxirgi adminni nofaol/rolini o'zgartirib bo'lmaydi.
 */
export async function updateUser(
  companyId: string,
  actor: { userId: string; role: Role },
  targetUserId: string,
  input: UpdateUserInput,
  meta: RequestMeta,
): Promise<AdminUserDto> {
  const current = await getUserById(companyId, targetUserId);

  if (actor.role === 'lab_head') {
    if (current.role !== 'kontrolyor' && current.role !== 'chemist') {
      throw new ForbiddenError("Lab boshlig'i faqat kontrolyor va kimyogarni tahrirlay oladi");
    }
    if (input.role && input.role !== 'kontrolyor' && input.role !== 'chemist') {
      throw new ForbiddenError("Lab boshlig'i rolni faqat kontrolyor yoki kimyogarga o'zgartira oladi");
    }
  }

  if (actor.userId === targetUserId && input.isActive === false) {
    throw new ValidationError("O'z hisobingizni nofaol qila olmaysiz");
  }

  if (
    current.role === 'admin' &&
    (input.isActive === false || (input.role && input.role !== 'admin'))
  ) {
    const { rows } = await query<{ count: string }>(
      `SELECT count(*)::text FROM users
       WHERE company_id = $1 AND role = 'admin' AND is_active = true`,
      [companyId],
    );
    if (Number(rows[0]?.count ?? '0') <= 1) {
      throw new ValidationError('Kompaniyada kamida bitta faol administrator qolishi shart');
    }
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (input.fullName !== undefined) {
    values.push(input.fullName);
    updates.push(`full_name = $${values.length}`);
  }
  if (input.role !== undefined) {
    values.push(input.role);
    updates.push(`role = $${values.length}`);
  }
  if (input.isActive !== undefined) {
    values.push(input.isActive);
    updates.push(`is_active = $${values.length}`);
  }

  values.push(targetUserId, companyId);
  const sql = `UPDATE users SET ${updates.join(', ')}, updated_at = now()
               WHERE id = $${values.length - 1} AND company_id = $${values.length}
               RETURNING id, email, full_name, role, is_active, company_id, created_at, updated_at, last_login_at`;

  return await withTransaction(async (client) => {
    const { rows } = await client.query<DbUserRow>(sql, values);
    const updated = rows[0]!;

    let revokedSessionsCount = 0;
    if (input.isActive === false) {
      const revoked = await client.query<{ id: string }>(
        `DELETE FROM sessions WHERE user_id = $1 RETURNING id`,
        [targetUserId],
      );
      revokedSessionsCount = revoked.rowCount ?? 0;
    }

    await writeAudit(client, {
      tableName: 'users',
      recordId: targetUserId,
      action: 'user_update',
      userId: actor.userId,
      companyId,
      oldValues: {
        fullName: current.fullName,
        role: current.role,
        isActive: current.isActive,
      },
      newValues: {
        fullName: updated.full_name,
        role: updated.role,
        isActive: updated.is_active,
        revokedSessionsCount: revokedSessionsCount > 0 ? revokedSessionsCount : undefined,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return toDto(updated);
  });
}

/**
 * D-16: lab_head faqat kontrolyor va chemist parolini tiklay oladi.
 * Sessiyalar: foydalanuvchining barcha faol sessiyalari darhol bekor qilinadi.
 */
export async function resetUserPassword(
  companyId: string,
  actor: { userId: string; role: Role },
  targetUserId: string,
  input: ResetUserPasswordInput,
  meta: RequestMeta,
): Promise<void> {
  const current = await getUserById(companyId, targetUserId);

  if (actor.role === 'lab_head') {
    if (current.role !== 'kontrolyor' && current.role !== 'chemist') {
      throw new ForbiddenError("Lab boshlig'i faqat kontrolyor va kimyogar parolini tiklay oladi");
    }
  }

  assertPasswordPolicy(input.newPassword);
  const newHash = await hashPassword(input.newPassword);

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE users SET password_hash = $1, updated_at = now()
       WHERE id = $2 AND company_id = $3`,
      [newHash, targetUserId, companyId],
    );

    const revoked = await client.query<{ id: string }>(
      `DELETE FROM sessions WHERE user_id = $1 RETURNING id`,
      [targetUserId],
    );

    await writeAudit(client, {
      tableName: 'users',
      recordId: targetUserId,
      action: 'admin_password_reset',
      userId: actor.userId,
      companyId,
      newValues: { revokedSessionsCount: revoked.rowCount ?? 0 },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  });
}

export async function getUserPermissions(
  companyId: string,
  targetUserId: string,
): Promise<UserPermissionsDto> {
  const user = await getUserById(companyId, targetUserId);

  const { rows } = await query<{ resource: string; action: string }>(
    `SELECT resource, action FROM user_permissions
     WHERE user_id = $1 AND company_id = $2
     ORDER BY resource, action`,
    [targetUserId, companyId],
  );

  const individual = rows.map((r) => `${r.resource}:${r.action}` as PermissionKey);
  const roleDefaults = ROLE_PERMISSIONS[user.role] ?? [];
  const effective = Array.from(new Set([...roleDefaults, ...individual]));

  return {
    userId: targetUserId,
    role: user.role,
    rolePermissions: roleDefaults,
    individualPermissions: individual,
    effectivePermissions: effective,
  };
}

/**
 * Q-05, D-16, D-32: Faqat admin individual ruxsatlarni boshqaradi. Grant-only.
 */
export async function setUserPermissions(
  companyId: string,
  actorUserId: string,
  targetUserId: string,
  input: SetUserPermissionsInput,
  meta: RequestMeta,
): Promise<UserPermissionsDto> {
  await getUserById(companyId, targetUserId);

  const oldPerms = await getUserPermissions(companyId, targetUserId);

  await withTransaction(async (client) => {
    await client.query(
      `DELETE FROM user_permissions WHERE user_id = $1 AND company_id = $2`,
      [targetUserId, companyId],
    );

    for (const perm of input.permissions) {
      const [resource, action] = perm.split(':');
      if (resource && action) {
        await client.query(
          `INSERT INTO user_permissions (user_id, resource, action, granted_by, company_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [targetUserId, resource, action, actorUserId, companyId],
        );
      }
    }

    await writeAudit(client, {
      tableName: 'user_permissions',
      recordId: targetUserId,
      action: 'permissions_update',
      userId: actorUserId,
      companyId,
      oldValues: { permissions: oldPerms.individualPermissions },
      newValues: { permissions: input.permissions },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  });

  return await getUserPermissions(companyId, targetUserId);
}

export async function getUserLogs(
  companyId: string,
  targetUserId: string,
  params: { page: number; limit: number },
): Promise<PaginatedResult<UserAuditLogDto>> {
  await getUserById(companyId, targetUserId);

  const countRes = await query<{ count: string }>(
    `SELECT count(*)::text FROM audit_log
     WHERE user_id = $1 AND company_id = $2`,
    [targetUserId, companyId],
  );
  const total = Number(countRes.rows[0]?.count ?? '0');

  const offset = (params.page - 1) * params.limit;
  const { rows } = await query<{
    id: string;
    action: string;
    table_name: string;
    record_id: string | null;
    old_values: unknown;
    new_values: unknown;
    ip_address: string | null;
    user_agent: string | null;
    created_at: Date;
  }>(
    `SELECT id, action, table_name, record_id, old_values, new_values,
            ip_address::text, user_agent, created_at
     FROM audit_log
     WHERE user_id = $1 AND company_id = $2
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
    [targetUserId, companyId, params.limit, offset],
  );

  return {
    items: rows.map((r) => ({
      id: r.id,
      action: r.action,
      tableName: r.table_name,
      recordId: r.record_id,
      oldValues: r.old_values,
      newValues: r.new_values,
      ipAddress: r.ip_address,
      userAgent: r.user_agent,
      createdAt: r.created_at.toISOString(),
    })),
    meta: {
      page: params.page,
      limit: params.limit,
      total,
    },
  };
}
