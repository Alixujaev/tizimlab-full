import type pg from 'pg';
import { query, withTransaction } from '../../config/database.js';
import { AppError, ForbiddenError, NotFoundError } from '../../utils/errors.js';
import { writeAudit } from '../audit/audit.service.js';
import { toOffset, type PaginatedResult } from '../../utils/pagination.js';
import type { Role } from '../auth/auth.types.js';
import type {
  AddParameterInput,
  CreateCheckpointInput,
  CreateStudyInput,
  ListCheckpointsQuery,
  ListStudiesQuery,
  RecordResultsInput,
  UpdateCheckpointInput,
} from './stability.schemas.js';
import {
  DEFAULT_STABILITY_PARAMETERS,
  type StabilityCheckpointDto,
  type StabilityCheckpointRow,
  type StabilityResultDto,
  type StabilityResultRow,
  type StabilityStudyDetailDto,
  type StabilityStudyDto,
  type StabilityStudyRow,
} from './stability.types.js';

function toDateString(val: string | Date | null | undefined): string {
  if (!val) return '';
  if (typeof val === 'string') return val.slice(0, 10);
  return val.toISOString().slice(0, 10);
}

function toIsoString(val: string | Date | null | undefined): string | null {
  if (!val) return null;
  if (typeof val === 'string') return new Date(val).toISOString();
  return val.toISOString();
}

function computeIsDueSoon(dueDateStr: string, status: string, now: Date = new Date()): boolean {
  if (status === 'completed') return false;
  const today = new Date(now.toISOString().slice(0, 10));
  const due = new Date(dueDateStr);
  const diffDays = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 14;
}

export function toStudyDto(row: StabilityStudyRow): StabilityStudyDto {
  const substanceName = row.substance_name ?? row.sample_name ?? '';
  return {
    id: row.id,
    companyId: row.company_id,
    sampleId: row.sample_id,
    serialNumber: row.serial_number ?? null,
    substanceName,
    sampleName: substanceName,
    startedAt: toDateString(row.started_at),
    storageConditions: row.storage_conditions,
    status: row.status,
    createdBy: row.created_by,
    createdByName: row.created_by_name ?? null,
    totalCheckpoints: Number(row.total_checkpoints ?? 0),
    completedCheckpoints: Number(row.completed_checkpoints ?? 0),
    createdAt: toIsoString(row.created_at)!,
    updatedAt: toIsoString(row.updated_at)!,
  };
}

export function toCheckpointDto(
  row: StabilityCheckpointRow,
  results?: StabilityResultDto[],
  now: Date = new Date(),
): StabilityCheckpointDto {
  const dueDate = toDateString(row.due_date);
  return {
    id: row.id,
    companyId: row.company_id,
    studyId: row.study_id,
    intervalTag: row.interval_tag,
    dueDate,
    status: row.status,
    isDueSoon: computeIsDueSoon(dueDate, row.status, now),
    assignedTo: row.assigned_to,
    assignedToName: row.assigned_to_name ?? null,
    completedAt: toIsoString(row.completed_at),
    completedBy: row.completed_by,
    completedByName: row.completed_by_name ?? null,
    notes: row.notes,
    createdAt: toIsoString(row.created_at)!,
    updatedAt: toIsoString(row.updated_at)!,
    results,
  };
}

export function toResultDto(row: StabilityResultRow): StabilityResultDto {
  return {
    id: row.id,
    companyId: row.company_id,
    checkpointId: row.checkpoint_id,
    parameter: row.parameter,
    initialValue: row.initial_value,
    currentValue: row.current_value,
    specification: row.specification,
    resultStatus: row.result_status,
    recordedBy: row.recorded_by,
    recordedByName: row.recorded_by_name ?? null,
    recordedAt: toIsoString(row.recorded_at)!,
  };
}

