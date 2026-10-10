import { query, withTransaction } from '../../config/database.js';
import { AppError, ConflictError, NotFoundError } from '../../utils/errors.js';
import { toOffset, type PaginatedResult } from '../../utils/pagination.js';
import { writeAudit } from '../audit/audit.service.js';
import {
  buildKey,
  deleteFileRecordByKey,
  deleteObjectSafely,
  getDownloadUrl,
  insertFileRecord,
  runWithUpload,
  type ActorMeta,
  type DownloadLink,
} from '../files/files.service.js';
import { type FileStorage } from '../files/files.storage.js';
import { assertAllowedFile, type IncomingFile } from '../files/files.validation.js';
import { createNotification } from '../notifications/notifications.service.js';
import type {
  CreateReagentInput,
  CreateTransactionInput,
  ListExpensesQuery,
  ListReagentsQuery,
  ListTransactionsQuery,
  UpdateReagentInput,
} from './reagents.schemas.js';
import {
  toReagentDocumentDto,
  toReagentDto,
  toReagentTransactionDto,
  type ReagentDocumentDto,
  type ReagentDocumentRow,
  type ReagentDto,
  type ReagentRow,
  type ReagentTransactionDto,
  type ReagentTransactionRow,
} from './reagents.types.js';

export const REAGENT_DOC_MAX_BYTES = 20 * 1024 * 1024;

