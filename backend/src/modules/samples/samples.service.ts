import { query, withTransaction } from '../../config/database.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors.js';
import { writeAudit } from '../audit/audit.service.js';
import type { Role } from '../auth/auth.types.js';
import { sampleHooks } from './samples.hooks.js';
import {
  assertCanAssign,
  assertCanResume,
  assertCanStop,
  SampleAssignmentError,
} from './samples.state-machine.js';
import type { AssignSampleInput, CreateSampleInput, ListSamplesQuery } from './samples.schemas.js';
import {
  type SampleDetailDto,
  type SampleDto,
  type SampleRow,
  type SampleTrackingRow,
  toSampleDto,
  toSampleTrackingDto,
} from './samples.types.js';

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

export interface UserContext {
  id: string;
  role: Role;
  companyId: string | null;
}

/** Namunalar bo'limidagi ko'rinish (spec §1): kontrolyor — o'ziniki, chemist — biriktirilgan, qolganlar — hammasi. */
export function isSampleVisibleTo(
  user: Pick<UserContext, 'id' | 'role'>,
  sample: Pick<SampleRow, 'created_by' | 'assigned_to'>,
): boolean {
  if (user.role === 'kontrolyor') return sample.created_by === user.id;
  if (user.role === 'chemist') return sample.assigned_to === user.id;
  return true;
}

export async function listSamples(
  companyId: string,
  user: UserContext,
  params: ListSamplesQuery,
): Promise<{ data: SampleDto[]; meta: { page: number; limit: number; total: number } }> {
  const whereClauses: string[] = ['s.company_id = $1', 's.deleted_at IS NULL'];
  const values: unknown[] = [companyId];

  // Ko'rinish qoidalari (spec §1, Q-04):
  // - kontrolyor: faqat o'zi yaratganlar
  // - chemist: faqat o'ziga biriktirilganlar
  // - lab_head, director, admin: kompaniyaning hammasi
  if (user.role === 'kontrolyor') {
    values.push(user.id);
    whereClauses.push(`s.created_by = $${values.length}`);
  } else if (user.role === 'chemist') {
    values.push(user.id);
    whereClauses.push(`s.assigned_to = $${values.length}`);
  }

  if (params.status) {
    values.push(params.status);
    whereClauses.push(`s.status = $${values.length}`);
  }

  if (params.type) {
    values.push(params.type);
    whereClauses.push(`s.type = $${values.length}`);
  }

  if (params.substanceId) {
    values.push(params.substanceId);
    whereClauses.push(`s.substance_id = $${values.length}`);
  }

  if (params.search && params.search.trim()) {
    values.push(`%${params.search.trim()}%`);
    const sIndex = values.length;
    whereClauses.push(
      `(s.substance_name ILIKE $${sIndex} OR s.lot_number ILIKE $${sIndex} OR s.serial_number ILIKE $${sIndex})`,
    );
  }

  const whereSql = whereClauses.join(' AND ');

  const countRes = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM samples s WHERE ${whereSql}`,
    values,
  );
  const total = Number(countRes.rows[0]?.count ?? '0');

  const offset = (params.page - 1) * params.limit;
  values.push(params.limit);
  const limitIdx = values.length;
  values.push(offset);
  const offsetIdx = values.length;

  const dataRes = await query<SampleRow>(
    `SELECT s.*, u.full_name AS assigned_to_name
     FROM samples s
     LEFT JOIN users u ON u.id = s.assigned_to AND u.company_id = s.company_id
     WHERE ${whereSql}
     ORDER BY s.created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    values,
  );

  return {
    data: dataRes.rows.map(toSampleDto),
    meta: {
      page: params.page,
      limit: params.limit,
      total,
    },
  };
}

