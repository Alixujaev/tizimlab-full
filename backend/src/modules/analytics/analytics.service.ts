import { query } from '../../config/database.js';
import type { PaginatedResult } from '../../utils/pagination.js';
import { toOffset } from '../../utils/pagination.js';
import { AppError } from '../../utils/errors.js';
import type { Role } from '../auth/auth.types.js';
import type { SampleStatus, SampleType } from '../samples/samples.types.js';
import { analyticsCacheKey, cached } from './analytics.cache.js';
import { COMPANY_KPIS, hours, percent, ROLE_KPIS, type MetricDef } from './analytics.metrics.js';
import {
  addDays,
  ANALYTICS_TZ,
  fillBuckets,
  localDate,
  periodDto,
  resolvePeriod,
} from './analytics.period.js';
import type { MemberSamplesQuery, PeriodQuery, TeamQuery } from './analytics.schemas.js';
import { assertCanView, SCOPE_VISIBLE_ROLES } from './analytics.scope.js';
import type {
  ActivityItem,
  AnalyticsUserDto,
  KpiDto,
  LateSampleDto,
  MemberSampleDto,
  NamedCount,
  OverviewDto,
  ResolvedPeriod,
  TeamRowDto,
  UserAnalyticsDto,
  Viewer,
} from './analytics.types.js';

export class AnalyticsUserNotFoundError extends AppError {
  constructor() {
    super(404, 'USER_NOT_FOUND', 'Xodim topilmadi');
  }
}

/** Rad sabablari: top-N guruh, qolgani "other" ga (D-163). */
const TOP_REASONS = 8;
const LATE_LIST_LIMIT = 10;
const ACTIVITY_LIMIT = 10;
const DUE_SOON_DAYS = 14;
const OPEN_STATUSES: readonly SampleStatus[] = ['in_progress', 'stopped', 'submitted', 'rejected'];

type Metrics = Record<string, number | null>;

const num = (v: string | number | null | undefined): number => Number(v ?? 0);

// ---------------------------------------------------------------------------------------------
// Xodim ko'rsatkichlari — bitta agregat so'rov, istalgan sondagi xodim uchun (N+1 yo'q)
// ---------------------------------------------------------------------------------------------

interface MetricsRow {
  id: string;
  assigned: string;
  completed: string;
  in_progress: string;
  avg_completion_hours: string | null;
  created: string;
  created_approved: string;
  created_rejected: string;
  avg_intake_hours: string | null;
  rejected: string;
  approved_decisions: string;
  first_pass: string;
  resubmissions: string;
  reviewed_approved: string;
  reviewed_rejected: string;
  avg_review_hours: string | null;
  passports_uploaded: string;
  assigned_by_me: string;
  finalized: string;
  avg_finalize_hours: string | null;
  overdue_checkpoints: string;
}