export async function createReagent(
  companyId: string,
  userId: string,
  input: CreateReagentInput,
  meta?: { ip?: string; userAgent?: string },
): Promise<ReagentDto> {
  return await withTransaction(async (tx) => {
    const { rows } = await tx.query<ReagentRow>(
      `INSERT INTO reagents (
         company_id, name, cas_number, unit, quantity, low_stock_threshold,
         expires_at, supplier, storage_conditions, is_hazardous
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        companyId,
        input.name,
        input.casNumber ?? null,
        input.unit,
        input.quantity,
        input.lowStockThreshold,
        input.expiresAt ?? null,
        input.supplier ?? null,
        input.storageConditions ?? null,
        input.isHazardous ?? false,
      ],
    );
    const row = rows[0]!;

    if (input.quantity > 0) {
      await tx.query(
        `INSERT INTO reagent_transactions (
           company_id, reagent_id, user_id, type, quantity,
           quantity_before, quantity_after, note, recorded_date
         ) VALUES ($1, $2, $3, 'in', $4, 0, $4, 'Boshlang‘ich qoldiq', CURRENT_DATE)`,
        [companyId, row.id, userId, input.quantity],
      );
    }

    await writeAudit(tx, {
      userId,
      companyId,
      action: 'create',
      tableName: 'reagents',
      recordId: row.id,
      newValues: {
        name: row.name,
        cas_number: row.cas_number,
        unit: row.unit,
        quantity: Number(row.quantity),
      },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return toReagentDto(row);
  });
}

export async function updateReagent(
  companyId: string,
  userId: string,
  id: string,
  input: UpdateReagentInput,
  meta?: { ip?: string; userAgent?: string },
): Promise<ReagentDto> {
  return await withTransaction(async (tx) => {
    const existing = await tx.query<ReagentRow>(
      `SELECT * FROM reagents WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [id, companyId],
    );
    if (!existing.rows[0]) throw new NotFoundError('Reaktiv topilmadi');
    const prev = existing.rows[0];

    const { rows } = await tx.query<ReagentRow>(
      `UPDATE reagents SET
         name = COALESCE($3, name),
         cas_number = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE cas_number END,
         unit = COALESCE($5, unit),
         low_stock_threshold = COALESCE($6, low_stock_threshold),
         expires_at = CASE WHEN $7::date IS NOT NULL THEN $7 ELSE expires_at END,
         supplier = CASE WHEN $8::text IS NOT NULL THEN $8 ELSE supplier END,
         storage_conditions = CASE WHEN $9::text IS NOT NULL THEN $9 ELSE storage_conditions END,
         is_hazardous = COALESCE($10, is_hazardous),
         updated_at = now()
       WHERE id = $1 AND company_id = $2
       RETURNING *`,
      [
        id,
        companyId,
        input.name ?? null,
        input.casNumber !== undefined ? input.casNumber : null,
        input.unit ?? null,
        input.lowStockThreshold ?? null,
        input.expiresAt !== undefined ? input.expiresAt : null,
        input.supplier !== undefined ? input.supplier : null,
        input.storageConditions !== undefined ? input.storageConditions : null,
        input.isHazardous ?? null,
      ],
    );
    const updated = rows[0]!;

    await writeAudit(tx, {
      userId,
      companyId,
      action: 'update',
      tableName: 'reagents',
      recordId: updated.id,
      oldValues: { name: prev.name, unit: prev.unit, threshold: Number(prev.low_stock_threshold) },
      newValues: { name: updated.name, unit: updated.unit, threshold: Number(updated.low_stock_threshold) },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return toReagentDto(updated);
  });
}

export async function deleteReagent(
  companyId: string,
  userId: string,
  id: string,
  meta?: { ip?: string; userAgent?: string },
): Promise<void> {
  await withTransaction(async (tx) => {
    const check = await tx.query<ReagentRow>(
      `SELECT * FROM reagents WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [id, companyId],
    );
    if (!check.rows[0]) throw new NotFoundError('Reaktiv topilmadi');

    const txCheck = await tx.query<{ count: string }>(
      `SELECT count(*) AS count FROM reagent_transactions WHERE reagent_id = $1 AND company_id = $2`,
      [id, companyId],
    );
    if (Number(txCheck.rows[0]?.count ?? 0) > 0) {
      throw new ConflictError('Reaktivga bog‘langan tranzaksiyalar mavjud, uni o‘chirib bo‘lmaydi');
    }

    await tx.query(`DELETE FROM reagents WHERE id = $1 AND company_id = $2`, [id, companyId]);

    await writeAudit(tx, {
      userId,
      companyId,
      action: 'delete',
      tableName: 'reagents',
      recordId: id,
      oldValues: { name: check.rows[0].name },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  });
}

export async function getReagentById(companyId: string, id: string): Promise<ReagentDto> {
  const { rows } = await query<ReagentRow>(
    `SELECT * FROM reagents WHERE id = $1 AND company_id = $2`,
    [id, companyId],
  );
  if (!rows[0]) throw new NotFoundError('Reaktiv topilmadi');
  return toReagentDto(rows[0]);
}

export async function listReagents(
  companyId: string,
  q: ListReagentsQuery,
): Promise<PaginatedResult<ReagentDto>> {
  const conditions: string[] = ['company_id = $1'];
  const params: unknown[] = [companyId];

  if (q.search) {
    params.push(`%${q.search}%`);
    conditions.push(`(name ILIKE $${params.length} OR cas_number ILIKE $${params.length})`);
  }
  if (q.isLowStock !== undefined) {
    if (q.isLowStock) conditions.push('quantity < low_stock_threshold');
    else conditions.push('quantity >= low_stock_threshold');
  }
  if (q.isExpired !== undefined) {
    if (q.isExpired) conditions.push('expires_at IS NOT NULL AND expires_at < CURRENT_DATE');
    else conditions.push('(expires_at IS NULL OR expires_at >= CURRENT_DATE)');
  }
  if (q.isHazardous !== undefined) {
    params.push(q.isHazardous);
    conditions.push(`is_hazardous = $${params.length}`);
  }

  const where = conditions.join(' AND ');
  const [list, count] = await Promise.all([
    query<ReagentRow>(
      `SELECT * FROM reagents WHERE ${where}
       ORDER BY created_at DESC, id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, toOffset(q)],
    ),
    query<{ total: string }>(`SELECT count(*) AS total FROM reagents WHERE ${where}`, params),
  ]);

  return {
    items: list.rows.map(toReagentDto),
    meta: { page: q.page, limit: q.limit, total: Number(count.rows[0]?.total ?? 0) },
  };
}

export async function createTransaction(
  companyId: string,
  userId: string,
  reagentId: string,
  input: CreateTransactionInput,
  meta?: { ip?: string; userAgent?: string },
): Promise<ReagentTransactionDto> {
  return await withTransaction(async (tx) => {
    // Race-safe row lock
    const { rows: rRows } = await tx.query<ReagentRow>(
      `SELECT * FROM reagents WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [reagentId, companyId],
    );
    if (!rRows[0]) throw new NotFoundError('Reaktiv topilmadi');
    const reagent = rRows[0];

    const qtyBefore = Number(reagent.quantity);
    let qtyAfter: number;

    if (input.type === 'in') {
      qtyAfter = qtyBefore + input.quantity;
    } else if (input.type === 'out' || input.type === 'disposal') {
      if (input.quantity > qtyBefore) {
        throw new AppError(400, 'INSUFFICIENT_STOCK', 'Yetarli zaxira mavjud emas');
      }
      qtyAfter = qtyBefore - input.quantity;
    } else if (input.type === 'adjustment') {
      qtyAfter = input.quantity;
    } else {
      throw new AppError(400, 'INVALID_TRANSACTION_TYPE', 'Noma’lum tranzaksiya turi');
    }

    if (qtyAfter < 0) {
      throw new AppError(400, 'INSUFFICIENT_STOCK', 'Zaxira manfiy bo‘lishi mumkin emas');
    }

    await tx.query(
      `UPDATE reagents SET quantity = $1, updated_at = now() WHERE id = $2 AND company_id = $3`,
      [qtyAfter, reagentId, companyId],
    );

    const { rows: tRows } = await tx.query<ReagentTransactionRow>(
      `INSERT INTO reagent_transactions (
         company_id, reagent_id, user_id, type, quantity,
         quantity_before, quantity_after, note, protocol_id, analysis_purpose, recorded_date
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11::date, CURRENT_DATE))
       RETURNING *`,
      [
        companyId,
        reagentId,
        userId,
        input.type,
        input.quantity,
        qtyBefore,
        qtyAfter,
        input.note ?? null,
        input.protocolId ?? null,
        input.analysisPurpose ?? null,
        input.recordedDate ?? null,
      ],
    );
    const txRow = tRows[0]!;

    // Q-37 / D-132: minimal qoldiq chegarasidan pastga tushganda bir marta ogohlantirish
    const threshold = Number(reagent.low_stock_threshold);
    if (threshold > 0 && qtyBefore >= threshold && qtyAfter < threshold) {
      await createNotification(tx, {
        companyId,
        actorId: userId,
        type: 'low_stock',
        title: 'Reaktiv zaxirasi kam qoldi',
        message: `${reagent.name} — qoldiq: ${qtyAfter} ${reagent.unit}`,
        referenceId: reagent.id,
      });
    }

    await writeAudit(tx, {
      userId,
      companyId,
      action: 'create',
      tableName: 'reagent_transactions',
      recordId: txRow.id,
      newValues: {
        reagent_id: reagentId,
        type: txRow.type,
        quantity: Number(txRow.quantity),
        quantity_before: qtyBefore,
        quantity_after: qtyAfter,
      },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return toReagentTransactionDto(txRow);
  });
}

export async function listTransactions(
  companyId: string,
  reagentId: string,
  q: ListTransactionsQuery,
): Promise<PaginatedResult<ReagentTransactionDto>> {
  await getReagentById(companyId, reagentId);
  const conditions: string[] = ['t.company_id = $1', 't.reagent_id = $2'];
  const params: unknown[] = [companyId, reagentId];

  if (q.type) {
    params.push(q.type);
    conditions.push(`t.type = $${params.length}`);
  }
  if (q.from) {
    params.push(q.from);
    conditions.push(`t.recorded_date >= $${params.length}::date`);
  }
  if (q.to) {
    params.push(q.to);
    conditions.push(`t.recorded_date <= $${params.length}::date`);
  }
  if (q.protocolId) {
    params.push(q.protocolId);
    conditions.push(`t.protocol_id = $${params.length}`);
  }

  const where = conditions.join(' AND ');
  const [list, count] = await Promise.all([
    query<ReagentTransactionRow>(
      `SELECT t.*, u.full_name AS user_full_name, r.name AS reagent_name, r.unit AS reagent_unit
       FROM reagent_transactions t
       JOIN reagents r ON r.id = t.reagent_id
       LEFT JOIN users u ON u.id = t.user_id
       WHERE ${where}
       ORDER BY t.created_at DESC, t.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, toOffset(q)],
    ),
    query<{ total: string }>(
      `SELECT count(*) AS total FROM reagent_transactions t WHERE ${where}`,
      params,
    ),
  ]);

  return {
    items: list.rows.map(toReagentTransactionDto),
    meta: { page: q.page, limit: q.limit, total: Number(count.rows[0]?.total ?? 0) },
  };
}

