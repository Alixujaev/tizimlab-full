import type pg from 'pg';
import { query, withTransaction } from '../../config/database.js';
import { AppError, ForbiddenError, NotFoundError } from '../../utils/errors.js';
import type { PageMeta } from '../../utils/http.js';
import { toOffset } from '../../utils/pagination.js';
import { writeAudit } from '../audit/audit.service.js';
import type { Role } from '../auth/auth.types.js';
import { enqueueIndex } from '../rag/rag.indexer.js';
import type { CreateOosInput, ListOosQuery, OosStatusInput } from './oos.schemas.js';

/**
 * D-194: OOS holatlari. Inson ochadi (biriktirilgan kimyogar yoki lab_head), avto-ochilmaydi; yopish — faqat
 * lab_head, ildiz sabab va izoh bilan. Jurnal (izohlar, holat o'zgarishlari) AI'siz to'liq ishlaydi.
 * Yopilgan holat RAG bazasiga (`oos_case`) navbatga qo'yiladi — "o'xshash holatlar tarixi".
 * Ko'rish: lab_head, director, admin — hammasi; kimyogar — o'zi ochgan yoki o'ziga biriktirilgan namuna.
 */

export interface OosUser {
  id: string;
  role: Role;
}
type Meta = { ip?: string; userAgent?: string };

interface CaseRow {
  id: string;
  company_id: string;
  sample_id: string;
  protocol_id: string | null;
  test_name: string;
  result_value: string;
  spec_limit: string;
  unit: string | null;
  description: string | null;
  status: 'open' | 'investigating' | 'closed';
  opened_by: string | null;
  opened_by_name?: string | null;
  opened_at: Date;
  root_cause: string | null;
  closure_note: string | null;
  closed_by: string | null;
  closed_by_name?: string | null;
  closed_at: Date | null;
  substance_name: string;
  serial_number: string | null;
  assigned_to: string | null;
  updated_at: Date;
}

export interface OosCaseDto {
  id: string;
  sampleId: string;
  protocolId: string | null;
  substanceName: string;
  serialNumber: string | null;
  testName: string;
  resultValue: string;
  specLimit: string;
  unit: string | null;
  description: string | null;
  status: CaseRow['status'];
  openedBy: string | null;
  openedByName: string | null;
  openedAt: string;
  rootCause: string | null;
  closureNote: string | null;
  closedBy: string | null;
  closedByName: string | null;
  closedAt: string | null;
  updatedAt: string;
}

const toDto = (r: CaseRow): OosCaseDto => ({
  id: r.id,
  sampleId: r.sample_id,
  protocolId: r.protocol_id,
  substanceName: r.substance_name,
  serialNumber: r.serial_number,
  testName: r.test_name,
  resultValue: r.result_value,
  specLimit: r.spec_limit,
  unit: r.unit,
  description: r.description,
  status: r.status,
  openedBy: r.opened_by,
  openedByName: r.opened_by_name ?? null,
  openedAt: new Date(r.opened_at).toISOString(),
  rootCause: r.root_cause,
  closureNote: r.closure_note,
  closedBy: r.closed_by,
  closedByName: r.closed_by_name ?? null,
  closedAt: r.closed_at ? new Date(r.closed_at).toISOString() : null,
  updatedAt: new Date(r.updated_at).toISOString(),
});

const CASE_SELECT = `SELECT c.*, s.substance_name, s.serial_number, s.assigned_to,
       ou.full_name AS opened_by_name, cu.full_name AS closed_by_name
  FROM oos_cases c
  JOIN samples s ON s.id = c.sample_id
  LEFT JOIN users ou ON ou.id = c.opened_by
  LEFT JOIN users cu ON cu.id = c.closed_by`;

/** Kimyogar — o'zi ochgan yoki o'ziga biriktirilgan; lab_head/director/admin — kompaniya bo'yicha hammasi. */
export function canSeeCase(user: OosUser, row: Pick<CaseRow, 'opened_by' | 'assigned_to'>): boolean {
  if (user.role === 'chemist') return row.opened_by === user.id || row.assigned_to === user.id;
  return ['lab_head', 'director', 'admin'].includes(user.role);
}