async function computeMetrics(
  companyId: string,
  userIds: readonly string[],
  start: Date,
  end: Date,
): Promise<Map<string, Metrics>> {
  const result = new Map<string, Metrics>();
  if (!userIds.length) return result;
  const { rows } = await query<MetricsRow>(
    `WITH u AS (SELECT DISTINCT unnest($2::uuid[]) AS id),
     ls AS (SELECT * FROM analytics_samples WHERE company_id = $1),
     by_assignee AS (
       SELECT assigned_to AS user_id,
         count(*) FILTER (WHERE assigned_at >= $3 AND assigned_at < $4) AS assigned,
         count(*) FILTER (WHERE first_approved >= $3 AND first_approved < $4) AS completed,
         count(*) FILTER (WHERE status = ANY($6::sample_status[])) AS in_progress,
         avg(analytics_net_hours(id, assigned_at, first_approved))
           FILTER (WHERE first_approved >= $3 AND first_approved < $4) AS avg_completion_hours
       FROM ls WHERE assigned_to IS NOT NULL GROUP BY assigned_to
     ),
     by_creator AS (
       SELECT created_by AS user_id,
         count(*) FILTER (WHERE created_at >= $3 AND created_at < $4) AS created,
         count(*) FILTER (WHERE first_approved >= $3 AND first_approved < $4) AS created_approved,
         count(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM sample_tracking t
           WHERE t.sample_id = ls.id AND t.event_type = 'rejected'
             AND t.created_at >= $3 AND t.created_at < $4)) AS created_rejected,
         avg(analytics_net_hours(id, created_at, first_assigned))
           FILTER (WHERE first_assigned >= $3 AND first_assigned < $4) AS avg_intake_hours
       FROM ls GROUP BY created_by
     ),
     dec AS (
       SELECT * FROM analytics_decisions
       WHERE company_id = $1 AND signed_at >= $3 AND signed_at < $4
     ),
     by_submitter AS (
       SELECT submitter_id AS user_id,
         count(*) FILTER (WHERE action = 'rejected') AS rejected,
         count(*) FILTER (WHERE action = 'approved') AS approved_decisions,
         count(*) FILTER (WHERE action = 'approved' AND NOT had_prior_reject) AS first_pass
       FROM dec WHERE submitter_id IS NOT NULL GROUP BY submitter_id
     ),
     by_decider AS (
       SELECT decider_id AS user_id,
         count(*) FILTER (WHERE action = 'approved') AS reviewed_approved,
         count(*) FILTER (WHERE action = 'rejected') AS reviewed_rejected,
         avg(EXTRACT(EPOCH FROM (signed_at - submitted_at)) / 3600.0) AS avg_review_hours
       FROM dec GROUP BY decider_id
     ),
     sig AS (
       SELECT s.user_id,
         count(*) FILTER (WHERE s.action = 'submitted' AND EXISTS (
           SELECT 1 FROM protocol_signatures x
           WHERE x.protocol_id = s.protocol_id AND x.action = 'rejected'
             AND x.signed_at < s.signed_at)) AS resubmissions,
         count(*) FILTER (WHERE s.action = 'finalized') AS finalized,
         avg(EXTRACT(EPOCH FROM (s.signed_at - (
           SELECT max(a.signed_at) FROM protocol_signatures a
           WHERE a.protocol_id = s.protocol_id AND a.action = 'approved'
             AND a.signed_at <= s.signed_at))) / 3600.0)
           FILTER (WHERE s.action = 'finalized') AS avg_finalize_hours
       FROM analytics_signatures s
       WHERE s.company_id = $1 AND s.signed_at >= $3 AND s.signed_at < $4
         AND s.action IN ('submitted', 'finalized')
       GROUP BY s.user_id
     ),
     trk AS (
       SELECT t.user_id,
         count(*) FILTER (WHERE t.event_type = 'passport_uploaded') AS passports_uploaded,
         count(*) FILTER (WHERE t.event_type IN ('assigned', 'reassigned')) AS assigned_by_me
       FROM sample_tracking t
       JOIN samples s ON s.id = t.sample_id AND s.deleted_at IS NULL
       WHERE t.company_id = $1 AND t.created_at >= $3 AND t.created_at < $4
       GROUP BY t.user_id
     ),
     cp AS (
       SELECT c.assigned_to AS user_id, count(*) AS overdue_checkpoints
       FROM stability_checkpoints c
       WHERE c.company_id = $1 AND c.status <> 'completed'
         AND (c.status = 'overdue' OR c.due_date < (now() AT TIME ZONE $5)::date)
       GROUP BY c.assigned_to
     )
     SELECT u.id,
       COALESCE(a.assigned, 0) AS assigned,
       COALESCE(a.completed, 0) AS completed,
       COALESCE(a.in_progress, 0) AS in_progress,
       a.avg_completion_hours,
       COALESCE(c.created, 0) AS created,
       COALESCE(c.created_approved, 0) AS created_approved,
       COALESCE(c.created_rejected, 0) AS created_rejected,
       c.avg_intake_hours,
       COALESCE(bs.rejected, 0) AS rejected,
       COALESCE(bs.approved_decisions, 0) AS approved_decisions,
       COALESCE(bs.first_pass, 0) AS first_pass,
       COALESCE(sg.resubmissions, 0) AS resubmissions,
       COALESCE(bd.reviewed_approved, 0) AS reviewed_approved,
       COALESCE(bd.reviewed_rejected, 0) AS reviewed_rejected,
       bd.avg_review_hours,
       COALESCE(tr.passports_uploaded, 0) AS passports_uploaded,
       COALESCE(tr.assigned_by_me, 0) AS assigned_by_me,
       COALESCE(sg.finalized, 0) AS finalized,
       sg.avg_finalize_hours,
       COALESCE(cp.overdue_checkpoints, 0) AS overdue_checkpoints
     FROM u
     LEFT JOIN by_assignee a ON a.user_id = u.id
     LEFT JOIN by_creator c ON c.user_id = u.id
     LEFT JOIN by_submitter bs ON bs.user_id = u.id
     LEFT JOIN by_decider bd ON bd.user_id = u.id
     LEFT JOIN sig sg ON sg.user_id = u.id
     LEFT JOIN trk tr ON tr.user_id = u.id
     LEFT JOIN cp ON cp.user_id = u.id`,
    [companyId, userIds, start, end, ANALYTICS_TZ, OPEN_STATUSES],
  );
  for (const r of rows) {
    const rejected = num(r.rejected);
    const approvedDecisions = num(r.approved_decisions);
    result.set(r.id, {
      assigned: num(r.assigned),
      completed: num(r.completed),
      inProgress: num(r.in_progress),
      rejected,
      approvedDecisions,
      rejectionRate: percent(rejected, rejected + approvedDecisions),
      firstPassRate: percent(num(r.first_pass), approvedDecisions),
      resubmissions: num(r.resubmissions),
      avgCompletionHours: hours(r.avg_completion_hours),
      overdueCheckpoints: num(r.overdue_checkpoints),
      created: num(r.created),
      passportsUploaded: num(r.passports_uploaded),
      createdApproved: num(r.created_approved),
      createdRejected: num(r.created_rejected),
      avgIntakeHours: hours(r.avg_intake_hours),
      reviewedApproved: num(r.reviewed_approved),
      reviewedRejected: num(r.reviewed_rejected),
      avgReviewHours: hours(r.avg_review_hours),
      assignedByMe: num(r.assigned_by_me),
      finalized: num(r.finalized),
      avgFinalizeHours: hours(r.avg_finalize_hours),
    });
  }
  return result;
}

