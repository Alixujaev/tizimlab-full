import type pg from 'pg';
import { query, withTransaction } from '../../config/database.js';
import { AppError, NotFoundError } from '../../utils/errors.js';
import type { PageMeta } from '../../utils/http.js';
import { toOffset } from '../../utils/pagination.js';
import { writeAudit } from '../audit/audit.service.js';
import type { DownloadLink } from '../files/files.service.js';
import type { FileStorage } from '../files/files.storage.js';
import { getPassportFileLink } from '../samples/samples.passport.service.js';
import type { RequestMeta } from '../samples/samples.service.js';
import {
  type SampleDto,
  type SampleRow,
  type SampleTrackingDto,
  type SampleTrackingRow,
  toSampleDto,
  toSampleTrackingDto,
} from '../samples/samples.types.js';
import { registryHooks } from './registry.hooks.js';
import type { RegistryListQuery } from './registry.schemas.js';

// Reyestr — kompaniyaning `approved` va o'chirilmagan namunalari (spec §3, D-07, D-31).
// Namunalar bo'limidagi "o'ziniki/biriktirilgan" cheklovi bu yerda YO'Q (D-31): barcha kompaniya rollari ko'radi.

export type RegistryDownloadKind = 'passport' | 'protocol' | null;

export interface RegistryItemDto extends SampleDto {
  approvedAt: string;
  downloadKind: RegistryDownloadKind;
}

export interface RegistryDetailDto extends RegistryItemDto {
  tracking: SampleTrackingDto[];
}

type RegistryRow = SampleRow & { approved_at: string };

/**
 * Tasdiqlangan sana — oxirgi `approved` tracking voqeasi (D-120; sxemada `approved_at` ustuni yo'q).
 * Voqea bo'lmasa (masalan ETL'dan kelgan) — `updated_at`.
 */
const REGISTRY_BASE = `
  SELECT s.*, COALESCE(a.approved_at, s.updated_at) AS approved_at
  FROM samples s
  LEFT JOIN LATERAL (
    SELECT t.created_at AS approved_at FROM sample_tracking t
    WHERE t.sample_id = s.id AND t.event_type = 'approved'
    ORDER BY t.created_at DESC LIMIT 1
  ) a ON true
  WHERE s.company_id = $1 AND s.status = 'approved' AND s.deleted_at IS NULL`;

/** Pasport orqali tasdiqlangan — pasport fayli; `finished_product` — final protokol fayli (D-44, P5). */
export function downloadKindOf(
  row: Pick<SampleRow, 'type' | 'passport_status' | 'passport_file_path'>,
): RegistryDownloadKind {
  if (row.passport_status === 'approved' && row.passport_file_path) return 'passport';
  if (row.type === 'finished_product') return 'protocol';
  return null;
}

const toItem = (row: RegistryRow): RegistryItemDto => ({
  ...toSampleDto(row),
  approvedAt: row.approved_at,
  downloadKind: downloadKindOf(row),
});

