import { query } from '../../config/database.js';
import { toIsoDay } from '../../utils/dates.js';
import type { PageMeta } from '../../utils/http.js';
import { toOffset } from '../../utils/pagination.js';
import { ANALYTICS_TZ } from '../analytics/analytics.period.js';
import type { ProtocolListQuery } from './protocols.schemas.js';
import type { ProtocolRole, ProtocolStatus, UserContext } from './protocols.types.js';

/**
 * P18 (D-187; TZ §3.5 "tezkor qidiruv", Addendum §3): kompaniya protokollari ro'yxati — xomashyo nomi, seriya,
 * sana oralig'i, kimyogar, apparat, holat bo'yicha. Kimyogar faqat o'ziga biriktirilgan/o'zi yaratgan
 * protokollarni ko'radi (protokol detali bilan bir xil qoida). Sana = tahlil sanasi, bo'lmasa yaratilgan kun.
 */

export interface ProtocolListItemDto {
  id: string;
  sampleId: string;
  substanceName: string;
  serialNumber: string | null;
  lotNumber: string | null;
  sampleType: string;
  status: ProtocolStatus;
  protocolRole: ProtocolRole;
  chemistId: string | null;
  chemistName: string | null;
  equipmentId: string | null;
  equipmentName: string | null;
  analysisDate: string | null;
  date: string;
  submittedAt: string | null;
  approvedAt: string | null;
  fileName: string | null;
  peakFiles: { id: string; fileName: string }[];
  rejectionCount: number;
}

interface Row {
  id: string;
  sample_id: string;
  substance_name: string;
  serial_number: string | null;
  lot_number: string | null;
  sample_type: string;
  status: ProtocolStatus;
  protocol_role: ProtocolRole;
  chemist_id: string | null;
  chemist_name: string | null;
  equipment_id: string | null;
  equipment_name: string | null;
  analysis_date: Date | string | null;
  list_date: Date | string;
  submitted_at: Date | null;
  approved_at: Date | null;
  file_name: string | null;
  peak_files: { id: string; fileName: string }[] | null;
  rejection_count: number;
}

export async function listProtocols(
  companyId: string,
  user: UserContext,
  q: ProtocolListQuery,
): Promise<{ data: ProtocolListItemDto[]; meta: PageMeta }> {
  const where: string[] = ['p.company_id = $1', 's.deleted_at IS NULL'];
  const values: unknown[] = [companyId, ANALYTICS_TZ];
  const add = (sql: (i: number) => string, v: unknown) => {
    values.push(v);
    where.push(sql(values.length));
  };
  const dateExpr = `COALESCE(p.analysis_date, (p.created_at AT TIME ZONE $2)::date)`;

  if (user.role === 'chemist')
    add((i) => `(s.assigned_to = $${i} OR p.created_by = $${i})`, user.id);
  if (q.substanceName) add((i) => `s.substance_name ILIKE $${i}`, `%${q.substanceName}%`);
  if (q.series)
    add((i) => `(s.serial_number ILIKE $${i} OR s.lot_number ILIKE $${i})`, `%${q.series}%`);
  if (q.dateFrom) add((i) => `${dateExpr} >= $${i}::date`, q.dateFrom);
  if (q.dateTo) add((i) => `${dateExpr} <= $${i}::date`, q.dateTo);
  if (q.chemistId) add((i) => `s.assigned_to = $${i}`, q.chemistId);
  if (q.equipmentId === 'unknown') where.push('p.equipment_id IS NULL');
  else if (q.equipmentId) add((i) => `p.equipment_id = $${i}`, q.equipmentId);
  if (q.status) add((i) => `p.status = $${i}`, q.status);
  if (q.hasPeaks) {
    where.push(
      `EXISTS (SELECT 1 FROM protocol_files x WHERE x.protocol_id = p.id AND x.kind = 'peak')`,
    );
  }

  // $2 (TZ) faqat dateExpr ichida; filtr bo'lmasa ham count so'rovida ishlatilishi uchun shart sifatida
  const from = `FROM protocols p
    JOIN samples s ON s.id = p.sample_id AND s.company_id = p.company_id
    LEFT JOIN users cu ON cu.id = s.assigned_to
    LEFT JOIN equipment e ON e.id = p.equipment_id
    WHERE ${where.join(' AND ')} AND ${dateExpr} IS NOT NULL`;
  const count = await query<{ n: string }>(`SELECT count(*)::text AS n ${from}`, values);

  values.push(q.limit, toOffset(q));
  const { rows } = await query<Row>(
    `SELECT p.id, p.sample_id, s.substance_name, s.serial_number, s.lot_number, s.type::text AS sample_type,
            p.status, p.protocol_role, s.assigned_to AS chemist_id, cu.full_name AS chemist_name,
            p.equipment_id, e.name AS equipment_name, p.analysis_date, ${dateExpr} AS list_date,
            p.submitted_at, p.approved_at, p.file_name,
            (SELECT json_agg(json_build_object('id', pf.id, 'fileName', f.filename) ORDER BY pf.created_at)
               FROM protocol_files pf JOIN files f ON f.id = pf.file_id
              WHERE pf.protocol_id = p.id AND pf.kind = 'peak') AS peak_files,
            (SELECT count(*)::int FROM protocol_rejections r WHERE r.protocol_id = p.id) AS rejection_count
       ${from}
       ORDER BY list_date DESC, p.created_at DESC, p.id
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );

  return {
    data: rows.map((r) => ({
      id: r.id,
      sampleId: r.sample_id,
      substanceName: r.substance_name,
      serialNumber: r.serial_number,
      lotNumber: r.lot_number,
      sampleType: r.sample_type,
      status: r.status,
      protocolRole: r.protocol_role,
      chemistId: r.chemist_id,
      chemistName: r.chemist_name,
      equipmentId: r.equipment_id,
      equipmentName: r.equipment_name,
      analysisDate: toIsoDay(r.analysis_date),
      date: toIsoDay(r.list_date) ?? '',
      submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : null,
      approvedAt: r.approved_at ? new Date(r.approved_at).toISOString() : null,
      fileName: r.file_name,
      peakFiles: r.peak_files ?? [],
      rejectionCount: Number(r.rejection_count ?? 0),
    })),
    meta: { page: q.page, limit: q.limit, total: Number(count.rows[0]?.n ?? 0) },
  };
}