/** lab_head navbati (snapshot, butun kompaniya). */
async function companyQueue(
  companyId: string,
): Promise<{ queueApprovals: number; queueAssignments: number }> {
  const { rows } = await query<{ approvals: string; assignments: string }>(
    `SELECT
       (SELECT count(*) FROM protocols p
          JOIN samples s ON s.id = p.sample_id AND s.deleted_at IS NULL
         WHERE p.company_id = $1 AND p.status = 'submitted') AS approvals,
       (SELECT count(*) FROM samples
         WHERE company_id = $1 AND deleted_at IS NULL AND status = 'pending_assignment') AS assignments`,
    [companyId],
  );
  return {
    queueApprovals: num(rows[0]?.approvals),
    queueAssignments: num(rows[0]?.assignments),
  };
}

function toKpis(defs: readonly MetricDef[], current: Metrics, previous: Metrics): KpiDto[] {
  return defs.map((d) => ({
    key: d.key,
    unit: d.unit,
    value: current[d.key] ?? null,
    previous: d.snapshot ? null : (previous[d.key] ?? null),
    snapshot: Boolean(d.snapshot),
  }));
}

// ---------------------------------------------------------------------------------------------
// Rad sabablari (D-163): normallashtirilgan matn bo'yicha guruh, bo'sh → "unspecified"
// ---------------------------------------------------------------------------------------------

function groupReasons(
  rows: { key: string | null; label: string | null; n: string }[],
): NamedCount[] {
  const items: NamedCount[] = rows.map((r) => ({
    key: r.key ?? 'unspecified',
    label: r.key ? r.label : null,
    value: num(r.n),
  }));
  // 'unspecified' bir nechta qatorda kelmaydi (SQL'da NULL bitta guruh)
  items.sort((a, b) => b.value - a.value || a.key.localeCompare(b.key));
  if (items.length <= TOP_REASONS) return items;
  const top = items.slice(0, TOP_REASONS);
  const rest = items.slice(TOP_REASONS).reduce((s, r) => s + r.value, 0);
  return [...top, { key: 'other', label: null, value: rest }];
}

type ReasonMode = 'company' | 'submitter' | 'creator' | 'decider';

async function rejectionReasons(
  companyId: string,
  p: ResolvedPeriod,
  mode: ReasonMode,
  userId: string | null,
): Promise<NamedCount[]> {
  const { rows } = await query<{ key: string | null; label: string | null; n: string }>(
    `SELECT NULLIF(lower(btrim(regexp_replace(COALESCE(reason, ''), '\\s+', ' ', 'g'))), '') AS key,
            -- yorliq: guruhdagi eng birinchi (xronologik) matn, bo'shliqlari ixchamlangan
            (array_agg(regexp_replace(btrim(reason), '\\s+', ' ', 'g') ORDER BY signed_at))[1] AS label,
            count(*) AS n
     FROM analytics_decisions
     WHERE company_id = $1 AND action = 'rejected' AND signed_at >= $2 AND signed_at < $3
       AND ($4 = 'company'
         OR ($4 = 'submitter' AND submitter_id = $5::uuid)
         OR ($4 = 'creator' AND sample_created_by = $5::uuid)
         OR ($4 = 'decider' AND decider_id = $5::uuid))
     GROUP BY 1`,
    [companyId, p.start, p.end, mode, userId],
  );
  return groupReasons(rows);
}

