import type pg from 'pg';
import { query, withTransaction } from '../../config/database.js';
import { AppError, NotFoundError } from '../../utils/errors.js';
import { toOffset, type PaginatedResult } from '../../utils/pagination.js';
import { normalizeUnit } from '../../utils/units.js';
import { writeAudit } from '../audit/audit.service.js';
import {
  buildKey,
  getDownloadUrl,
  insertFileRecord,
  runWithUpload,
  type DownloadLink,
} from '../files/files.service.js';
import type { FileStorage } from '../files/files.storage.js';
import {
  assertAllowedFile,
  UnsupportedMediaTypeError,
  type IncomingFile,
} from '../files/files.validation.js';
import type {
  CreateNdInput,
  ListNdQuery,
  NdRequirementInput,
  UpdateNdInput,
} from './nd.schemas.js';

export type NdStatus = 'draft' | 'approved' | 'archived';
type Meta = { ip?: string; userAgent?: string };

export const ND_FILE_MAX_BYTES = 20 * 1024 * 1024;
/** ND fayli: PDF yoki rasm (TZ §3.3) — P18 da OCR/AI shu fayldan o'qiydi. */
const ND_FILE_KINDS = new Set(['pdf', 'jpeg', 'png']);

interface NdRow {
  id: string;
  company_id: string;
  code: string;
  name: string;
  version: string | null;
  status: NdStatus;
  approved_by: string | null;
  approved_at: Date | null;
  file_name: string | null;
  file_path: string | null;
  file_size: number | null;
  file_mime: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  requirement_count?: string;
}

export interface NdRequirementRow {
  id: string;
  company_id: string;
  nd_id: string;
  kind: 'equipment' | 'reagent';
  method_name: string | null;
  equipment_category: string | null;
  equipment_category_key: string | null;
  reagent_item_id: string | null;
  reagent_item_name?: string | null;
  reagent_unit_family?: string | null;
  quantity_per_analysis: string | null;
  unit: string | null;
  source: 'manual' | 'ai';
  note: string | null;
  sort_order: number;
}

export interface NdRequirementDto {
  id: string;
  kind: 'equipment' | 'reagent';
  methodName: string | null;
  equipmentCategory: string | null;
  reagentItemId: string | null;
  reagentItemName: string | null;
  quantityPerAnalysis: number | null;
  unit: string | null;
  source: 'manual' | 'ai';
  note: string | null;
  sortOrder: number;
}

