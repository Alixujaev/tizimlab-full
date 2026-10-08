import { query, withTransaction } from '../../config/database.js';
import { ConflictError, NotFoundError } from '../../utils/errors.js';
import { type PaginatedResult } from '../../utils/pagination.js';
import { writeAudit } from '../audit/audit.service.js';
import type { RequestMeta } from '../auth/auth.types.js';
import type {
  CreateSubstanceInput,
  ListSubstancesQuery,
  UpdateSubstanceInput,
} from './substances.schemas.js';
import type {
  SubstanceDetailDto,
  SubstanceDto,
  SubstanceParameterDto,
  SubstanceParameterRow,
  SubstanceRow,
} from './substances.types.js';

function toParameterDto(row: SubstanceParameterRow): SubstanceParameterDto {
  return {
    id: row.id,
    substanceId: row.substance_id,
    parameterName: row.parameter_name,
    unit: row.unit,
    specMin: row.spec_min !== null ? Number(row.spec_min) : null,
    specMax: row.spec_max !== null ? Number(row.spec_max) : null,
    method: row.method,
    sortOrder: Number(row.sort_order),
    createdAt: row.created_at.toISOString(),
  };
}

function toSubstanceDto(row: SubstanceRow): SubstanceDto {
  return {
    id: row.id,
    nameUz: row.name_uz,
    nameRu: row.name_ru,
    nameEn: row.name_en,
    pharmacopoeia: row.pharmacopoeia,
    casNumber: row.cas_number,
    description: row.description,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    companyId: row.company_id,
    ...(row.parameters_count !== undefined ? { parametersCount: Number(row.parameters_count) } : {}),
  };
}