// ---------------------------------------------------------------------------------------------
// GET /analytics/users/:id va /analytics/me
// ---------------------------------------------------------------------------------------------

async function loadTarget(companyId: string, id: string): Promise<AnalyticsUserDto> {
  const { rows } = await query<{ id: string; full_name: string; role: Role; is_active: boolean }>(
    `SELECT id, full_name, role, is_active FROM users WHERE id = $1 AND company_id = $2`,
    [id, companyId],
  );
  const row = rows[0];
  if (!row) throw new AnalyticsUserNotFoundError();
  return { id: row.id, fullName: row.full_name, role: row.role, isActive: row.is_active };
}

/** Rolga mos trend manbasi (mahalliy kunlar bo'yicha soni). */
const TREND_KEY: Partial<Record<Role, string>> = {
  chemist: 'completed',
  kontrolyor: 'created',
  lab_head: 'reviewed',
  director: 'finalized',
};

async function userTrend(
  companyId: string,
  user: AnalyticsUserDto,
  p: ResolvedPeriod,
): Promise<{ day: string; value: number }[]> {
  const mode = TREND_KEY[user.role];
  if (!mode) return [];
  const { rows } = await query<{ day: string; n: string }>(
    `SELECT day, count(*) AS n FROM (
       SELECT (first_approved AT TIME ZONE $5)::date::text AS day
         FROM analytics_samples
        WHERE $4 = 'completed' AND company_id = $1 AND assigned_to = $6
          AND first_approved >= $2 AND first_approved < $3
       UNION ALL
       SELECT (created_at AT TIME ZONE $5)::date::text
         FROM analytics_samples
        WHERE $4 = 'created' AND company_id = $1 AND created_by = $6
          AND created_at >= $2 AND created_at < $3
       UNION ALL
       SELECT (signed_at AT TIME ZONE $5)::date::text
         FROM analytics_decisions
        WHERE $4 = 'reviewed' AND company_id = $1 AND decider_id = $6
          AND signed_at >= $2 AND signed_at < $3
       UNION ALL
       SELECT (signed_at AT TIME ZONE $5)::date::text
         FROM analytics_signatures
        WHERE $4 = 'finalized' AND company_id = $1 AND user_id = $6 AND action = 'finalized'
          AND signed_at >= $2 AND signed_at < $3
     ) e GROUP BY day`,
    [companyId, p.start, p.end, mode, ANALYTICS_TZ, user.id],
  );
  return rows.map((r) => ({ day: r.day, value: num(r.n) }));
}

async function userActivity(companyId: string, userId: string): Promise<ActivityItem[]> {
  const { rows } = await query<{
    kind: 'tracking' | 'signature';
    action: string;
    at: Date;
    sample_id: string | null;
    substance_name: string | null;
    reason: string | null;
  }>(
    `SELECT * FROM (
       SELECT 'tracking' AS kind, t.event_type AS action, t.created_at AS at,
              t.sample_id, s.substance_name, t.reason
         FROM sample_tracking t
         JOIN samples s ON s.id = t.sample_id AND s.deleted_at IS NULL
        WHERE t.company_id = $1 AND t.user_id = $2
          -- submitted/approved/rejected imzolarda ham bor — takrorlanmasin
          AND t.event_type NOT IN ('submitted', 'approved', 'rejected')
       UNION ALL
       SELECT 'signature', a.action, a.signed_at, a.sample_id, s.substance_name, NULL
         FROM analytics_signatures a
         JOIN samples s ON s.id = a.sample_id
        WHERE a.company_id = $1 AND a.user_id = $2
     ) x
     ORDER BY at DESC
     LIMIT $3`,
    [companyId, userId, ACTIVITY_LIMIT],
  );
  return rows.map((r) => ({
    kind: r.kind,
    action: r.action,
    at: r.at.toISOString(),
    sampleId: r.sample_id,
    substanceName: r.substance_name,
    reason: r.reason,
  }));
}