export async function getSampleById(
  companyId: string,
  user: UserContext,
  sampleId: string,
): Promise<SampleDetailDto> {
  const sampleRes = await query<SampleRow>(
    `SELECT s.*, u.full_name AS assigned_to_name
     FROM samples s
     LEFT JOIN users u ON u.id = s.assigned_to AND u.company_id = s.company_id
     WHERE s.id = $1 AND s.company_id = $2 AND s.deleted_at IS NULL`,
    [sampleId, companyId],
  );
  const sample = sampleRes.rows[0];
  if (!sample) {
    throw new NotFoundError('Namuna topilmadi');
  }

  // Ko'rinish tekshiruvi (agar foydalanuvchiga tegishli bo'lmasa -> 404 xavfsizlik uchun)
  if (!isSampleVisibleTo(user, sample)) {
    throw new NotFoundError('Namuna topilmadi');
  }

  // Tracking tarixi
  const trackingRes = await query<SampleTrackingRow & { user_full_name: string | null }>(
    `SELECT t.*, u.full_name AS user_full_name
     FROM sample_tracking t
     LEFT JOIN users u ON u.id = t.user_id
     WHERE t.sample_id = $1 AND t.company_id = $2
     ORDER BY t.created_at ASC`,
    [sampleId, companyId],
  );

  return {
    ...toSampleDto(sample),
    tracking: trackingRes.rows.map(toSampleTrackingDto),
  };
}