export async function listSubstances(
  companyId: string,
  params: ListSubstancesQuery,
): Promise<PaginatedResult<SubstanceDto>> {
  const whereClauses: string[] = ['s.company_id = $1'];
  const values: unknown[] = [companyId];

  if (params.search) {
    values.push(`%${params.search}%`);
    const idx = values.length;
    whereClauses.push(
      `(s.name_uz ILIKE $${idx} OR s.name_ru ILIKE $${idx} OR s.name_en ILIKE $${idx} OR s.cas_number ILIKE $${idx})`,
    );
  }

  if (params.pharmacopoeia) {
    values.push(params.pharmacopoeia);
    whereClauses.push(`s.pharmacopoeia = $${values.length}`);
  }

  if (params.isActive !== undefined) {
    values.push(params.isActive);
    whereClauses.push(`s.is_active = $${values.length}`);
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

  const countRes = await query<{ count: string }>(
    `SELECT count(*)::text FROM substances s ${whereSql}`,
    values,
  );
  const total = Number(countRes.rows[0]?.count ?? '0');

  const offset = (params.page - 1) * params.limit;
  const pageValues = [...values, params.limit, offset];
  const limitIdx = pageValues.length - 1;
  const offsetIdx = pageValues.length;

  const dataRes = await query<SubstanceRow>(
    `SELECT s.*, count(sp.id)::int AS parameters_count
     FROM substances s
     LEFT JOIN substance_parameters sp ON sp.substance_id = s.id
     ${whereSql}
     GROUP BY s.id
     ORDER BY s.created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    pageValues,
  );

  return {
    items: dataRes.rows.map(toSubstanceDto),
    meta: {
      page: params.page,
      limit: params.limit,
      total,
    },
  };
}

export async function getSubstanceById(
  companyId: string,
  id: string,
): Promise<SubstanceDetailDto> {
  const subRes = await query<SubstanceRow>(
    `SELECT * FROM substances WHERE id = $1 AND company_id = $2`,
    [id, companyId],
  );

  const substance = subRes.rows[0];
  if (!substance) {
    throw new NotFoundError('Modda topilmadi');
  }

  const paramsRes = await query<SubstanceParameterRow>(
    `SELECT * FROM substance_parameters
     WHERE substance_id = $1 AND company_id = $2
     ORDER BY sort_order ASC, created_at ASC`,
    [id, companyId],
  );

  return {
    ...toSubstanceDto(substance),
    parameters: paramsRes.rows.map(toParameterDto),
  };
}

export async function createSubstance(
  companyId: string,
  userId: string,
  input: CreateSubstanceInput,
  meta: RequestMeta,
): Promise<SubstanceDetailDto> {
  return withTransaction(async (client) => {
    const insertSubSql = `
      INSERT INTO substances (
        name_uz, name_ru, name_en, pharmacopoeia, cas_number, description,
        is_active, created_by, company_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8)
      RETURNING *
    `;
    const subRes = await client.query<SubstanceRow>(insertSubSql, [
      input.nameUz,
      input.nameRu ?? null,
      input.nameEn ?? null,
      input.pharmacopoeia,
      input.casNumber ?? null,
      input.description ?? null,
      userId,
      companyId,
    ]);
    const substance = subRes.rows[0]!;

    const insertedParameters: SubstanceParameterRow[] = [];
    if (input.parameters && input.parameters.length > 0) {
      for (let i = 0; i < input.parameters.length; i++) {
        const p = input.parameters[i]!;
        const sortOrder = p.sortOrder !== undefined ? p.sortOrder : i;
        const insertParamSql = `
          INSERT INTO substance_parameters (
            substance_id, parameter_name, unit, spec_min, spec_max, method,
            sort_order, company_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `;
        const paramRes = await client.query<SubstanceParameterRow>(insertParamSql, [
          substance.id,
          p.parameterName,
          p.unit ?? null,
          p.specMin ?? null,
          p.specMax ?? null,
          p.method ?? null,
          sortOrder,
          companyId,
        ]);
        insertedParameters.push(paramRes.rows[0]!);
      }
    }

    await writeAudit(client, {
      userId,
      companyId,
      action: 'create',
      tableName: 'substances',
      recordId: substance.id,
      newValues: {
        name_uz: input.nameUz,
        name_ru: input.nameRu ?? null,
        name_en: input.nameEn ?? null,
        pharmacopoeia: input.pharmacopoeia,
        cas_number: input.casNumber ?? null,
        parameters_count: insertedParameters.length,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      ...toSubstanceDto(substance),
      parameters: insertedParameters.map(toParameterDto),
    };
  });
}

export async function updateSubstance(
  companyId: string,
  userId: string,
  id: string,
  input: UpdateSubstanceInput,
  meta: RequestMeta,
): Promise<SubstanceDetailDto> {
  return withTransaction(async (client) => {
    const existingRes = await client.query<SubstanceRow>(
      `SELECT * FROM substances WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [id, companyId],
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      throw new NotFoundError('Modda topilmadi');
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.nameUz !== undefined) {
      values.push(input.nameUz);
      updates.push(`name_uz = $${values.length}`);
    }
    if (input.nameRu !== undefined) {
      values.push(input.nameRu ?? null);
      updates.push(`name_ru = $${values.length}`);
    }
    if (input.nameEn !== undefined) {
      values.push(input.nameEn ?? null);
      updates.push(`name_en = $${values.length}`);
    }
    if (input.pharmacopoeia !== undefined) {
      values.push(input.pharmacopoeia);
      updates.push(`pharmacopoeia = $${values.length}`);
    }
    if (input.casNumber !== undefined) {
      values.push(input.casNumber ?? null);
      updates.push(`cas_number = $${values.length}`);
    }
    if (input.description !== undefined) {
      values.push(input.description ?? null);
      updates.push(`description = $${values.length}`);
    }
    if (input.isActive !== undefined) {
      values.push(input.isActive);
      updates.push(`is_active = $${values.length}`);
    }

    let updatedSubstance = existing;
    if (updates.length > 0) {
      values.push(id, companyId);
      const idIdx = values.length - 1;
      const compIdx = values.length;
      const updateSql = `
        UPDATE substances
        SET ${updates.join(', ')}
        WHERE id = $${idIdx} AND company_id = $${compIdx}
        RETURNING *
      `;
      const updateRes = await client.query<SubstanceRow>(updateSql, values);
      updatedSubstance = updateRes.rows[0]!;
    }

    let updatedParameters: SubstanceParameterRow[] = [];
    if (input.parameters !== undefined) {
      await client.query(
        `DELETE FROM substance_parameters WHERE substance_id = $1 AND company_id = $2`,
        [id, companyId],
      );

      for (let i = 0; i < input.parameters.length; i++) {
        const p = input.parameters[i]!;
        const sortOrder = p.sortOrder !== undefined ? p.sortOrder : i;
        const insertParamSql = `
          INSERT INTO substance_parameters (
            substance_id, parameter_name, unit, spec_min, spec_max, method,
            sort_order, company_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `;
        const paramRes = await client.query<SubstanceParameterRow>(insertParamSql, [
          id,
          p.parameterName,
          p.unit ?? null,
          p.specMin ?? null,
          p.specMax ?? null,
          p.method ?? null,
          sortOrder,
          companyId,
        ]);
        updatedParameters.push(paramRes.rows[0]!);
      }
    } else {
      const currentParamsRes = await client.query<SubstanceParameterRow>(
        `SELECT * FROM substance_parameters WHERE substance_id = $1 AND company_id = $2 ORDER BY sort_order ASC, created_at ASC`,
        [id, companyId],
      );
      updatedParameters = currentParamsRes.rows;
    }

    await writeAudit(client, {
      userId,
      companyId,
      action: 'update',
      tableName: 'substances',
      recordId: id,
      oldValues: {
        name_uz: existing.name_uz,
        name_ru: existing.name_ru,
        name_en: existing.name_en,
        pharmacopoeia: existing.pharmacopoeia,
        cas_number: existing.cas_number,
        is_active: existing.is_active,
      },
      newValues: {
        name_uz: updatedSubstance.name_uz,
        name_ru: updatedSubstance.name_ru,
        name_en: updatedSubstance.name_en,
        pharmacopoeia: updatedSubstance.pharmacopoeia,
        cas_number: updatedSubstance.cas_number,
        is_active: updatedSubstance.is_active,
        parameters_count: updatedParameters.length,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      ...toSubstanceDto(updatedSubstance),
      parameters: updatedParameters.map(toParameterDto),
    };
  });
}

export async function deleteSubstance(
  companyId: string,
  userId: string,
  id: string,
  meta: RequestMeta,
): Promise<void> {
  return withTransaction(async (client) => {
    const existingRes = await client.query<SubstanceRow>(
      `SELECT * FROM substances WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [id, companyId],
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      throw new NotFoundError('Modda topilmadi');
    }

    // Namunalar bog'langanligini tekshirish (P4 da samples jadvali qo'shilgach ishlaydi)
    const tableCheck = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'samples'`,
    );
    if (tableCheck.rows.length > 0) {
      const sampleCheck = await client.query(
        `SELECT 1 FROM samples WHERE substance_id = $1 LIMIT 1`,
        [id],
      );
      if (sampleCheck.rows.length > 0) {
        throw new ConflictError("Moddaga bog'langan namunalar mavjud, o'chirib bo'lmaydi");
      }
    }

    await client.query(
      `DELETE FROM substances WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );

    await writeAudit(client, {
      userId,
      companyId,
      action: 'delete',
      tableName: 'substances',
      recordId: id,
      oldValues: {
        name_uz: existing.name_uz,
        pharmacopoeia: existing.pharmacopoeia,
        cas_number: existing.cas_number,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  });
}