function outcomesFor(role: Role, m: Metrics): NamedCount[] {
  const item = (key: string, value: number | null): NamedCount => ({
    key,
    label: null,
    value: value ?? 0,
  });
  switch (role) {
    case 'chemist':
      return [
        item('approved', m.approvedDecisions ?? 0),
        item('rejected', m.rejected ?? 0),
        item('inProgress', m.inProgress ?? 0),
      ];
    case 'kontrolyor':
      return [item('approved', m.createdApproved ?? 0), item('rejected', m.createdRejected ?? 0)];
    case 'lab_head':
      return [item('approved', m.reviewedApproved ?? 0), item('rejected', m.reviewedRejected ?? 0)];
    case 'director':
      return [item('finalized', m.finalized ?? 0)];
    default:
      return [];
  }
}

const REASON_MODE: Partial<Record<Role, ReasonMode>> = {
  chemist: 'submitter',
  kontrolyor: 'creator',
  lab_head: 'decider',
};

export async function getUserAnalytics(
  viewer: Viewer,
  targetId: string,
  q: PeriodQuery,
): Promise<UserAnalyticsDto> {
  const p = resolvePeriod(q);
  const target = await loadTarget(viewer.companyId, targetId);
  assertCanView(viewer, target);
  const key = analyticsCacheKey(viewer.companyId, viewer.userId, 'user', [targetId, p.from, p.to]);
  return cached(key, async () => {
    const [cur, prev, trendRows, activity, queue] = await Promise.all([
      computeMetrics(viewer.companyId, [target.id], p.start, p.end),
      computeMetrics(viewer.companyId, [target.id], p.prevStart, p.prevEnd),
      userTrend(viewer.companyId, target, p),
      userActivity(viewer.companyId, target.id),
      target.role === 'lab_head' ? companyQueue(viewer.companyId) : Promise.resolve(null),
    ]);
    const current: Metrics = { ...cur.get(target.id), ...queue };
    const previous: Metrics = prev.get(target.id) ?? {};
    const mode = REASON_MODE[target.role];
    return {
      user: target,
      period: periodDto(p),
      kpis: toKpis(ROLE_KPIS[target.role] ?? [], current, previous),
      trend: { key: TREND_KEY[target.role] ?? 'none', points: fillBuckets(p, trendRows) },
      outcomes: outcomesFor(target.role, current),
      reasons: mode ? await rejectionReasons(viewer.companyId, p, mode, target.id) : [],
      activity,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// GET /analytics/team
// ---------------------------------------------------------------------------------------------

export async function getTeam(viewer: Viewer, q: TeamQuery): Promise<PaginatedResult<TeamRowDto>> {
  const p = resolvePeriod(q);
  const key = analyticsCacheKey(viewer.companyId, viewer.userId, 'team', [
    viewer.scope,
    p.from,
    p.to,
    q.role ?? null,
  ]);
  const all = await cached(key, async () => {
    const { rows: users } = await query<{
      id: string;
      full_name: string;
      role: Role;
      is_active: boolean;
    }>(
      `SELECT id, full_name, role, is_active FROM users
       WHERE company_id = $1
         AND (id = $2 OR role = ANY($3::user_role[]))
         AND ($4::user_role IS NULL OR role = $4::user_role)`,
      [viewer.companyId, viewer.userId, SCOPE_VISIBLE_ROLES[viewer.scope], q.role ?? null],
    );
    const metrics = await computeMetrics(
      viewer.companyId,
      users.map((u) => u.id),
      p.start,
      p.end,
    );
    return users.map<TeamRowDto>((u) => {
      const m = metrics.get(u.id) ?? {};
      const defs = ROLE_KPIS[u.role] ?? [];
      return {
        id: u.id,
        fullName: u.full_name,
        role: u.role,
        isActive: u.is_active,
        metrics: Object.fromEntries(defs.map((d) => [d.key, m[d.key] ?? null])),
        openSamples: u.role === 'chemist' ? (m.inProgress ?? 0) : 0,
      };
    });
  });

  const factor = q.order === 'asc' ? 1 : -1;
  const value = (r: TeamRowDto): string | number | null =>
    q.sort === 'fullName'
      ? r.fullName
      : q.sort === 'role'
        ? r.role
        : q.sort === 'openSamples'
          ? r.openSamples
          : (r.metrics[q.sort] ?? null);
  const sorted = [...all].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    // null ("ma'lumot yo'q") har doim oxirida
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
    const c =
      typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb));
    return factor * c || a.fullName.localeCompare(b.fullName);
  });
  const offset = toOffset(q);
  return {
    items: sorted.slice(offset, offset + q.limit),
    meta: { page: q.page, limit: q.limit, total: sorted.length },
  };
}

// ---------------------------------------------------------------------------------------------
// GET /analytics/users/:id/samples
// ---------------------------------------------------------------------------------------------