export async function createSample(
  companyId: string,
  userId: string,
  userRole: Role,
  input: CreateSampleInput,
  meta: RequestMeta,
): Promise<SampleDto> {
  if (userRole !== 'kontrolyor') {
    throw new ForbiddenError('Faqat kontrolyor namuna yarata oladi');
  }

  return withTransaction(async (client) => {
    // Agar substanceId berilgan bo'lsa, mavjudligi va faolligini tekshiramiz
    if (input.substanceId) {
      const substRes = await client.query<{ id: string; name_uz: string; is_active: boolean }>(
        `SELECT id, name_uz, is_active FROM substances WHERE id = $1 AND company_id = $2`,
        [input.substanceId, companyId],
      );
      const subst = substRes.rows[0];
      if (!subst) {
        throw new NotFoundError('Tanlangan modda topilmadi');
      }
      if (!subst.is_active) {
        throw new ValidationError('Nofaol modda uchun namuna yaratib bo‘lmaydi');
      }
    }

    const insertSampleRes = await client.query<SampleRow>(
      `INSERT INTO samples (
        company_id,
        type,
        status,
        substance_id,
        substance_name,
        serial_number,
        lot_number,
        quantity,
        manufacturer,
        manufactured_at,
        analysis_start,
        analysis_end,
        notes,
        created_by
      ) VALUES ($1, $2, 'pending_assignment', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        companyId,
        input.type,
        input.substanceId ?? null,
        input.substanceName,
        input.serialNumber ?? null,
        input.lotNumber ?? null,
        input.quantity ?? null,
        input.manufacturer ?? null,
        input.manufacturedAt ?? null,
        input.analysisStart ?? null,
        input.analysisEnd ?? null,
        input.notes ?? null,
        userId,
      ],
    );
    const createdSample = insertSampleRes.rows[0]!;

    // Tracking yozuvi
    await client.query(
      `INSERT INTO sample_tracking (
        company_id,
        sample_id,
        event_type,
        user_id,
        from_status,
        to_status,
        reason,
        metadata
      ) VALUES ($1, $2, 'sample_created', $3, null, 'pending_assignment', null, $4)`,
      [
        companyId,
        createdSample.id,
        userId,
        JSON.stringify({ type: input.type, substance_name: input.substanceName }),
      ],
    );

    // Audit yozuvi
    await writeAudit(client, {
      userId,
      companyId,
      action: 'create',
      tableName: 'samples',
      recordId: createdSample.id,
      newValues: {
        type: createdSample.type,
        status: createdSample.status,
        substance_id: createdSample.substance_id,
        substance_name: createdSample.substance_name,
        lot_number: createdSample.lot_number,
        serial_number: createdSample.serial_number,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return toSampleDto(createdSample);
  });
}

export async function assignSample(
  companyId: string,
  userId: string,
  userRole: Role,
  sampleId: string,
  input: AssignSampleInput,
  meta: RequestMeta,
): Promise<SampleDto> {
  if (userRole !== 'lab_head') {
    throw new ForbiddenError('Faqat laboratoriya mudiri (lab_head) kimyogarga biriktira oladi');
  }

  return withTransaction(async (client) => {
    const sampleRes = await client.query<SampleRow>(
      `SELECT * FROM samples WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL FOR UPDATE`,
      [sampleId, companyId],
    );
    const sample = sampleRes.rows[0];
    if (!sample) {
      throw new NotFoundError('Namuna topilmadi');
    }

    // Biriktirish qoidalarini tekshirish (state-machine)
    assertCanAssign(sample.type, sample.status);

    // Kimyogar mavjudligi va kompaniyasi tekshiriladi
    const chemistRes = await client.query<{
      id: string;
      full_name: string;
      role: Role;
      is_active: boolean;
    }>(`SELECT id, full_name, role, is_active FROM users WHERE id = $1 AND company_id = $2`, [
      input.chemistId,
      companyId,
    ]);
    const chemist = chemistRes.rows[0];
    if (!chemist) {
      throw new NotFoundError('Kimyogar topilmadi');
    }
    if (chemist.role !== 'chemist') {
      throw new SampleAssignmentError(
        'Faqat kimyogar (chemist) roliga biriktirish mumkin',
        422,
        'UNPROCESSABLE_ENTITY',
      );
    }
    if (!chemist.is_active) {
      throw new SampleAssignmentError(
        'Nofaol kimyogarga namuna biriktirib bo‘lmaydi',
        422,
        'ACCOUNT_INACTIVE',
      );
    }

    const isInitialAssign = sample.status === 'pending_assignment';
    const newStatus = isInitialAssign ? 'in_progress' : sample.status;
    const eventType = isInitialAssign ? 'assigned' : 'reassigned';

    const updateRes = await client.query<SampleRow>(
      `UPDATE samples
       SET status = $1,
           assigned_to = $2,
           assigned_by = $3,
           assigned_at = now()
       WHERE id = $4 AND company_id = $5
       RETURNING *`,
      [newStatus, chemist.id, userId, sampleId, companyId],
    );
    const updatedSample = updateRes.rows[0]!;

    // Tracking yozuvi
    await client.query(
      `INSERT INTO sample_tracking (
        company_id,
        sample_id,
        event_type,
        user_id,
        from_status,
        to_status,
        reason,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, null, $7)`,
      [
        companyId,
        sampleId,
        eventType,
        userId,
        sample.status,
        newStatus,
        JSON.stringify({
          previous_chemist: sample.assigned_to,
          assigned_to: chemist.id,
          chemist_name: chemist.full_name,
        }),
      ],
    );

    // Extension Hooklar:
    // 1. Biriktirish hooki (P5 da protokol avtomatik draft yaratadi)
    await sampleHooks.onSampleAssigned(
      updatedSample,
      { id: chemist.id, fullName: chemist.full_name },
      client,
    );

    // 2. Status o'zgarishi hooki (P6 da xabarnoma yuboradi)
    if (sample.status !== newStatus) {
      await sampleHooks.onSampleStatusChanged(
        updatedSample,
        sample.status,
        newStatus,
        userId,
        client,
      );
    }

    // Audit
    await writeAudit(client, {
      userId,
      companyId,
      action: 'update',
      tableName: 'samples',
      recordId: sample.id,
      oldValues: {
        status: sample.status,
        assigned_to: sample.assigned_to,
      },
      newValues: {
        status: newStatus,
        assigned_to: chemist.id,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return toSampleDto({
      ...updatedSample,
      assigned_to_name: chemist.full_name,
    });
  });
}

export async function stopSample(
  companyId: string,
  userId: string,
  sampleId: string,
  reason: string,
  meta: RequestMeta,
): Promise<SampleDto> {
  return withTransaction(async (client) => {
    const sampleRes = await client.query<SampleRow>(
      `SELECT * FROM samples WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL FOR UPDATE`,
      [sampleId, companyId],
    );
    const sample = sampleRes.rows[0];
    if (!sample) {
      throw new NotFoundError('Namuna topilmadi');
    }

    // Faqat biriktirilgan kimyogar to'xtata oladi (DECISIONS D-38, R-SAMPLE-37)
    if (sample.assigned_to !== userId) {
      throw new ForbiddenError('Faqat namunaga biriktirilgan kimyogar tahlilni to‘xtata oladi');
    }

    assertCanStop(sample.status, reason);

    const updateRes = await client.query<SampleRow>(
      `UPDATE samples
       SET status = 'stopped',
           stop_reason = $1,
           stopped_at = now()
       WHERE id = $2 AND company_id = $3
       RETURNING *`,
      [reason.trim(), sampleId, companyId],
    );
    const updatedSample = updateRes.rows[0]!;

    // Tracking yozuvi
    await client.query(
      `INSERT INTO sample_tracking (
        company_id,
        sample_id,
        event_type,
        user_id,
        from_status,
        to_status,
        reason,
        metadata
      ) VALUES ($1, $2, 'stopped', $3, 'in_progress', 'stopped', $4, '{}'::jsonb)`,
      [companyId, sampleId, userId, reason.trim()],
    );

    await sampleHooks.onSampleStatusChanged(
      updatedSample,
      'in_progress',
      'stopped',
      userId,
      client,
    );

    await writeAudit(client, {
      userId,
      companyId,
      action: 'update',
      tableName: 'samples',
      recordId: sample.id,
      oldValues: {
        status: 'in_progress',
      },
      newValues: {
        status: 'stopped',
        stop_reason: reason.trim(),
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return toSampleDto(updatedSample);
  });
}

export async function resumeSample(
  companyId: string,
  userId: string,
  sampleId: string,
  reason: string | undefined | null,
  meta: RequestMeta,
): Promise<SampleDto> {
  return withTransaction(async (client) => {
    const sampleRes = await client.query<SampleRow>(
      `SELECT * FROM samples WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL FOR UPDATE`,
      [sampleId, companyId],
    );
    const sample = sampleRes.rows[0];
    if (!sample) {
      throw new NotFoundError('Namuna topilmadi');
    }

    // Faqat biriktirilgan kimyogar davom ettira oladi (DECISIONS D-38, R-SAMPLE-37)
    if (sample.assigned_to !== userId) {
      throw new ForbiddenError('Faqat namunaga biriktirilgan kimyogar tahlilni davom ettira oladi');
    }

    assertCanResume(sample.status);

    const updateRes = await client.query<SampleRow>(
      `UPDATE samples
       SET status = 'in_progress',
           stop_reason = null,
           stopped_at = null
       WHERE id = $1 AND company_id = $2
       RETURNING *`,
      [sampleId, companyId],
    );
    const updatedSample = updateRes.rows[0]!;

    // Tracking yozuvi
    await client.query(
      `INSERT INTO sample_tracking (
        company_id,
        sample_id,
        event_type,
        user_id,
        from_status,
        to_status,
        reason,
        metadata
      ) VALUES ($1, $2, 'resumed', $3, 'stopped', 'in_progress', $4, '{}'::jsonb)`,
      [companyId, sampleId, userId, reason ? reason.trim() : null],
    );

    await sampleHooks.onSampleStatusChanged(
      updatedSample,
      'stopped',
      'in_progress',
      userId,
      client,
    );

    await writeAudit(client, {
      userId,
      companyId,
      action: 'update',
      tableName: 'samples',
      recordId: sample.id,
      oldValues: {
        status: 'stopped',
        stop_reason: sample.stop_reason,
      },
      newValues: {
        status: 'in_progress',
        stop_reason: null,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return toSampleDto(updatedSample);
  });
}