export async function listStudies(
  companyId: string,
  q: ListStudiesQuery,
): Promise<PaginatedResult<StabilityStudyDto>> {
  const page = q.page ?? 1;
  const limit = q.limit ?? 20;
  const offset = toOffset({ page, limit });
  const conditions = ['ss.company_id = $1'];
  const values: unknown[] = [companyId];

  if (q.status) {
    values.push(q.status);
    conditions.push(`ss.status = $${values.length}`);
  }
  if (q.sampleId) {
    values.push(q.sampleId);
    conditions.push(`ss.sample_id = $${values.length}`);
  }
  if (q.search) {
    values.push(`%${q.search}%`);
    conditions.push(
      `(s.serial_number ILIKE $${values.length} OR s.substance_name ILIKE $${values.length})`,
    );
  }

  const whereClause = conditions.join(' AND ');

  const [countRes, listRes] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM stability_studies ss
       JOIN samples s ON s.id = ss.sample_id
       WHERE ${whereClause}`,
      values,
    ),
    query<StabilityStudyRow>(
      `SELECT ss.*,
              s.serial_number,
              s.substance_name,
              u.full_name AS created_by_name,
              COUNT(sc.id)::text AS total_checkpoints,
              COUNT(sc.id) FILTER (WHERE sc.status = 'completed')::text AS completed_checkpoints
       FROM stability_studies ss
       JOIN samples s ON s.id = ss.sample_id
       JOIN users u ON u.id = ss.created_by
       LEFT JOIN stability_checkpoints sc ON sc.study_id = ss.id
       WHERE ${whereClause}
       GROUP BY ss.id, s.serial_number, s.substance_name, u.full_name
       ORDER BY ss.created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    ),
  ]);

  const total = Number(countRes.rows[0]?.count ?? 0);
  return {
    items: listRes.rows.map(toStudyDto),
    meta: {
      page,
      limit,
      total,
    },
  };
}

export async function getStudyById(
  companyId: string,
  id: string,
): Promise<StabilityStudyDetailDto> {
  const { rows } = await query<StabilityStudyRow>(
    `SELECT ss.*,
            s.serial_number,
            s.substance_name,
            u.full_name AS created_by_name,
            COUNT(sc.id)::text AS total_checkpoints,
            COUNT(sc.id) FILTER (WHERE sc.status = 'completed')::text AS completed_checkpoints
     FROM stability_studies ss
     JOIN samples s ON s.id = ss.sample_id
     JOIN users u ON u.id = ss.created_by
     LEFT JOIN stability_checkpoints sc ON sc.study_id = ss.id
     WHERE ss.id = $1 AND ss.company_id = $2
     GROUP BY ss.id, s.serial_number, s.substance_name, u.full_name`,
    [id, companyId],
  );

  const study = rows[0];
  if (!study) {
    throw new NotFoundError('Stabilizatsiya tekshiruvi topilmadi');
  }

  // Checkpoints
  const cpRes = await query<StabilityCheckpointRow>(
    `SELECT sc.*,
            ua.full_name AS assigned_to_name,
            uc.full_name AS completed_by_name
     FROM stability_checkpoints sc
     LEFT JOIN users ua ON ua.id = sc.assigned_to
     LEFT JOIN users uc ON uc.id = sc.completed_by
     WHERE sc.study_id = $1 AND sc.company_id = $2
     ORDER BY sc.due_date ASC, sc.created_at ASC`,
    [id, companyId],
  );

  // Results for all checkpoints in this study
  const resultsRes = await query<StabilityResultRow>(
    `SELECT sr.*,
            u.full_name AS recorded_by_name
     FROM stability_results sr
     JOIN stability_checkpoints sc ON sc.id = sr.checkpoint_id
     JOIN users u ON u.id = sr.recorded_by
     WHERE sc.study_id = $1 AND sr.company_id = $2
     ORDER BY sr.recorded_at ASC, sr.parameter ASC`,
    [id, companyId],
  );

  const resultsByCheckpoint = new Map<string, StabilityResultDto[]>();
  for (const r of resultsRes.rows) {
    const list = resultsByCheckpoint.get(r.checkpoint_id) ?? [];
    list.push(toResultDto(r));
    resultsByCheckpoint.set(r.checkpoint_id, list);
  }

  const checkpoints = cpRes.rows.map((row) =>
    toCheckpointDto(row, resultsByCheckpoint.get(row.id) ?? []),
  );

  // Distinct parameters in study
  const paramMap = new Map<
    string,
    { parameter: string; initialValue: string | null; specification: string | null }
  >();
  for (const r of resultsRes.rows) {
    if (!paramMap.has(r.parameter)) {
      paramMap.set(r.parameter, {
        parameter: r.parameter,
        initialValue: r.initial_value,
        specification: r.specification,
      });
    }
  }

  return {
    ...toStudyDto(study),
    checkpoints,
    parameters: Array.from(paramMap.values()),
  };
}