export interface NdDto {
  id: string;
  code: string;
  name: string;
  version: string | null;
  status: NdStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  fileName: string | null;
  fileSize: number | null;
  hasFile: boolean;
  requirementCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface NdDetailDto extends NdDto {
  requirements: NdRequirementDto[];
}

function toNdDto(row: NdRow): NdDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    version: row.version,
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
    fileName: row.file_name,
    fileSize: row.file_size,
    hasFile: Boolean(row.file_path),
    requirementCount: Number(row.requirement_count ?? 0),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function toRequirementDto(r: NdRequirementRow): NdRequirementDto {
  return {
    id: r.id,
    kind: r.kind,
    methodName: r.method_name,
    equipmentCategory: r.equipment_category,
    reagentItemId: r.reagent_item_id,
    reagentItemName: r.reagent_item_name ?? null,
    quantityPerAnalysis: r.quantity_per_analysis === null ? null : Number(r.quantity_per_analysis),
    unit: r.unit,
    source: r.source,
    note: r.note,
    sortOrder: r.sort_order,
  };
}

const ND_SELECT = `SELECT n.*, (SELECT count(*) FROM nd_requirements q WHERE q.nd_id = n.id) AS requirement_count
  FROM normative_documents n`;

async function loadNd(
  db: pg.PoolClient | null,
  companyId: string,
  id: string,
  lock = false,
): Promise<NdRow> {
  const sql = `${ND_SELECT} WHERE n.id = $1 AND n.company_id = $2`;
  const res = db
    ? await db.query<NdRow>(
        lock
          ? `SELECT * FROM normative_documents WHERE id = $1 AND company_id = $2 FOR UPDATE`
          : sql,
        [id, companyId],
      )
    : await query<NdRow>(sql, [id, companyId]);
  if (!res.rows[0]) throw new NotFoundError('Normativ hujjat (ND) topilmadi');
  return res.rows[0];
}

export async function loadRequirements(
  db: pg.PoolClient | null,
  companyId: string,
  ndId: string,
): Promise<NdRequirementRow[]> {
  const sql = `SELECT q.*, i.name AS reagent_item_name, i.unit_family AS reagent_unit_family
     FROM nd_requirements q LEFT JOIN reagent_items i ON i.id = q.reagent_item_id
     WHERE q.nd_id = $1 AND q.company_id = $2
     ORDER BY q.kind, q.sort_order, q.created_at, q.id`;
  const res = db
    ? await db.query<NdRequirementRow>(sql, [ndId, companyId])
    : await query<NdRequirementRow>(sql, [ndId, companyId]);
  return res.rows;
}

export async function listNd(companyId: string, q: ListNdQuery): Promise<PaginatedResult<NdDto>> {
  const where = ['n.company_id = $1'];
  const params: unknown[] = [companyId];
  if (q.search) {
    params.push(`%${q.search}%`);
    where.push(`(n.code ILIKE $${params.length} OR n.name ILIKE $${params.length})`);
  }
  if (q.status) {
    params.push(q.status);
    where.push(`n.status = $${params.length}::nd_status`);
  }
  const w = where.join(' AND ');
  const [list, count] = await Promise.all([
    query<NdRow>(
      `${ND_SELECT} WHERE ${w} ORDER BY n.code, n.version NULLS FIRST, n.id
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, toOffset(q)],
    ),
    query<{ total: string }>(
      `SELECT count(*) AS total FROM normative_documents n WHERE ${w}`,
      params,
    ),
  ]);
  return {
    items: list.rows.map(toNdDto),
    meta: { page: q.page, limit: q.limit, total: Number(count.rows[0]?.total ?? 0) },
  };
}

export async function getNd(companyId: string, id: string): Promise<NdDetailDto> {
  const nd = await loadNd(null, companyId, id);
  const reqs = await loadRequirements(null, companyId, id);
  return { ...toNdDto(nd), requirements: reqs.map(toRequirementDto) };
}

export async function createNd(
  companyId: string,
  userId: string,
  input: CreateNdInput,
  meta: Meta = {},
): Promise<NdDetailDto> {
  const id = await withTransaction(async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO normative_documents (company_id, code, name, version, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [companyId, input.code, input.name, input.version ?? null, userId],
    );
    await writeAudit(tx, {
      userId,
      companyId,
      action: 'create',
      tableName: 'normative_documents',
      recordId: rows[0]!.id,
      newValues: { ...input },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return rows[0]!.id;
  });
  return getNd(companyId, id);
}

export async function updateNd(
  companyId: string,
  userId: string,
  id: string,
  input: UpdateNdInput,
  meta: Meta = {},
): Promise<NdDetailDto> {
  await withTransaction(async (tx) => {
    const prev = await loadNd(tx, companyId, id, true);
    await tx.query(
      `UPDATE normative_documents
         SET code = COALESCE($3, code), name = COALESCE($4, name),
             version = CASE WHEN $5::boolean THEN $6 ELSE version END
       WHERE id = $1 AND company_id = $2`,
      [
        id,
        companyId,
        input.code ?? null,
        input.name ?? null,
        input.version !== undefined,
        input.version ?? null,
      ],
    );
    await writeAudit(tx, {
      userId,
      companyId,
      action: 'update',
      tableName: 'normative_documents',
      recordId: id,
      oldValues: { code: prev.code, name: prev.name, version: prev.version },
      newValues: { ...input },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  });
  return getNd(companyId, id);
}

/** Faqat qoralama va hech bir tahlilga bog'lanmagan ND o'chiriladi — iz yo'qolmasin. */
export async function deleteNd(
  companyId: string,
  userId: string,
  id: string,
  meta: Meta = {},
): Promise<void> {
  await withTransaction(async (tx) => {
    const nd = await loadNd(tx, companyId, id, true);
    if (nd.status !== 'draft')
      throw new AppError(409, 'ND_NOT_DRAFT', 'Faqat qoralama ND ni o‘chirish mumkin');
    const used = await tx.query(`SELECT 1 FROM protocols WHERE nd_id = $1 LIMIT 1`, [id]);
    if (used.rows.length)
      throw new AppError(409, 'ND_IN_USE', 'ND tahlillarga bog‘langan — o‘chirib bo‘lmaydi');
    await tx.query(`DELETE FROM normative_documents WHERE id = $1 AND company_id = $2`, [
      id,
      companyId,
    ]);
    await writeAudit(tx, {
      userId,
      companyId,
      action: 'delete',
      tableName: 'normative_documents',
      recordId: id,
      oldValues: { code: nd.code, name: nd.name, version: nd.version },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  });
}

function assertDraft(nd: NdRow): void {
  if (nd.status !== 'draft') {
    throw new AppError(
      409,
      'ND_NOT_DRAFT',
      'Talablarni faqat qoralama (draft) holatida tahrirlash mumkin',
      {
        status: nd.status,
      },
    );
  }
}

/**
 * Reaktiv talabi: katalog elementi shu kompaniyaniki, birlik element bilan bir oilada (ml↔l, g↔kg) —
 * aks holda sarfni hisoblab bo'lmaydi (422 UNIT_MISMATCH).
 */
async function validateRequirement(
  tx: pg.PoolClient,
  companyId: string,
  input: NdRequirementInput,
): Promise<void> {
  if (input.kind !== 'reagent') return;
  const { rows } = await tx.query<{ name: string; unit_family: string }>(
    `SELECT name, unit_family FROM reagent_items WHERE id = $1 AND company_id = $2`,
    [input.reagentItemId, companyId],
  );
  const item = rows[0];
  if (!item) throw new NotFoundError('Reaktiv katalog elementi topilmadi');
  const fam = normalizeUnit(input.unit)?.family;
  if (fam !== item.unit_family) {
    throw new AppError(
      422,
      'UNIT_MISMATCH',
      `"${input.unit}" birligi "${item.name}" reaktivi birligiga mos emas (konvertatsiya qilib bo‘lmaydi)`,
      { unit: input.unit, itemUnitFamily: item.unit_family },
    );
  }
}

function requirementParams(input: NdRequirementInput) {
  return input.kind === 'equipment'
    ? { category: input.equipmentCategory, item: null, qty: null, unit: null }
    : {
        category: null,
        item: input.reagentItemId,
        qty: input.quantityPerAnalysis,
        unit: input.unit.trim(),
      };
}

export async function addRequirement(
  companyId: string,
  userId: string,
  ndId: string,
  input: NdRequirementInput,
  meta: Meta = {},
): Promise<NdDetailDto> {
  await withTransaction(async (tx) => {
    assertDraft(await loadNd(tx, companyId, ndId, true));
    await validateRequirement(tx, companyId, input);
    const p = requirementParams(input);
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO nd_requirements (company_id, nd_id, kind, method_name, equipment_category, reagent_item_id,
                                    quantity_per_analysis, unit, note, sort_order)
       VALUES ($1, $2, $3::nd_requirement_kind, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        companyId,
        ndId,
        input.kind,
        input.methodName ?? null,
        p.category,
        p.item,
        p.qty,
        p.unit,
        input.note ?? null,
        input.sortOrder ?? 0,
      ],
    );
    await writeAudit(tx, {
      userId,
      companyId,
      action: 'create',
      tableName: 'nd_requirements',
      recordId: rows[0]!.id,
      newValues: { nd_id: ndId, ...input },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  });
  return getNd(companyId, ndId);
}

export async function updateRequirement(
  companyId: string,
  userId: string,
  ndId: string,
  reqId: string,
  input: NdRequirementInput,
  meta: Meta = {},
): Promise<NdDetailDto> {
  await withTransaction(async (tx) => {
    assertDraft(await loadNd(tx, companyId, ndId, true));
    await validateRequirement(tx, companyId, input);
    const p = requirementParams(input);
    const { rows } = await tx.query<NdRequirementRow>(
      `UPDATE nd_requirements
         SET kind = $4::nd_requirement_kind, method_name = $5, equipment_category = $6, reagent_item_id = $7,
             quantity_per_analysis = $8, unit = $9, note = $10, sort_order = COALESCE($11, sort_order), source = 'manual'
       WHERE id = $1 AND nd_id = $2 AND company_id = $3
       RETURNING *`,
      [
        reqId,
        ndId,
        companyId,
        input.kind,
        input.methodName ?? null,
        p.category,
        p.item,
        p.qty,
        p.unit,
        input.note ?? null,
        input.sortOrder ?? null,
      ],
    );
    if (!rows[0]) throw new NotFoundError('Talab topilmadi');
    await writeAudit(tx, {
      userId,
      companyId,
      action: 'update',
      tableName: 'nd_requirements',
      recordId: reqId,
      newValues: { ...input },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  });
  return getNd(companyId, ndId);
}

export async function deleteRequirement(
  companyId: string,
  userId: string,
  ndId: string,
  reqId: string,
  meta: Meta = {},
): Promise<NdDetailDto> {
  await withTransaction(async (tx) => {
    assertDraft(await loadNd(tx, companyId, ndId, true));
    const { rows } = await tx.query(
      `DELETE FROM nd_requirements WHERE id = $1 AND nd_id = $2 AND company_id = $3 RETURNING id`,
      [reqId, ndId, companyId],
    );
    if (!rows[0]) throw new NotFoundError('Talab topilmadi');
    await writeAudit(tx, {
      userId,
      companyId,
      action: 'delete',
      tableName: 'nd_requirements',
      recordId: reqId,
      oldValues: { nd_id: ndId },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  });
  return getNd(companyId, ndId);
}

const TRANSITIONS: Record<'approve' | 'revise' | 'archive', { from: NdStatus[]; to: NdStatus }> = {
  approve: { from: ['draft'], to: 'approved' },
  revise: { from: ['approved', 'archived'], to: 'draft' },
  archive: { from: ['draft', 'approved'], to: 'archived' },
};

/** D-176: draft → approved (kamida bitta talab), approved → draft (qayta ko'rib chiqish), → archived. */
export async function changeNdStatus(
  companyId: string,
  userId: string,
  id: string,
  action: keyof typeof TRANSITIONS,
  meta: Meta = {},
): Promise<NdDetailDto> {
  await withTransaction(async (tx) => {
    const nd = await loadNd(tx, companyId, id, true);
    const t = TRANSITIONS[action];
    if (!t.from.includes(nd.status)) {
      throw new AppError(
        409,
        'INVALID_ND_STATUS',
        `ND holati "${nd.status}" — bu amal mumkin emas`,
        {
          status: nd.status,
          action,
        },
      );
    }
    if (action === 'approve') {
      const { rows } = await tx.query(`SELECT 1 FROM nd_requirements WHERE nd_id = $1 LIMIT 1`, [
        id,
      ]);
      if (!rows.length)
        throw new AppError(
          422,
          'ND_NO_REQUIREMENTS',
          'Tasdiqlash uchun kamida bitta talab kiriting',
        );
    }
    await tx.query(
      `UPDATE normative_documents
         SET status = $3::nd_status,
             approved_by = CASE WHEN $3 = 'approved' THEN $4::uuid ELSE NULL END,
             approved_at = CASE WHEN $3 = 'approved' THEN now() ELSE NULL END
       WHERE id = $1 AND company_id = $2`,
      [id, companyId, t.to, userId],
    );
    await writeAudit(tx, {
      userId,
      companyId,
      action: 'status_change',
      tableName: 'normative_documents',
      recordId: id,
      oldValues: { status: nd.status },
      newValues: { status: t.to },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  });
  return getNd(companyId, id);
}

export async function uploadNdFile(
  storage: FileStorage,
  companyId: string,
  userId: string,
  ndId: string,
  file: IncomingFile | undefined,
  meta: Meta = {},
): Promise<NdDetailDto> {
  await loadNd(null, companyId, ndId);
  const validated = assertAllowedFile(file, ND_FILE_MAX_BYTES);
  if (!ND_FILE_KINDS.has(validated.kind)) {
    throw new UnsupportedMediaTypeError('ND fayli faqat PDF, JPEG yoki PNG bo‘lishi mumkin');
  }
  const key = buildKey(companyId, 'nd', validated.ext);
  await runWithUpload(
    storage,
    { key, body: validated.buffer, contentType: validated.mime },
    async (tx) => {
      await loadNd(tx, companyId, ndId, true);
      const fileRow = await insertFileRecord(
        tx,
        { userId, companyId, ip: meta.ip, userAgent: meta.userAgent },
        { key, file: validated },
      );
      await tx.query(
        `UPDATE normative_documents
         SET file_id = $3, file_name = $4, file_path = $5, file_size = $6, file_mime = $7
       WHERE id = $1 AND company_id = $2`,
        [ndId, companyId, fileRow.id, validated.filename, key, validated.size, validated.mime],
      );
      await writeAudit(tx, {
        userId,
        companyId,
        action: 'file_upload',
        tableName: 'normative_documents',
        recordId: ndId,
        newValues: { filename: validated.filename, size: validated.size },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    },
  );
  return getNd(companyId, ndId);
}

export async function getNdFileUrl(
  storage: FileStorage,
  companyId: string,
  ndId: string,
): Promise<DownloadLink> {
  const nd = await loadNd(null, companyId, ndId);
  if (!nd.file_path) throw new NotFoundError('ND fayli yuklanmagan');
  return getDownloadUrl(storage, {
    r2_key: nd.file_path,
    filename: nd.file_name ?? 'nd',
    mime_type: nd.file_mime ?? 'application/octet-stream',
  });
}