export async function listExpenses(
  companyId: string,
  q: ListExpensesQuery,
): Promise<PaginatedResult<ReagentTransactionDto>> {
  const conditions: string[] = ['t.company_id = $1', "t.type = 'out'"];
  const params: unknown[] = [companyId];

  if (q.reagentId) {
    params.push(q.reagentId);
    conditions.push(`t.reagent_id = $${params.length}`);
  }
  if (q.protocolId) {
    params.push(q.protocolId);
    conditions.push(`t.protocol_id = $${params.length}`);
  }
  if (q.from) {
    params.push(q.from);
    conditions.push(`t.recorded_date >= $${params.length}::date`);
  }
  if (q.to) {
    params.push(q.to);
    conditions.push(`t.recorded_date <= $${params.length}::date`);
  }

  const where = conditions.join(' AND ');
  const [list, count] = await Promise.all([
    query<ReagentTransactionRow>(
      `SELECT t.*, u.full_name AS user_full_name, r.name AS reagent_name, r.unit AS reagent_unit
       FROM reagent_transactions t
       JOIN reagents r ON r.id = t.reagent_id
       LEFT JOIN users u ON u.id = t.user_id
       WHERE ${where}
       ORDER BY t.recorded_date DESC, t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, toOffset(q)],
    ),
    query<{ total: string }>(
      `SELECT count(*) AS total FROM reagent_transactions t WHERE ${where}`,
      params,
    ),
  ]);

  return {
    items: list.rows.map(toReagentTransactionDto),
    meta: { page: q.page, limit: q.limit, total: Number(count.rows[0]?.total ?? 0) },
  };
}

export async function getExpenseCalendar(
  companyId: string,
  yearMonth: string, // YYYY-MM
): Promise<Array<{ date: string; totalItems: number; items: Array<{ reagentName: string; quantity: number; unit: string }> }>> {
  const { rows } = await query<{
    recorded_date: string;
    reagent_name: string;
    unit: string;
    total_qty: string;
  }>(
    `SELECT t.recorded_date::text, r.name AS reagent_name, r.unit, sum(t.quantity) AS total_qty
     FROM reagent_transactions t
     JOIN reagents r ON r.id = t.reagent_id
     WHERE t.company_id = $1 AND t.type = 'out' AND to_char(t.recorded_date, 'YYYY-MM') = $2
     GROUP BY t.recorded_date, r.name, r.unit
     ORDER BY t.recorded_date ASC`,
    [companyId, yearMonth],
  );

  const groups = new Map<string, Array<{ reagentName: string; quantity: number; unit: string }>>();
  for (const r of rows) {
    const d = r.recorded_date.slice(0, 10);
    const arr = groups.get(d) ?? [];
    arr.push({ reagentName: r.reagent_name, quantity: Number(r.total_qty), unit: r.unit });
    groups.set(d, arr);
  }

  return Array.from(groups.entries()).map(([date, items]) => ({
    date,
    totalItems: items.length,
    items,
  }));
}

export async function uploadReagentDocument(
  storage: FileStorage,
  companyId: string,
  userId: string,
  reagentId: string,
  docType: 'passport' | 'analysis',
  incomingFile: IncomingFile | undefined,
  meta?: { ip?: string; userAgent?: string },
): Promise<ReagentDocumentDto> {
  const reagent = await getReagentById(companyId, reagentId);
  const validated = assertAllowedFile(incomingFile, REAGENT_DOC_MAX_BYTES);
  const key = buildKey(companyId, 'reagents', validated.ext);

  const actorMeta: ActorMeta = { userId, companyId, ip: meta?.ip, userAgent: meta?.userAgent };

  return await runWithUpload(
    storage,
    { key, body: validated.buffer, contentType: validated.mime },
    async (tx) => {
      const fileRow = await insertFileRecord(tx, actorMeta, { key, file: validated });

      const { rows } = await tx.query<ReagentDocumentRow>(
        `INSERT INTO reagent_documents (
           company_id, reagent_id, file_id, doc_type,
           file_name, file_path, file_size, file_mime, uploaded_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          companyId,
          reagent.id,
          fileRow.id,
          docType,
          validated.filename,
          key,
          validated.size,
          validated.mime,
          userId,
        ],
      );

      await writeAudit(tx, {
        userId,
        companyId,
        action: 'create',
        tableName: 'reagent_documents',
        recordId: rows[0]!.id,
        newValues: { reagent_id: reagentId, doc_type: docType, filename: validated.filename },
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });

      return toReagentDocumentDto(rows[0]!);
    },
  );
}