export async function getStudyBySampleId(
  companyId: string,
  sampleId: string,
): Promise<StabilityStudyDetailDto | null> {
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM stability_studies
     WHERE sample_id = $1 AND company_id = $2 AND status = 'active'
     LIMIT 1`,
    [sampleId, companyId],
  );
  if (rows.length === 0) return null;
  return getStudyById(companyId, rows[0]!.id);
}

export async function createStudy(
  companyId: string,
  userId: string,
  input: CreateStudyInput,
): Promise<StabilityStudyDetailDto> {
  return withTransaction(async (tx) => {
    // 1. Verify sample exists and belongs to company (R-STAB-01, R-STAB-02)
    const { rows: sampleRows } = await tx.query<{ id: string; status: string; serial_number: string | null; substance_name: string }>(
      `SELECT id, status, serial_number, substance_name FROM samples
       WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [input.sampleId, companyId],
    );
    const sample = sampleRows[0];
    if (!sample) {
      throw new NotFoundError('Namuna topilmadi');
    }
    if (sample.status !== 'approved') {
      throw new AppError(
        400,
        'SAMPLE_NOT_APPROVED',
        'Faqat tasdiqlangan namunalar uchun stabilizatsiya boshlanishi mumkin',
      );
    }

    // 2. Verify no active study exists for this sample (R-STAB-36, D-58)
    const { rows: activeStudies } = await tx.query<{ id: string }>(
      `SELECT id FROM stability_studies
       WHERE sample_id = $1 AND company_id = $2 AND status = 'active'
       LIMIT 1`,
      [input.sampleId, companyId],
    );
    if (activeStudies.length > 0) {
      throw new AppError(
        409,
        'ACTIVE_STABILITY_EXISTS',
        'Ushbu namuna uchun faol stabilizatsiya tekshiruvi allaqachon mavjud',
      );
    }

    // 3. Create study row (R-STAB-04)
    const startedAt = input.startedAt ?? new Date().toISOString().slice(0, 10);
    const { rows: studyRows } = await tx.query<StabilityStudyRow>(
      `INSERT INTO stability_studies (company_id, sample_id, started_at, storage_conditions, status, created_by)
       VALUES ($1, $2, $3, $4, 'active', $5)
       RETURNING *`,
      [companyId, input.sampleId, startedAt, input.storageConditions ?? null, userId],
    );
    const study = studyRows[0]!;

    // 4. Resolve parameters (R-STAB-20, D-05, D-57, D-77)
    const parameters =
      input.parameters && input.parameters.length > 0
        ? input.parameters
        : DEFAULT_STABILITY_PARAMETERS.map((p) => ({
            parameter: p,
            initialValue: null,
            specification: null,
          }));

    // 5. If checkpoints provided, create them and pre-populate stability_results (R-STAB-05, R-STAB-07, R-STAB-37)
    if (input.checkpoints && input.checkpoints.length > 0) {
      const seenTags = new Set<string>();
      for (const cp of input.checkpoints) {
        if (seenTags.has(cp.intervalTag)) {
          throw new AppError(
            400,
            'DUPLICATE_CHECKPOINT_NAME',
            `Checkpoint nomi takrorlanmasligi kerak: "${cp.intervalTag}"`,
          );
        }
        seenTags.add(cp.intervalTag);

        const { rows: cpRows } = await tx.query<StabilityCheckpointRow>(
          `INSERT INTO stability_checkpoints (company_id, study_id, interval_tag, due_date, status, assigned_to, notes)
           VALUES ($1, $2, $3, $4, 'pending', $5, $6)
           RETURNING *`,
          [companyId, study.id, cp.intervalTag, cp.dueDate, cp.assignedTo ?? null, cp.notes ?? null],
        );
        const createdCp = cpRows[0]!;

        // Pre-populate stability_results for this checkpoint
        for (const param of parameters) {
          await tx.query(
            `INSERT INTO stability_results (company_id, checkpoint_id, parameter, initial_value, current_value, specification, result_status, recorded_by)
             VALUES ($1, $2, $3, $4, NULL, $5, 'pass', $6)`,
            [
              companyId,
              createdCp.id,
              param.parameter,
              param.initialValue ?? null,
              param.specification ?? null,
              userId,
            ],
          );
        }
      }
    }

    await writeAudit(tx, {
      tableName: 'stability_studies',
      recordId: study.id,
      action: 'create',
      companyId,
      userId,
      newValues: {
        sampleId: input.sampleId,
        startedAt: study.started_at,
        storageConditions: study.storage_conditions,
        parametersCount: parameters.length,
        checkpointsCount: input.checkpoints?.length ?? 0,
      },
    });

    return getStudyByIdInternal(tx, companyId, study.id);
  });
}