export async function loadCase(
  db: pg.PoolClient | null,
  companyId: string,
  user: OosUser,
  id: string,
  lock = false,
): Promise<CaseRow> {
  const sql = `${CASE_SELECT} WHERE c.id = $1 AND c.company_id = $2${lock ? ' FOR UPDATE OF c' : ''}`;
  const res = db ? await db.query<CaseRow>(sql, [id, companyId]) : await query<CaseRow>(sql, [id, companyId]);
  const row = res.rows[0];
  if (!row || !canSeeCase(user, row)) throw new NotFoundError('OOS holati topilmadi');
  return row;
}

export async function listCases(
  companyId: string,
  user: OosUser,
  q: ListOosQuery,
): Promise<{ data: OosCaseDto[]; meta: PageMeta }> {
  const params: unknown[] = [companyId];
  const where = ['c.company_id = $1'];
  // Kimyogar sharti: UUID'lar parametr sifatida (interpolatsiya yo'q)
  if (user.role === 'chemist') {
    params.push(user.id);
    where.push(`(c.opened_by = $${params.length} OR s.assigned_to = $${params.length})`);
  }
  if (q.status) {
    params.push(q.status);
    where.push(`c.status = $${params.length}`);
  }
  if (q.sampleId) {
    params.push(q.sampleId);
    where.push(`c.sample_id = $${params.length}`);
  }
  if (q.search) {
    params.push(`%${q.search}%`);
    where.push(`(s.substance_name ILIKE $${params.length} OR c.test_name ILIKE $${params.length} OR s.serial_number ILIKE $${params.length})`);
  }
  const w = where.join(' AND ');
  const count = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM oos_cases c JOIN samples s ON s.id = c.sample_id WHERE ${w}`,
    params,
  );
  const { rows } = await query<CaseRow>(
    `${CASE_SELECT} WHERE ${w} ORDER BY (c.status = 'closed'), c.opened_at DESC, c.id
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, q.limit, toOffset(q)],
  );
  return {
    data: rows.map(toDto),
    meta: { page: q.page, limit: q.limit, total: Number(count.rows[0]?.n ?? 0) },
  };
}

export interface OosNoteDto {
  id: string;
  kind: 'note' | 'status_change';
  text: string;
  userId: string | null;
  userName: string | null;
  createdAt: string;
}

export async function getCase(companyId: string, user: OosUser, id: string) {
  const row = await loadCase(null, companyId, user, id);
  const notes = await query<{ id: string; kind: OosNoteDto['kind']; text: string; user_id: string | null; user_name: string | null; created_at: Date }>(
    `SELECT n.id, n.kind, n.text, n.user_id, u.full_name AS user_name, n.created_at
       FROM oos_case_notes n LEFT JOIN users u ON u.id = n.user_id
      WHERE n.case_id = $1 AND n.company_id = $2 ORDER BY n.created_at, n.id`,
    [id, companyId],
  );
  const peaks = row.protocol_id
    ? await query<{ id: string; filename: string; confirmed: string }>(
        `SELECT pf.id, f.filename,
                (SELECT count(*) FROM peak_results r WHERE r.protocol_file_id = pf.id AND r.status = 'confirmed')::text AS confirmed
           FROM protocol_files pf JOIN files f ON f.id = pf.file_id
          WHERE pf.protocol_id = $1 AND pf.company_id = $2 AND pf.kind = 'peak' ORDER BY pf.created_at`,
        [row.protocol_id, companyId],
      )
    : { rows: [] };
  return {
    ...toDto(row),
    notes: notes.rows.map((n) => ({
      id: n.id,
      kind: n.kind,
      text: n.text,
      userId: n.user_id,
      userName: n.user_name,
      createdAt: new Date(n.created_at).toISOString(),
    })),
    peakFiles: peaks.rows.map((p) => ({ id: p.id, fileName: p.filename, confirmedResults: Number(p.confirmed) })),
  };
}

