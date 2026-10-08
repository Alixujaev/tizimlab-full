import { query, withTransaction } from '../../config/database.js';
import { ConflictError, NotFoundError } from '../../utils/errors.js';
import { type PaginatedResult } from '../../utils/pagination.js';
import { writeAudit } from '../audit/audit.service.js';
import type { RequestMeta } from '../auth/auth.types.js';
import { assertPasswordPolicy, hashPassword } from '../auth/password.js';
import type {
  CreateCompanyInput,
  ListCompaniesQuery,
  UpdateCompanyInput,
} from './companies.schemas.js';
import type { CompanyDto } from './companies.types.js';

interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  users_count?: string | number;
}

function toDto(row: CompanyRow): CompanyDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    ...(row.users_count !== undefined ? { usersCount: Number(row.users_count) } : {}),
  };
}

export async function listCompanies(
  params: ListCompaniesQuery,
): Promise<PaginatedResult<CompanyDto>> {
  const whereClauses: string[] = [];
  const values: unknown[] = [];

  if (params.search) {
    values.push(`%${params.search}%`);
    whereClauses.push(`(c.name ILIKE $${values.length} OR c.slug ILIKE $${values.length})`);
  }

  if (params.isActive !== undefined) {
    values.push(params.isActive);
    whereClauses.push(`c.is_active = $${values.length}`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countRes = await query<{ count: string }>(
    `SELECT count(*)::text FROM companies c ${whereSql}`,
    values,
  );
  const total = Number(countRes.rows[0]?.count ?? '0');

  const offset = (params.page - 1) * params.limit;
  const listValues = [...values, params.limit, offset];

  const { rows } = await query<CompanyRow>(
    `SELECT c.id, c.name, c.slug, c.is_active, c.created_at, c.updated_at,
            count(u.id)::int AS users_count
     FROM companies c
     LEFT JOIN users u ON u.company_id = c.id
     ${whereSql}
     GROUP BY c.id
     ORDER BY c.created_at DESC
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

export async function getCompany(id: string): Promise<CompanyDto> {
  const { rows } = await query<CompanyRow>(
    `SELECT c.id, c.name, c.slug, c.is_active, c.created_at, c.updated_at,
            count(u.id)::int AS users_count
     FROM companies c
     LEFT JOIN users u ON u.company_id = c.id
     WHERE c.id = $1
     GROUP BY c.id`,
    [id],
  );
  if (!rows[0]) throw new NotFoundError('Kompaniya topilmadi');
  return toDto(rows[0]);
}

/**
 * Q-09: Kompaniya va uning birinchi admin foydalanuvchisi bitta tranzaksiyada yaratiladi.
 */
export async function createCompany(
  input: CreateCompanyInput,
  meta: RequestMeta,
  superAdminUserId: string,
): Promise<{ company: CompanyDto; adminUserId: string }> {
  assertPasswordPolicy(input.admin.password);
  const passwordHash = await hashPassword(input.admin.password);

  try {
    return await withTransaction(async (client) => {
      const compRes = await client.query<CompanyRow>(
        `INSERT INTO companies (name, slug, is_active)
         VALUES ($1, $2, true)
         RETURNING id, name, slug, is_active, created_at, updated_at`,
        [input.name, input.slug],
      );
      const companyRow = compRes.rows[0]!;

      const userRes = await client.query<{ id: string }>(
        `INSERT INTO users (email, password_hash, full_name, role, company_id)
         VALUES ($1, $2, $3, 'admin', $4)
         RETURNING id`,
        [input.admin.email, passwordHash, input.admin.fullName, companyRow.id],
      );
      const adminUserId = userRes.rows[0]!.id;

      await writeAudit(client, {
        tableName: 'companies',
        recordId: companyRow.id,
        action: 'company_create',
        userId: superAdminUserId,
        companyId: null,
        newValues: { name: companyRow.name, slug: companyRow.slug },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      await writeAudit(client, {
        tableName: 'users',
        recordId: adminUserId,
        action: 'user_create',
        userId: superAdminUserId,
        companyId: companyRow.id,
        newValues: { email: input.admin.email, role: 'admin', fullName: input.admin.fullName },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return {
        company: toDto(companyRow),
        adminUserId,
        adminUser: {
          id: adminUserId,
          email: input.admin.email,
          fullName: input.admin.fullName,
          role: 'admin',
          isActive: true,
        },
      };
    });
  } catch (err) {
    const pgErr = err as { code?: string; constraint?: string };
    if (pgErr.code === '23505') {
      if (pgErr.constraint?.includes('slug')) {
        throw new ConflictError(`Bu slug bilan kompaniya allaqachon mavjud: ${input.slug}`);
      }
      if (pgErr.constraint?.includes('name')) {
        throw new ConflictError(`Bu nom bilan kompaniya allaqachon mavjud: ${input.name}`);
      }
      if (pgErr.constraint?.includes('email')) {
        throw new ConflictError(`Bu email bilan foydalanuvchi allaqachon mavjud: ${input.admin.email}`);
      }
      throw new ConflictError('Kompaniya yoki foydalanuvchi ma’lumotlarida to’qnashuv mavjud');
    }
    throw err;
  }
}

export async function updateCompany(
  id: string,
  input: UpdateCompanyInput,
  meta: RequestMeta,
  superAdminUserId: string,
): Promise<CompanyDto> {
  const current = await getCompany(id);

  const updates: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) {
    values.push(input.name);
    updates.push(`name = $${values.length}`);
  }
  if (input.slug !== undefined) {
    values.push(input.slug);
    updates.push(`slug = $${values.length}`);
  }

  values.push(id);
  const sql = `UPDATE companies SET ${updates.join(', ')}, updated_at = now()
               WHERE id = $${values.length}
               RETURNING id, name, slug, is_active, created_at, updated_at`;

  try {
    return await withTransaction(async (client) => {
      const { rows } = await client.query<CompanyRow>(sql, values);
      const updatedRow = rows[0]!;

      await writeAudit(client, {
        tableName: 'companies',
        recordId: id,
        action: 'company_update',
        userId: superAdminUserId,
        companyId: null,
        oldValues: { name: current.name, slug: current.slug },
        newValues: { name: updatedRow.name, slug: updatedRow.slug },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return toDto(updatedRow);
    });
  } catch (err) {
    const pgErr = err as { code?: string; constraint?: string };
    if (pgErr.code === '23505') {
      if (pgErr.constraint?.includes('slug')) {
        throw new ConflictError(`Bu slug bilan kompaniya allaqachon mavjud: ${input.slug}`);
      }
      if (pgErr.constraint?.includes('name')) {
        throw new ConflictError(`Bu nom bilan kompaniya allaqachon mavjud: ${input.name}`);
      }
    }
    throw err;
  }
}

export async function activateCompany(
  id: string,
  meta: RequestMeta,
  superAdminUserId: string,
): Promise<CompanyDto> {
  const current = await getCompany(id);
  if (current.isActive) return current;

  return await withTransaction(async (client) => {
    const { rows } = await client.query<CompanyRow>(
      `UPDATE companies SET is_active = true, updated_at = now()
       WHERE id = $1
       RETURNING id, name, slug, is_active, created_at, updated_at`,
      [id],
    );

    await writeAudit(client, {
      tableName: 'companies',
      recordId: id,
      action: 'company_activate',
      userId: superAdminUserId,
      companyId: null,
      oldValues: { isActive: false },
      newValues: { isActive: true },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return toDto(rows[0]!);
  });
}

/**
 * Q-08, D-34: Nofaollashtirilganda barcha foydalanuvchilarining sessiyalari darhol bekor qilinadi.
 */
export async function deactivateCompany(
  id: string,
  meta: RequestMeta,
  superAdminUserId: string,
): Promise<CompanyDto> {
  const current = await getCompany(id);
  if (!current.isActive) return current;

  return await withTransaction(async (client) => {
    const { rows } = await client.query<CompanyRow>(
      `UPDATE companies SET is_active = false, updated_at = now()
       WHERE id = $1
       RETURNING id, name, slug, is_active, created_at, updated_at`,
      [id],
    );

    const revokedRes = await client.query<{ id: string }>(
      `DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE company_id = $1) RETURNING id`,
      [id],
    );

    await writeAudit(client, {
      tableName: 'companies',
      recordId: id,
      action: 'company_deactivate',
      userId: superAdminUserId,
      companyId: null,
      oldValues: { isActive: true },
      newValues: { isActive: false, revokedSessionsCount: revokedRes.rowCount ?? 0 },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return toDto(rows[0]!);
  });
}