export async function createCheckpoint(
  companyId: string,
  studyId: string,
  userId: string,
  input: CreateCheckpointInput,
): Promise<StabilityCheckpointDto> {
  return withTransaction(async (tx) => {
    // 1. Verify study exists and is active
    const { rows: studyRows } = await tx.query<StabilityStudyRow>(
      `SELECT * FROM stability_studies WHERE id = $1 AND company_id = $2`,
      [studyId, companyId],
    );
    const study = studyRows[0];
    if (!study) {
      throw new NotFoundError('Stabilizatsiya tekshiruvi topilmadi');
    }
    if (study.status !== 'active') {
      throw new AppError(400, 'STUDY_NOT_ACTIVE', 'Yakunlangan tekshiruvga checkpoint qo‘shib bo‘lmaydi');
    }

    // 2. Check tag uniqueness in this study (R-STAB-07)
    const { rows: existingTag } = await tx.query(
      `SELECT 1 FROM stability_checkpoints WHERE study_id = $1 AND interval_tag = $2`,
      [studyId, input.intervalTag],
    );
    if (existingTag.length > 0) {
      throw new AppError(
        409,
        'DUPLICATE_CHECKPOINT_NAME',
        `Ushbu nomli checkpoint allaqachon mavjud: "${input.intervalTag}"`,
      );
    }

    // 3. Create checkpoint
    const { rows: cpRows } = await tx.query<StabilityCheckpointRow>(
      `INSERT INTO stability_checkpoints (company_id, study_id, interval_tag, due_date, status, assigned_to, notes)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6)
       RETURNING *`,
      [companyId, studyId, input.intervalTag, input.dueDate, input.assignedTo ?? null, input.notes ?? null],
    );
    const cp = cpRows[0]!;

    // 4. Pre-populate parameters from existing checkpoints of this study, or defaults
    const { rows: existingParams } = await tx.query<{
      parameter: string;
      initial_value: string | null;
      specification: string | null;
    }>(
      `SELECT DISTINCT parameter, initial_value, specification
       FROM stability_results
       WHERE checkpoint_id IN (SELECT id FROM stability_checkpoints WHERE study_id = $1)
       ORDER BY parameter`,
      [studyId],
    );

    const paramsToInsert =
      existingParams.length > 0
        ? existingParams
        : DEFAULT_STABILITY_PARAMETERS.map((p) => ({
            parameter: p,
            initial_value: null,
            specification: null,
          }));

    for (const p of paramsToInsert) {
      await tx.query(
        `INSERT INTO stability_results (company_id, checkpoint_id, parameter, initial_value, current_value, specification, result_status, recorded_by)
         VALUES ($1, $2, $3, $4, NULL, $5, 'pass', $6)`,
        [companyId, cp.id, p.parameter, p.initial_value, p.specification, userId],
      );
    }

    await writeAudit(tx, {
      tableName: 'stability_checkpoints',
      recordId: cp.id,
      action: 'create',
      companyId,
      userId,
      newValues: {
        studyId,
        intervalTag: cp.interval_tag,
        dueDate: cp.due_date,
        assignedTo: cp.assigned_to,
      },
    });

    return getCheckpointByIdInternal(tx, companyId, cp.id);
  });
}

export async function getCheckpointById(
  companyId: string,
  checkpointId: string,
): Promise<StabilityCheckpointDto> {
  const { rows } = await query<StabilityCheckpointRow>(
    `SELECT sc.*,
            ua.full_name AS assigned_to_name,
            uc.full_name AS completed_by_name
     FROM stability_checkpoints sc
     LEFT JOIN users ua ON ua.id = sc.assigned_to
     LEFT JOIN users uc ON uc.id = sc.completed_by
     WHERE sc.id = $1 AND sc.company_id = $2`,
    [checkpointId, companyId],
  );
  const row = rows[0];
  if (!row) {
    throw new NotFoundError('Checkpoint topilmadi');
  }

  const { rows: resRows } = await query<StabilityResultRow>(
    `SELECT sr.*, u.full_name AS recorded_by_name
     FROM stability_results sr
     JOIN users u ON u.id = sr.recorded_by
     WHERE sr.checkpoint_id = $1 AND sr.company_id = $2
     ORDER BY sr.parameter ASC`,
    [checkpointId, companyId],
  );

  return toCheckpointDto(row, resRows.map(toResultDto));
}