export async function createCase(
  companyId: string,
  user: OosUser,
  input: CreateOosInput,
  meta: Meta = {},
): Promise<OosCaseDto> {
  const id = await withTransaction(async (tx) => {
    const s = await tx.query<{ id: string; assigned_to: string | null }>(
      `SELECT id, assigned_to FROM samples WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [input.sampleId, companyId],
    );
    const sample = s.rows[0];
    if (!sample) throw new NotFoundError('Namuna topilmadi');
    // Kimyogar faqat o'ziga biriktirilgan namuna bo'yicha ochadi
    if (user.role === 'chemist' && sample.assigned_to !== user.id) throw new NotFoundError('Namuna topilmadi');
    if (input.protocolId) {
      const p = await tx.query(`SELECT 1 FROM protocols WHERE id = $1 AND sample_id = $2 AND company_id = $3`, [
        input.protocolId,
        input.sampleId,
        companyId,
      ]);
      if (!p.rows.length) throw new NotFoundError('Protokol topilmadi');
    }
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO oos_cases (company_id, sample_id, protocol_id, test_name, result_value, spec_limit, unit,
                              description, opened_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        companyId,
        input.sampleId,
        input.protocolId ?? null,
        input.testName,
        input.resultValue,
        input.specLimit,
        input.unit ?? null,
        input.description ?? null,
        user.id,
      ],
    );
    await tx.query(
      `INSERT INTO oos_case_notes (company_id, case_id, user_id, kind, text) VALUES ($1, $2, $3, 'status_change', 'open')`,
      [companyId, rows[0]!.id, user.id],
    );
    await writeAudit(tx, {
      userId: user.id,
      companyId,
      action: 'oos_open',
      tableName: 'oos_cases',
      recordId: rows[0]!.id,
      newValues: { ...input },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return rows[0]!.id;
  });
  return toDto(await loadCase(null, companyId, user, id));
}

export async function addNote(
  companyId: string,
  user: OosUser,
  id: string,
  text: string,
): Promise<OosNoteDto> {
  return withTransaction(async (tx) => {
    const c = await loadCase(tx, companyId, user, id, true);
    if (c.status === 'closed') throw new AppError(409, 'OOS_CLOSED', 'Yopilgan OOS holatiga izoh qo‘shib bo‘lmaydi');
    const { rows } = await tx.query<{ id: string; created_at: Date }>(
      `INSERT INTO oos_case_notes (company_id, case_id, user_id, kind, text) VALUES ($1, $2, $3, 'note', $4)
       RETURNING id, created_at`,
      [companyId, id, user.id, text],
    );
    return { id: rows[0]!.id, kind: 'note', text, userId: user.id, userName: null, createdAt: new Date(rows[0]!.created_at).toISOString() };
  });
}

export async function changeStatus(
  companyId: string,
  user: OosUser,
  id: string,
  input: OosStatusInput,
  meta: Meta = {},
): Promise<OosCaseDto> {
  await withTransaction(async (tx) => {
    const c = await loadCase(tx, companyId, user, id, true);
    if (c.status === 'closed') throw new AppError(409, 'OOS_CLOSED', 'OOS holati allaqachon yopilgan');
    if (input.status === 'investigating') {
      if (c.status !== 'open') {
        throw new AppError(409, 'INVALID_OOS_STATUS', 'Faqat ochiq holat tergovga o‘tadi');
      }
      await tx.query(`UPDATE oos_cases SET status = 'investigating' WHERE id = $1`, [id]);
      await tx.query(
        `INSERT INTO oos_case_notes (company_id, case_id, user_id, kind, text) VALUES ($1, $2, $3, 'status_change', $4)`,
        [companyId, id, user.id, input.note ? `investigating: ${input.note}` : 'investigating'],
      );
    } else {
      // D-194: yopish — FAQAT lab_head (AI yoki boshqa rol emas)
      if (user.role !== 'lab_head') throw new ForbiddenError('OOS holatini faqat laboratoriya mudiri yopadi');
      await tx.query(
        `UPDATE oos_cases SET status = 'closed', root_cause = $2, closure_note = $3, closed_by = $4, closed_at = now()
          WHERE id = $1`,
        [id, input.rootCause, input.closureNote, user.id],
      );
      await tx.query(
        `INSERT INTO oos_case_notes (company_id, case_id, user_id, kind, text) VALUES ($1, $2, $3, 'status_change', 'closed')`,
        [companyId, id, user.id],
      );
      await enqueueIndex(tx, { companyId, sourceType: 'oos_case', sourceId: id });
    }
    await writeAudit(tx, {
      userId: user.id,
      companyId,
      action: input.status === 'closed' ? 'oos_close' : 'oos_investigate',
      tableName: 'oos_cases',
      recordId: id,
      oldValues: { status: c.status },
      newValues: { ...input },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  });
  return toDto(await loadCase(null, companyId, user, id));
}