export async function getMemberSamples(
  viewer: Viewer,
  targetId: string,
  q: MemberSamplesQuery,
): Promise<PaginatedResult<MemberSampleDto>> {
  const p = resolvePeriod(q);
  const target = await loadTarget(viewer.companyId, targetId);
  assertCanView(viewer, target);
  const key = analyticsCacheKey(viewer.companyId, viewer.userId, 'samples', [
    targetId,
    p.from,
    p.to,
    q.status ?? null,
    q.result ?? null,
    q.page,
    q.limit,
  ]);
  return cached(key, async () => {
    const { rows } = await query<{
      id: string;
      substance_name: string;
      type: SampleType;
      lot_number: string | null;
      serial_number: string | null;
      status: SampleStatus;
      assigned_at: Date | null;
      first_approved: Date | null;
      analysis_end: string | null;
      duration_hours: string | null;
      is_late: boolean;
      last_reason: string | null;
      total: string;
    }>(
      `SELECT a.id, a.substance_name, a.type, a.lot_number, a.serial_number, a.status,
              a.assigned_at, a.first_approved, a.analysis_end::text AS analysis_end,
              analytics_net_hours(a.id, a.assigned_at, a.first_approved) AS duration_hours,
              (a.status <> 'approved' AND a.analysis_end < (now() AT TIME ZONE $9)::date) AS is_late,
              (SELECT t.reason FROM sample_tracking t
                WHERE t.sample_id = a.id AND t.event_type = 'rejected'
                ORDER BY t.created_at DESC LIMIT 1) AS last_reason,
              count(*) OVER () AS total
       FROM analytics_samples a
       WHERE a.company_id = $1
         AND (a.assigned_to = $2 OR a.created_by = $2
              OR EXISTS (SELECT 1 FROM sample_tracking t WHERE t.sample_id = a.id AND t.user_id = $2)
              OR EXISTS (SELECT 1 FROM analytics_signatures g WHERE g.sample_id = a.id AND g.user_id = $2))
         AND ((a.created_at >= $3 AND a.created_at < $4)
              OR EXISTS (SELECT 1 FROM sample_tracking t
                          WHERE t.sample_id = a.id AND t.created_at >= $3 AND t.created_at < $4)
              OR EXISTS (SELECT 1 FROM analytics_signatures g
                          WHERE g.sample_id = a.id AND g.signed_at >= $3 AND g.signed_at < $4))
         AND ($5::sample_status IS NULL OR a.status = $5::sample_status)
         AND ($6::text IS NULL OR $6::text = CASE a.status
               WHEN 'approved' THEN 'approved' WHEN 'rejected' THEN 'rejected' ELSE 'open' END)
       ORDER BY COALESCE(a.first_approved, a.updated_at) DESC, a.id
       LIMIT $7 OFFSET $8`,
      [
        viewer.companyId,
        target.id,
        p.start,
        p.end,
        q.status ?? null,
        q.result ?? null,
        q.limit,
        toOffset(q),
        ANALYTICS_TZ,
      ],
    );
    return {
      items: rows.map<MemberSampleDto>((r) => ({
        id: r.id,
        substanceName: r.substance_name,
        type: r.type,
        lotNumber: r.lot_number,
        serialNumber: r.serial_number,
        status: r.status,
        result:
          r.status === 'approved' ? 'approved' : r.status === 'rejected' ? 'rejected' : 'open',
        assignedAt: r.assigned_at?.toISOString() ?? null,
        approvedAt: r.first_approved?.toISOString() ?? null,
        durationHours: hours(r.duration_hours),
        analysisEnd: r.analysis_end,
        isLate: r.is_late,
        lastRejectionReason: r.last_reason,
      })),
      meta: { page: q.page, limit: q.limit, total: num(rows[0]?.total) },
    };
  });
}

// ---------------------------------------------------------------------------------------------
// GET /analytics/overview (kompaniya)
// ---------------------------------------------------------------------------------------------