export async function updateCheckpoint(
  companyId: string,
  checkpointId: string,
  input: UpdateCheckpointInput,
): Promise<StabilityCheckpointDto> {
  return withTransaction(async (tx) => {
    const { rows } = await tx.query<StabilityCheckpointRow>(
      `SELECT * FROM stability_checkpoints WHERE id = $1 AND company_id = $2`,
      [checkpointId, companyId],
    );
    const existing = rows[0];
    if (!existing) {
      throw new NotFoundError('Checkpoint topilmadi');
    }

    if (input.intervalTag && input.intervalTag !== existing.interval_tag) {
      const { rows: dupRows } = await tx.query(
        `SELECT 1 FROM stability_checkpoints WHERE study_id = $1 AND interval_tag = $2 AND id <> $3`,
        [existing.study_id, input.intervalTag, checkpointId],
      );
      if (dupRows.length > 0) {
        throw new AppError(
          409,
          'DUPLICATE_CHECKPOINT_NAME',
          `Ushbu nomli checkpoint allaqachon mavjud: "${input.intervalTag}"`,
        );
      }
    }

    const intervalTag = input.intervalTag ?? existing.interval_tag;
    const dueDate = input.dueDate ?? existing.due_date;
    const assignedTo = input.assignedTo !== undefined ? input.assignedTo : existing.assigned_to;
    const notes = input.notes !== undefined ? input.notes : existing.notes;
    const status = input.status ?? existing.status;

    await tx.query(
      `UPDATE stability_checkpoints
       SET interval_tag = $1, due_date = $2, assigned_to = $3, notes = $4, status = $5
       WHERE id = $6 AND company_id = $7`,
      [intervalTag, dueDate, assignedTo, notes, status, checkpointId, companyId],
    );

    await writeAudit(tx, {
      tableName: 'stability_checkpoints',
      recordId: checkpointId,
      action: 'update',
      companyId,
      oldValues: {
        intervalTag: existing.interval_tag,
        dueDate: existing.due_date,
        assignedTo: existing.assigned_to,
        notes: existing.notes,
        status: existing.status,
      },
      newValues: {
        intervalTag,
        dueDate,
        assignedTo,
        notes,
        status,
      },
    });

    return getCheckpointByIdInternal(tx, companyId, checkpointId);
  });
}

export async function deleteCheckpoint(
  companyId: string,
  checkpointId: string,
): Promise<void> {
  await withTransaction(async (tx) => {
    const { rows } = await tx.query<StabilityCheckpointRow>(
      `SELECT * FROM stability_checkpoints WHERE id = $1 AND company_id = $2`,
      [checkpointId, companyId],
    );
    const existing = rows[0];
    if (!existing) {
      throw new NotFoundError('Checkpoint topilmadi');
    }

    // Check if any result has current_value (R-STAB-31, D-54)
    const { rows: resultRows } = await tx.query(
      `SELECT 1 FROM stability_results
       WHERE checkpoint_id = $1 AND current_value IS NOT NULL AND TRIM(current_value) <> ''
       LIMIT 1`,
      [checkpointId],
    );
    if (resultRows.length > 0) {
      throw new AppError(
        409,
        'CHECKPOINT_HAS_RESULTS',
        'Natijasi kiritilgan checkpointni o‘chirib bo‘lmaydi',
      );
    }

    await tx.query(`DELETE FROM stability_checkpoints WHERE id = $1 AND company_id = $2`, [
      checkpointId,
      companyId,
    ]);

    await writeAudit(tx, {
      tableName: 'stability_checkpoints',
      recordId: checkpointId,
      action: 'delete',
      companyId,
      oldValues: {
        intervalTag: existing.interval_tag,
        dueDate: existing.due_date,
        studyId: existing.study_id,
      },
    });
  });
}