export async function listReagentDocuments(
  companyId: string,
  reagentId: string,
): Promise<ReagentDocumentDto[]> {
  await getReagentById(companyId, reagentId);
  const { rows } = await query<ReagentDocumentRow>(
    `SELECT d.*, u.full_name AS uploaded_by_name
     FROM reagent_documents d
     LEFT JOIN users u ON u.id = d.uploaded_by
     WHERE d.reagent_id = $1 AND d.company_id = $2
     ORDER BY d.uploaded_at DESC`,
    [reagentId, companyId],
  );
  return rows.map(toReagentDocumentDto);
}

export async function getReagentDocumentDownloadUrl(
  storage: FileStorage,
  companyId: string,
  reagentId: string,
  docId: string,
): Promise<DownloadLink> {
  const { rows } = await query<ReagentDocumentRow>(
    `SELECT * FROM reagent_documents WHERE id = $1 AND reagent_id = $2 AND company_id = $3`,
    [docId, reagentId, companyId],
  );
  if (!rows[0]) throw new NotFoundError('Hujjat topilmadi');
  const doc = rows[0];

  return await getDownloadUrl(storage, {
    r2_key: doc.file_path,
    filename: doc.file_name,
    mime_type: doc.file_mime ?? 'application/octet-stream',
  });
}

export async function deleteReagentDocument(
  storage: FileStorage,
  companyId: string,
  userId: string,
  reagentId: string,
  docId: string,
  meta?: { ip?: string; userAgent?: string },
): Promise<void> {
  const { rows } = await query<ReagentDocumentRow>(
    `SELECT * FROM reagent_documents WHERE id = $1 AND reagent_id = $2 AND company_id = $3`,
    [docId, reagentId, companyId],
  );
  if (!rows[0]) throw new NotFoundError('Hujjat topilmadi');
  const doc = rows[0];

  await withTransaction(async (tx) => {
    await tx.query(
      `DELETE FROM reagent_documents WHERE id = $1 AND reagent_id = $2 AND company_id = $3`,
      [docId, reagentId, companyId],
    );

    const actorMeta: ActorMeta = { userId, companyId, ip: meta?.ip, userAgent: meta?.userAgent };
    await deleteFileRecordByKey(tx, actorMeta, doc.file_path);

    await writeAudit(tx, {
      userId,
      companyId,
      action: 'delete',
      tableName: 'reagent_documents',
      recordId: docId,
      oldValues: { filename: doc.file_name, doc_type: doc.doc_type },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  });

  await deleteObjectSafely(storage, doc.file_path);
}