async function companyMetrics(companyId: string, start: Date, end: Date): Promise<Metrics> {
  const { rows } = await query<{
    created: string;
    approved: string;
    avg_tat_hours: string | null;
    finalized: string;
    rejected: string;
    approved_decisions: string;
    first_pass: string;
  }>(
    `SELECT
       (SELECT count(*) FROM analytics_samples
         WHERE company_id = $1 AND created_at >= $2 AND created_at < $3) AS created,
       (SELECT count(*) FROM analytics_samples
         WHERE company_id = $1 AND first_approved >= $2 AND first_approved < $3) AS approved,
       (SELECT avg(analytics_net_hours(id, created_at, first_approved)) FROM analytics_samples
         WHERE company_id = $1 AND first_approved >= $2 AND first_approved < $3) AS avg_tat_hours,
       (SELECT count(*) FROM analytics_signatures
         WHERE company_id = $1 AND action = 'finalized' AND signed_at >= $2 AND signed_at < $3) AS finalized,
       d.rejected, d.approved_decisions, d.first_pass
     FROM (
       SELECT count(*) FILTER (WHERE action = 'rejected') AS rejected,
              count(*) FILTER (WHERE action = 'approved') AS approved_decisions,
              count(*) FILTER (WHERE action = 'approved' AND NOT had_prior_reject) AS first_pass
       FROM analytics_decisions
       WHERE company_id = $1 AND signed_at >= $2 AND signed_at < $3
     ) d`,
    [companyId, start, end],
  );
  const r = rows[0]!;
  const rejected = num(r.rejected);
  const approvedDecisions = num(r.approved_decisions);
  return {
    samplesCreated: num(r.created),
    samplesApproved: num(r.approved),
    protocolsFinalized: num(r.finalized),
    rejectionRate: percent(rejected, rejected + approvedDecisions),
    firstPassRate: percent(num(r.first_pass), approvedDecisions),
    avgTatHours: hours(r.avg_tat_hours),
  };
}

const FUNNEL_STAGES = ['created', 'assigned', 'inAnalysis', 'submitted', 'approved', 'finalized'];