export async function addParameterToCheckpoint(
  companyId: string,
  checkpointId: string,
  userId: string,
  input: AddParameterInput,
): Promise<StabilityResultDto> {
  const { rows: cpRows } = await query<StabilityCheckpointRow>(
    `SELECT * FROM stability_checkpoints WHERE id = $1 AND company_id = $2`,
    [checkpointId, companyId],
  );
  if (cpRows.length === 0) {
    throw new NotFoundError('Checkpoint topilmadi');
  }

  const { rows: dupRows } = await query(
    `SELECT 1 FROM stability_results WHERE checkpoint_id = $1 AND parameter = $2`,
    [checkpointId, input.parameter],
  );
  if (dupRows.length > 0) {
    throw new AppError(409, 'PARAMETER_EXISTS', 'Ushbu parametr allaqachon mavjud');
  }

  const { rows } = await query<StabilityResultRow>(
    `INSERT INTO stability_results (company_id, checkpoint_id, parameter, initial_value, current_value, specification, result_status, recorded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      companyId,
      checkpointId,
      input.parameter,
      input.initialValue ?? null,
      input.currentValue ?? null,
      input.specification ?? null,
      input.resultStatus ?? 'pass',
      userId,
    ],
  );

  return toResultDto(rows[0]!);
}

export async function removeParameterFromCheckpoint(
  companyId: string,
  checkpointId: string,
  parameter: string,
): Promise<void> {
  const { rows: cpRows } = await query<StabilityCheckpointRow>(
    `SELECT * FROM stability_checkpoints WHERE id = $1 AND company_id = $2`,
    [checkpointId, companyId],
  );
  if (cpRows.length === 0) {
    throw new NotFoundError('Checkpoint topilmadi');
  }

  const { rowCount } = await query(
    `DELETE FROM stability_results WHERE checkpoint_id = $1 AND company_id = $2 AND parameter = $3`,
    [checkpointId, companyId, parameter],
  );
  if (!rowCount || rowCount === 0) {
    throw new NotFoundError('Parametr topilmadi');
  }
}

export async function recordResults(
  companyId: string,
  checkpointId: string,
  user: { userId: string; role: Role },
  input: RecordResultsInput,
): Promise<StabilityCheckpointDto> {
  return withTransaction(async (tx) => {
    const { rows: cpRows } = await tx.query<StabilityCheckpointRow>(
      `SELECT sc.*, ss.status AS study_status
       FROM stability_checkpoints sc
       JOIN stability_studies ss ON ss.id = sc.study_id
       WHERE sc.id = $1 AND sc.company_id = $2`,
      [checkpointId, companyId],
    );
    const cp = cpRows[0];
    if (!cp) {
      throw new NotFoundError('Checkpoint topilmadi');
    }

    // Role check (R-ROLE-64, D-53): Chemist can only record results if assigned to this checkpoint
    if (user.role === 'chemist' && cp.assigned_to !== user.userId) {
      throw new ForbiddenError('Faqat biriktirilgan kimyogar natija kirita oladi');
    }

    // Save results
    for (const item of input.results) {
      if (item.id) {
        await tx.query(
          `UPDATE stability_results
           SET current_value = $1,
               result_status = $2,
               specification = COALESCE($3, specification),
               recorded_by = $4,
               recorded_at = now()
           WHERE id = $5 AND checkpoint_id = $6 AND company_id = $7`,
          [
            item.currentValue,
            item.resultStatus,
            item.specification ?? null,
            user.userId,
            item.id,
            checkpointId,
            companyId,
          ],
        );
      } else {
        await tx.query(
          `INSERT INTO stability_results (company_id, checkpoint_id, parameter, current_value, specification, result_status, recorded_by, recorded_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, now())
           ON CONFLICT (checkpoint_id, parameter) DO UPDATE
             SET current_value = EXCLUDED.current_value,
                 result_status = EXCLUDED.result_status,
                 specification = COALESCE(EXCLUDED.specification, stability_results.specification),
                 recorded_by = EXCLUDED.recorded_by,
                 recorded_at = EXCLUDED.recorded_at`,
          [
            companyId,
            checkpointId,
            item.parameter,
            item.currentValue,
            item.specification ?? null,
            item.resultStatus,
            user.userId,
          ],
        );
      }
    }

    // R-STAB-14, D-55: pending -> in_progress upon first result entry
    if (cp.status === 'pending') {
      await tx.query(
        `UPDATE stability_checkpoints
         SET status = 'in_progress'
         WHERE id = $1 AND company_id = $2`,
        [checkpointId, companyId],
      );
    }

    await writeAudit(tx, {
      tableName: 'stability_results',
      recordId: checkpointId,
      action: 'record',
      companyId,
      userId: user.userId,
      newValues: {
        checkpointId,
        recordedCount: input.results.length,
      },
    });

    return getCheckpointByIdInternal(tx, companyId, checkpointId);
  });
}

export async function completeCheckpoint(
  companyId: string,
  checkpointId: string,
  user: { userId: string; role: Role },
  notes?: string | null,
): Promise<StabilityCheckpointDto> {
  return withTransaction(async (tx) => {
    const { rows: cpRows } = await tx.query<StabilityCheckpointRow>(
      `SELECT * FROM stability_checkpoints WHERE id = $1 AND company_id = $2`,
      [checkpointId, companyId],
    );
    const cp = cpRows[0];
    if (!cp) {
      throw new NotFoundError('Checkpoint topilmadi');
    }

    if (user.role === 'chemist' && cp.assigned_to !== user.userId) {
      throw new ForbiddenError('Faqat biriktirilgan kimyogar checkpointni yakunlay oladi');
    }

    // R-STAB-32, D-55: All parameters must be filled
    const { rows: results } = await tx.query<StabilityResultRow>(
      `SELECT * FROM stability_results WHERE checkpoint_id = $1 AND company_id = $2`,
      [checkpointId, companyId],
    );

    if (results.length === 0) {
      throw new AppError(400, 'INCOMPLETE_RESULTS', 'Checkpoint uchun hech qanday parametr topilmadi');
    }

    const hasEmpty = results.some(
      (r) => r.current_value === null || r.current_value.trim() === '',
    );
    if (hasEmpty) {
      throw new AppError(
        400,
        'INCOMPLETE_RESULTS',
        'Barcha parametrlar to‘ldirilmagan. Checkpointni yakunlash uchun har bir parametr qiymatini kiriting.',
      );
    }

    // Mark completed
    await tx.query(
      `UPDATE stability_checkpoints
       SET status = 'completed',
           completed_at = now(),
           completed_by = $1,
           notes = COALESCE($2, notes)
       WHERE id = $3 AND company_id = $4`,
      [user.userId, notes ?? null, checkpointId, companyId],
    );

    // R-STAB-34, D-56: Check if all checkpoints of this study are completed -> auto-complete study!
    const { rows: pendingCount } = await tx.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM stability_checkpoints
       WHERE study_id = $1 AND company_id = $2 AND status <> 'completed'`,
      [cp.study_id, companyId],
    );

    if (Number(pendingCount[0]?.count ?? 0) === 0) {
      await tx.query(
        `UPDATE stability_studies
         SET status = 'completed'
         WHERE id = $1 AND company_id = $2`,
        [cp.study_id, companyId],
      );
    }

    await writeAudit(tx, {
      tableName: 'stability_checkpoints',
      recordId: checkpointId,
      action: 'complete',
      companyId,
      userId: user.userId,
      newValues: {
        status: 'completed',
        completedBy: user.userId,
      },
    });

    return getCheckpointByIdInternal(tx, companyId, checkpointId);
  });
}