export async function listRegistry(
  companyId: string,
  params: RegistryListQuery,
): Promise<{ data: RegistryItemDto[]; meta: PageMeta }> {
  const where: string[] = [];
  const values: unknown[] = [companyId];
  const add = (sql: (idx: number) => string, value: unknown) => {
    values.push(value);
    where.push(sql(values.length));
  };

  if (params.type) add((i) => `r.type = $${i}`, params.type);
  if (params.substanceName) add((i) => `r.substance_name ILIKE $${i}`, `%${params.substanceName}%`);
  if (params.serialNumber) add((i) => `r.serial_number ILIKE $${i}`, `%${params.serialNumber}%`);
  if (params.lotNumber) add((i) => `r.lot_number ILIKE $${i}`, `%${params.lotNumber}%`);
  // Ikki tomoni inklyuziv: [from 00:00, to+1 00:00)
  if (params.approvedFrom) add((i) => `r.approved_at >= $${i}::date`, params.approvedFrom);
  if (params.approvedTo) add((i) => `r.approved_at < ($${i}::date + 1)`, params.approvedTo);

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const from = `FROM (${REGISTRY_BASE}) r ${whereSql}`;

  const countRes = await query<{ count: string }>(`SELECT COUNT(*)::text AS count ${from}`, values);
  values.push(params.limit, toOffset(params));
  const dataRes = await query<RegistryRow>(
    `SELECT r.* ${from} ORDER BY r.approved_at DESC, r.id LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return {
    data: dataRes.rows.map(toItem),
    meta: { page: params.page, limit: params.limit, total: Number(countRes.rows[0]?.count ?? 0) },
  };
}

async function getRegistryRow(companyId: string, sampleId: string): Promise<RegistryRow> {
  const { rows } = await query<RegistryRow>(`${REGISTRY_BASE} AND s.id = $2`, [
    companyId,
    sampleId,
  ]);
  // Approved bo'lmagan, o'chirilgan yoki boshqa kompaniya namunasi — 404 (D-102)
  if (!rows[0]) throw new NotFoundError('Reyestrda namuna topilmadi');
  return rows[0];
}

export async function getRegistryItem(
  companyId: string,
  sampleId: string,
): Promise<RegistryDetailDto> {
  const row = await getRegistryRow(companyId, sampleId);
  const trackingRes = await query<SampleTrackingRow & { user_full_name: string | null }>(
    `SELECT t.*, u.full_name AS user_full_name
     FROM sample_tracking t
     LEFT JOIN users u ON u.id = t.user_id
     WHERE t.sample_id = $1 AND t.company_id = $2
     ORDER BY t.created_at ASC`,
    [sampleId, companyId],
  );
  return { ...toItem(row), tracking: trackingRes.rows.map(toSampleTrackingDto) };
}

export async function getRegistryDownload(
  storage: FileStorage | null,
  companyId: string,
  sampleId: string,
): Promise<DownloadLink> {
  const row = await getRegistryRow(companyId, sampleId);
  const kind = downloadKindOf(row);
  if (kind === 'passport') return getPassportFileLink(storage, row);
  if (kind === 'protocol') {
    const link = await registryHooks.getFinalProtocolFile(row, storage);
    if (link) return link;
  }
  throw new AppError(404, 'FILE_NOT_FOUND', 'Yuklab olinadigan fayl topilmadi');
}

/** Soft-delete (D-43): `deleted_at`; protokol/fayllar/stabilizatsiya saqlanadi; tracking + audit bir tranzaksiyada. */
export async function deleteRegistryItem(
  companyId: string,
  userId: string,
  sampleId: string,
  meta: RequestMeta,
): Promise<void> {
  await withTransaction(async (tx: pg.PoolClient) => {
    const { rows } = await tx.query<SampleRow>(
      `SELECT * FROM samples
       WHERE id = $1 AND company_id = $2 AND status = 'approved' AND deleted_at IS NULL
       FOR UPDATE`,
      [sampleId, companyId],
    );
    const sample = rows[0];
    if (!sample) throw new NotFoundError('Reyestrda namuna topilmadi');

    await registryHooks.assertNoActiveStability(sample, tx);

    await tx.query(`UPDATE samples SET deleted_at = now() WHERE id = $1 AND company_id = $2`, [
      sampleId,
      companyId,
    ]);
    await tx.query(
      `INSERT INTO sample_tracking (company_id, sample_id, event_type, user_id, from_status, to_status, reason, metadata)
       VALUES ($1, $2, 'deleted', $3, $4, $4, null, $5)`,
      [companyId, sampleId, userId, sample.status, JSON.stringify({ source: 'registry' })],
    );
    await writeAudit(tx, {
      userId,
      companyId,
      action: 'delete',
      tableName: 'samples',
      recordId: sampleId,
      oldValues: { status: sample.status, deleted_at: null },
      newValues: { deleted_at: 'now' },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  });
}