export async function getOverview(viewer: Viewer, q: PeriodQuery): Promise<OverviewDto> {
  const p = resolvePeriod(q);
  const key = analyticsCacheKey(viewer.companyId, viewer.userId, 'overview', [p.from, p.to]);
  return cached(key, async () => {
    const c = viewer.companyId;
    const today = localDate(new Date());
    const [
      cur,
      prev,
      snapshot,
      trendRows,
      stageRows,
      byTypeRows,
      lateRows,
      workloadRows,
      temp,
      stab,
      reasons,
    ] = await Promise.all([
      companyMetrics(c, p.start, p.end),
      companyMetrics(c, p.prevStart, p.prevEnd),
      query<{ open: string; late: string }>(
        `SELECT count(*) FILTER (WHERE status <> 'approved') AS open,
                  count(*) FILTER (WHERE status <> 'approved' AND analysis_end < $2::date) AS late
           FROM analytics_samples WHERE company_id = $1`,
        [c, today],
      ),
      query<{ day: string; kind: 'created' | 'approved'; n: string }>(
        `SELECT (created_at AT TIME ZONE $4)::date::text AS day, 'created' AS kind, count(*) AS n
             FROM analytics_samples
            WHERE company_id = $1 AND created_at >= $2 AND created_at < $3 GROUP BY 1
           UNION ALL
           SELECT (first_approved AT TIME ZONE $4)::date::text, 'approved', count(*)
             FROM analytics_samples
            WHERE company_id = $1 AND first_approved >= $2 AND first_approved < $3 GROUP BY 1`,
        [c, p.start, p.end, ANALYTICS_TZ],
      ),
      // Voronka: har namuna erishgan eng yuqori bosqich (kumulyativ — monoton kamayadi)
      query<{ stage: number; n: string }>(
        `SELECT stage, count(*) AS n FROM (
             SELECT CASE
               WHEN EXISTS (SELECT 1 FROM protocols x WHERE x.sample_id = a.id AND x.status = 'finalized') THEN 5
               WHEN a.first_approved IS NOT NULL THEN 4
               WHEN EXISTS (SELECT 1 FROM sample_tracking t
                             WHERE t.sample_id = a.id AND t.event_type = 'submitted') THEN 3
               WHEN EXISTS (SELECT 1 FROM protocols x
                             WHERE x.sample_id = a.id AND x.file_path IS NOT NULL) THEN 2
               WHEN a.assigned_at IS NOT NULL OR a.first_assigned IS NOT NULL THEN 1
               ELSE 0 END AS stage
             FROM analytics_samples a
             WHERE a.company_id = $1 AND a.created_at >= $2 AND a.created_at < $3
           ) s GROUP BY stage`,
        [c, p.start, p.end],
      ),
      query<{ type: string; n: string }>(
        `SELECT type::text AS type, count(*) AS n FROM analytics_samples
           WHERE company_id = $1 AND created_at >= $2 AND created_at < $3
           GROUP BY type ORDER BY count(*) DESC, type`,
        [c, p.start, p.end],
      ),
      query<{
        id: string;
        substance_name: string;
        type: SampleType;
        status: SampleStatus;
        analysis_end: string;
        days_late: number;
        assigned_to: string | null;
        assignee_name: string | null;
      }>(
        `SELECT a.id, a.substance_name, a.type, a.status, a.analysis_end::text AS analysis_end,
                  ($2::date - a.analysis_end) AS days_late, a.assigned_to, u.full_name AS assignee_name
           FROM analytics_samples a
           LEFT JOIN users u ON u.id = a.assigned_to
           WHERE a.company_id = $1 AND a.status <> 'approved' AND a.analysis_end < $2::date
           ORDER BY a.analysis_end ASC, a.id
           LIMIT $3`,
        [c, today, LATE_LIST_LIMIT],
      ),
      query<{ id: string; full_name: string; open: string }>(
        `SELECT u.id, u.full_name, count(a.id) AS open
           FROM users u
           LEFT JOIN analytics_samples a
             ON a.assigned_to = u.id AND a.company_id = $1 AND a.status = ANY($2::sample_status[])
           WHERE u.company_id = $1 AND u.role = 'chemist' AND u.is_active
           GROUP BY u.id, u.full_name
           ORDER BY count(a.id) DESC, u.full_name`,
        [c, OPEN_STATUSES],
      ),
      query<{ unresolved: string; in_period: string }>(
        `SELECT count(*) FILTER (WHERE resolved_at IS NULL) AS unresolved,
                  count(*) FILTER (WHERE created_at >= $2 AND created_at < $3) AS in_period
           FROM temperature_alerts WHERE company_id = $1`,
        [c, p.start, p.end],
      ),
      query<{ active: string; overdue: string; due_soon: string }>(
        `SELECT
             (SELECT count(*) FROM stability_studies WHERE company_id = $1 AND status = 'active') AS active,
             (SELECT count(*) FROM stability_checkpoints
               WHERE company_id = $1 AND status <> 'completed'
                 AND (status = 'overdue' OR due_date < $2::date)) AS overdue,
             (SELECT count(*) FROM stability_checkpoints
               WHERE company_id = $1 AND status NOT IN ('completed', 'overdue')
                 AND due_date >= $2::date AND due_date <= $3::date) AS due_soon`,
        [c, today, addDays(today, DUE_SOON_DAYS)],
      ),
      rejectionReasons(c, p, 'company', null),
    ]);

    const current: Metrics = {
      ...cur,
      openSamples: num(snapshot.rows[0]?.open),
      lateSamples: num(snapshot.rows[0]?.late),
    };
    const byKind = (kind: 'created' | 'approved') =>
      fillBuckets(
        p,
        trendRows.rows.filter((r) => r.kind === kind).map((r) => ({ day: r.day, value: num(r.n) })),
      );
    const created = byKind('created');
    const approved = byKind('approved');
    const reached = (i: number) =>
      stageRows.rows.filter((r) => Number(r.stage) >= i).reduce((s, r) => s + num(r.n), 0);

    const late: LateSampleDto[] = lateRows.rows.map((r) => ({
      id: r.id,
      substanceName: r.substance_name,
      type: r.type,
      status: r.status,
      analysisEnd: r.analysis_end,
      daysLate: Number(r.days_late),
      assigneeId: r.assigned_to,
      assigneeName: r.assignee_name,
    }));

    return {
      period: periodDto(p),
      kpis: toKpis(COMPANY_KPIS, current, prev),
      trend: created.map((pt, i) => ({
        date: pt.date,
        created: pt.value,
        approved: approved[i]?.value ?? 0,
      })),
      funnel: FUNNEL_STAGES.map((key, i) => ({ key, label: null, value: reached(i) })),
      reasons,
      byType: byTypeRows.rows.map((r) => ({ key: r.type, label: null, value: num(r.n) })),
      lateSamples: late,
      workload: workloadRows.rows.map((r) => ({
        userId: r.id,
        fullName: r.full_name,
        open: num(r.open),
      })),
      temperature: {
        unresolvedAlerts: num(temp.rows[0]?.unresolved),
        alertsInPeriod: num(temp.rows[0]?.in_period),
      },
      stability: {
        activeStudies: num(stab.rows[0]?.active),
        overdueCheckpoints: num(stab.rows[0]?.overdue),
        dueSoonCheckpoints: num(stab.rows[0]?.due_soon),
      },
    };
  });
}