export async function listCheckpoints(
  companyId: string,
  q: ListCheckpointsQuery,
): Promise<StabilityCheckpointDto[]> {
  const conditions = ['sc.company_id = $1'];
  const values: unknown[] = [companyId];

  if (q.studyId) {
    values.push(q.studyId);
    conditions.push(`sc.study_id = $${values.length}`);
  }
  if (q.status) {
    values.push(q.status);
    conditions.push(`sc.status = $${values.length}`);
  }
  if (q.assignedTo) {
    values.push(q.assignedTo);
    conditions.push(`sc.assigned_to = $${values.length}`);
  }

  const { rows } = await query<StabilityCheckpointRow>(
    `SELECT sc.*,
            ua.full_name AS assigned_to_name,
            uc.full_name AS completed_by_name,
            s.serial_number,
            s.substance_name
     FROM stability_checkpoints sc
     JOIN stability_studies ss ON ss.id = sc.study_id
     JOIN samples s ON s.id = ss.sample_id
     LEFT JOIN users ua ON ua.id = sc.assigned_to
     LEFT JOIN users uc ON uc.id = sc.completed_by
     WHERE ${conditions.join(' AND ')}
     ORDER BY sc.due_date ASC`,
    values,
  );

  let items = rows.map((r) => toCheckpointDto(r));
  if (q.dueSoon) {
    items = items.filter((item) => item.isDueSoon);
  }
  return items;
}

