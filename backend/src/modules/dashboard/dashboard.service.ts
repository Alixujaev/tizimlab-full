import { query } from '../../config/database.js';
import type { Role } from '../auth/auth.types.js';
import type { SampleStatus } from '../samples/samples.types.js';
import type { DashboardDto, OpenProtocolStatus, StatusCounts } from './dashboard.types.js';

const SAMPLE_STATUSES: readonly SampleStatus[] = [
  'pending_assignment',
  'in_progress',
  'stopped',
  'submitted',
  'approved',
  'rejected',
];
const OPEN_PROTOCOL_STATUSES: readonly OpenProtocolStatus[] = [
  'draft',
  'submitted',
  'approved',
  'rejected',
];

function toCounts<S extends string>(
  keys: readonly S[],
  rows: { status: string; count: string }[],
): StatusCounts<S> {
  const counts = Object.fromEntries(keys.map((k) => [k, 0])) as StatusCounts<S>;
  for (const row of rows) if (row.status in counts) counts[row.status as S] = Number(row.count);
  return counts;
}

const sum = (counts: Record<string, number>): number =>
  Object.values(counts).reduce((a, b) => a + b, 0);

/**
 * Namunalar statuslar bo'yicha. Ko'rinish doirasi rolga mos (R-ROLE-13..17):
 * chemist — biriktirilganlar, kontrolyor — o'zi yaratganlar, qolganlar — butun kompaniya.
 * O'chirilgan (`deleted_at`) namunalar hisoblanmaydi.
 */
async function samplesByStatus(
  companyId: string,
  scope: { assignedTo?: string; createdBy?: string },
): Promise<StatusCounts<SampleStatus>> {
  const { rows } = await query<{ status: string; count: string }>(
    `SELECT status::text AS status, count(*) AS count
     FROM samples
     WHERE company_id = $1
       AND deleted_at IS NULL
       AND ($2::uuid IS NULL OR assigned_to = $2::uuid)
       AND ($3::uuid IS NULL OR created_by = $3::uuid)
     GROUP BY status`,
    [companyId, scope.assignedTo ?? null, scope.createdBy ?? null],
  );
  return toCounts(SAMPLE_STATUSES, rows);
}

/** D-33: rol bo'yicha dashboard statistikasi (R-FE-24). */
export async function getDashboard(
  companyId: string,
  user: { id: string; role: Role },
): Promise<DashboardDto> {
  switch (user.role) {
    case 'chemist': {
      const counts = await samplesByStatus(companyId, { assignedTo: user.id });
      return { view: 'chemist', samplesByStatus: counts, totalSamples: sum(counts) };
    }
    case 'kontrolyor': {
      const counts = await samplesByStatus(companyId, { createdBy: user.id });
      return { view: 'inspector', samplesByStatus: counts, totalSamples: sum(counts) };
    }
    case 'director': {
      const counts = await samplesByStatus(companyId, {});
      const { rows } = await query<{ status: string; count: string }>(
        `SELECT status::text AS status, count(*) AS count
         FROM protocols
         WHERE company_id = $1 AND status <> 'finalized'
         GROUP BY status`,
        [companyId],
      );
      const open = toCounts(OPEN_PROTOCOL_STATUSES, rows);
      return {
        view: 'director',
        samplesByStatus: counts,
        totalSamples: sum(counts),
        openProtocolsByStatus: open,
        openProtocolsTotal: sum(open),
      };
    }
    default: {
      // lab_head va admin (D-33: admin — LabHead dashboardi)
      const counts = await samplesByStatus(companyId, {});
      const { rows } = await query<{ count: string }>(
        `SELECT count(*) AS count FROM protocols WHERE company_id = $1 AND status = 'submitted'`,
        [companyId],
      );
      return {
        view: 'lab_head',
        samplesByStatus: counts,
        totalSamples: sum(counts),
        pendingAssignment: counts.pending_assignment,
        awaitingApproval: Number(rows[0]?.count ?? 0),
      };
    }
  }
}