// Internal helper within transaction
async function getStudyByIdInternal(
  tx: pg.PoolClient,
  companyId: string,
  id: string,
): Promise<StabilityStudyDetailDto> {
  const { rows } = await tx.query<StabilityStudyRow>(
    `SELECT ss.*,
            s.serial_number,
            s.substance_name,
            u.full_name AS created_by_name,
            COUNT(sc.id)::text AS total_checkpoints,
            COUNT(sc.id) FILTER (WHERE sc.status = 'completed')::text AS completed_checkpoints
     FROM stability_studies ss
     JOIN samples s ON s.id = ss.sample_id
     JOIN users u ON u.id = ss.created_by
     LEFT JOIN stability_checkpoints sc ON sc.study_id = ss.id
     WHERE ss.id = $1 AND ss.company_id = $2
     GROUP BY ss.id, s.serial_number, s.substance_name, u.full_name`,
    [id, companyId],
  );
  const study = rows[0]!;

  const cpRes = await tx.query<StabilityCheckpointRow>(
    `SELECT sc.*,
            ua.full_name AS assigned_to_name,
            uc.full_name AS completed_by_name
     FROM stability_checkpoints sc
     LEFT JOIN users ua ON ua.id = sc.assigned_to
     LEFT JOIN users uc ON uc.id = sc.completed_by
     WHERE sc.study_id = $1 AND sc.company_id = $2
     ORDER BY sc.due_date ASC`,
    [id, companyId],
  );

  const resultsRes = await tx.query<StabilityResultRow>(
    `SELECT sr.*, u.full_name AS recorded_by_name
     FROM stability_results sr
     JOIN stability_checkpoints sc ON sc.id = sr.checkpoint_id
     JOIN users u ON u.id = sr.recorded_by
     WHERE sc.study_id = $1 AND sr.company_id = $2
     ORDER BY sr.recorded_at ASC, sr.parameter ASC`,
    [id, companyId],
  );

  const resultsByCp = new Map<string, StabilityResultDto[]>();
  for (const r of resultsRes.rows) {
    const list = resultsByCp.get(r.checkpoint_id) ?? [];
    list.push(toResultDto(r));
    resultsByCp.set(r.checkpoint_id, list);
  }

  const paramMap = new Map<
    string,
    { parameter: string; initialValue: string | null; specification: string | null }
  >();
  for (const r of resultsRes.rows) {
    if (!paramMap.has(r.parameter)) {
      paramMap.set(r.parameter, {
        parameter: r.parameter,
        initialValue: r.initial_value,
        specification: r.specification,
      });
    }
  }

  return {
    ...toStudyDto(study),
    checkpoints: cpRes.rows.map((row) =>
      toCheckpointDto(row, resultsByCp.get(row.id) ?? []),
    ),
    parameters: Array.from(paramMap.values()),
  };
}

async function getCheckpointByIdInternal(
  tx: pg.PoolClient,
  companyId: string,
  checkpointId: string,
): Promise<StabilityCheckpointDto> {
  const { rows } = await tx.query<StabilityCheckpointRow>(
    `SELECT sc.*,
            ua.full_name AS assigned_to_name,
            uc.full_name AS completed_by_name
     FROM stability_checkpoints sc
     LEFT JOIN users ua ON ua.id = sc.assigned_to
     LEFT JOIN users uc ON uc.id = sc.completed_by
     WHERE sc.id = $1 AND sc.company_id = $2`,
    [checkpointId, companyId],
  );
  const row = rows[0]!;

  const { rows: resRows } = await tx.query<StabilityResultRow>(
    `SELECT sr.*, u.full_name AS recorded_by_name
     FROM stability_results sr
     JOIN users u ON u.id = sr.recorded_by
     WHERE sr.checkpoint_id = $1 AND sr.company_id = $2
     ORDER BY sr.parameter ASC`,
    [checkpointId, companyId],
  );

  return toCheckpointDto(row, resRows.map(toResultDto));
}
