import { query } from '../../config/database.js';
import { NotFoundError } from '../../utils/errors.js';
import type { Role } from '../auth/auth.types.js';
import { getSampleById } from '../samples/samples.service.js';

/**
 * P18 (D-189; Addendum §3 "Audit va Tarix", F): bitta tarix ko'rinishi — reaktiv sarfi (P17), AI maydon
 * o'zgarishlari (AI qiymati → yakuniy), protokol rad etish sabablari va tasdiqlashlar vaqt tartibida.
 * Faqat o'qiydi; manbalar — mavjud jadvallar (yangi "tarix" jadvali yo'q, takrorlanish yo'q).
 */

export type HistoryEntity = 'sample' | 'reagent' | 'nd';

export type HistoryItemType =
  | 'sample_event'
  | 'protocol_signed'
  | 'protocol_rejected'
  | 'consumption'
  | 'consumption_reviewed'
  | 'ai_review'
  | 'reagent_transaction'
  | 'reagent_approval'
  | 'nd_status'
  | 'nd_ai_extract';

export interface HistoryItemDto {
  id: string;
  type: HistoryItemType;
  at: string;
  actorId: string | null;
  actorName: string | null;
  data: Record<string, unknown>;
}

interface RawItem {
  id: string;
  type: HistoryItemType;
  at: Date;
  actor_id: string | null;
  actor_name: string | null;
  data: Record<string, unknown>;
}

const toDto = (r: RawItem): HistoryItemDto => ({
  id: r.id,
  type: r.type,
  at: new Date(r.at).toISOString(),
  actorId: r.actor_id,
  actorName: r.actor_name,
  data: r.data ?? {},
});

/** AI review'lari — bitta ekstraksiya (yoki ND tasdig'i) bitta voqea: o'zgargan va qabul qilingan maydonlar. */
const AI_REVIEWS_SQL = `
  SELECT ('ai:' || COALESCE(r.extraction_id::text, r.entity_id::text) || ':' || r.reviewed_at::text) AS id,
         'ai_review' AS type, r.reviewed_at AS at, r.reviewed_by AS actor_id, u.full_name AS actor_name,
         jsonb_build_object(
           'extractionId', r.extraction_id,
           'changed', COALESCE(jsonb_agg(jsonb_build_object('field', r.field, 'aiValue', r.ai_value,
                        'finalValue', r.final_value, 'confidence', r.confidence) ORDER BY r.field)
                        FILTER (WHERE r.changed), '[]'::jsonb),
           'accepted', COALESCE(jsonb_agg(r.field ORDER BY r.field) FILTER (WHERE NOT r.changed), '[]'::jsonb)
         ) AS data
    FROM ai_field_reviews r LEFT JOIN users u ON u.id = r.reviewed_by
   WHERE r.company_id = $1 AND r.entity_type = $2 AND r.entity_id = $3
   GROUP BY r.extraction_id, r.entity_id, r.reviewed_at, r.reviewed_by, u.full_name`;

async function sampleHistory(companyId: string, sampleId: string): Promise<RawItem[]> {
  const { rows } = await query<RawItem>(
    `WITH prot AS (SELECT id, protocol_role FROM protocols WHERE sample_id = $3 AND company_id = $1)
     SELECT ('t:' || t.id) AS id, 'sample_event' AS type, t.created_at AS at, t.user_id AS actor_id,
            u.full_name AS actor_name,
            jsonb_build_object('event', t.event_type, 'from', t.from_status, 'to', t.to_status,
                               'reason', t.reason) AS data
       FROM sample_tracking t LEFT JOIN users u ON u.id = t.user_id
      WHERE t.sample_id = $3 AND t.company_id = $1
        AND t.event_type NOT IN ('rejected')
     UNION ALL
     SELECT ('s:' || ps.id), 'protocol_signed', ps.signed_at, ps.user_id, u.full_name,
            jsonb_build_object('protocolId', ps.protocol_id, 'action', ps.action, 'role', ps.role,
                               'protocolRole', prot.protocol_role)
       FROM protocol_signatures ps JOIN prot ON prot.id = ps.protocol_id
       LEFT JOIN users u ON u.id = ps.user_id
      WHERE ps.company_id = $1 AND ps.action <> 'rejected'
     UNION ALL
     SELECT ('r:' || pr.id), 'protocol_rejected', pr.rejected_at, pr.rejected_by, u.full_name,
            jsonb_build_object('protocolId', pr.protocol_id, 'reason', pr.reason,
                               'protocolRole', prot.protocol_role)
       FROM protocol_rejections pr JOIN prot ON prot.id = pr.protocol_id
       LEFT JOIN users u ON u.id = pr.rejected_by
      WHERE pr.company_id = $1
     UNION ALL
     SELECT ('c:' || c.id), 'consumption', c.created_at, c.created_by, u.full_name,
            jsonb_build_object('protocolId', c.protocol_id, 'reagentItemId', c.reagent_item_id,
                               'reagentName', i.name, 'unit', c.unit, 'required', c.required_qty,
                               'consumed', c.consumed_qty, 'shortfall', c.shortfall_qty, 'status', c.status)
       FROM reagent_consumptions c JOIN prot ON prot.id = c.protocol_id
       JOIN reagent_items i ON i.id = c.reagent_item_id
       LEFT JOIN users u ON u.id = c.created_by
      WHERE c.company_id = $1
     UNION ALL
     SELECT ('cr:' || c.id), 'consumption_reviewed', c.reviewed_at, c.reviewed_by, u.full_name,
            jsonb_build_object('protocolId', c.protocol_id, 'reagentName', i.name, 'unit', c.unit,
                               'consumed', c.consumed_qty, 'status', c.status, 'reason', c.correction_reason)
       FROM reagent_consumptions c JOIN prot ON prot.id = c.protocol_id
       JOIN reagent_items i ON i.id = c.reagent_item_id
       LEFT JOIN users u ON u.id = c.reviewed_by
      WHERE c.company_id = $1 AND c.reviewed_at IS NOT NULL
     UNION ALL
     ${AI_REVIEWS_SQL}`,
    // $1 kompaniya, $2 entity_type (AI review qismi), $3 namuna
    [companyId, 'sample', sampleId],
  );
  return rows;
}

async function reagentHistory(companyId: string, reagentId: string): Promise<RawItem[]> {
  const { rows } = await query<RawItem>(
    `SELECT ('tx:' || t.id) AS id, 'reagent_transaction' AS type, t.created_at AS at, t.user_id AS actor_id,
            u.full_name AS actor_name,
            jsonb_build_object('kind', t.type, 'quantity', t.quantity, 'before', t.quantity_before,
                               'after', t.quantity_after, 'note', t.note, 'protocolId', t.protocol_id) AS data
       FROM reagent_transactions t LEFT JOIN users u ON u.id = t.user_id
      WHERE t.reagent_id = $3 AND t.company_id = $1
     UNION ALL
     SELECT ('cl:' || l.id), 'consumption', l.created_at, c.created_by, u.full_name,
            jsonb_build_object('protocolId', c.protocol_id, 'quantity', l.quantity, 'status', c.status,
                               'substanceName', s.substance_name, 'sampleId', s.id)
       FROM reagent_consumption_lots l
       JOIN reagent_consumptions c ON c.id = l.consumption_id
       JOIN protocols p ON p.id = c.protocol_id
       JOIN samples s ON s.id = p.sample_id
       LEFT JOIN users u ON u.id = c.created_by
      WHERE l.reagent_id = $3 AND l.company_id = $1
     UNION ALL
     SELECT ('ap:' || r.id), 'reagent_approval', r.approved_at, r.approved_by, u.full_name,
            jsonb_build_object('status', r.approval_status, 'reason', r.rejection_reason)
       FROM reagents r LEFT JOIN users u ON u.id = r.approved_by
      WHERE r.id = $3 AND r.company_id = $1 AND r.approved_at IS NOT NULL
     UNION ALL
     ${AI_REVIEWS_SQL}`,
    [companyId, 'reagent', reagentId],
  );
  return rows;
}

async function ndHistory(companyId: string, ndId: string): Promise<RawItem[]> {
  const { rows } = await query<RawItem>(
    `SELECT ('a:' || a.id) AS id,
            (CASE WHEN a.action = 'ai_extract' THEN 'nd_ai_extract' ELSE 'nd_status' END) AS type,
            a.created_at AS at, a.user_id AS actor_id, u.full_name AS actor_name,
            jsonb_build_object('action', a.action, 'old', a.old_values, 'new', a.new_values) AS data
       FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.company_id = $1 AND a.table_name = 'normative_documents' AND a.record_id = $3::uuid
        AND a.action IN ('create', 'status_change', 'ai_extract')
     UNION ALL
     ${AI_REVIEWS_SQL}`,
    [companyId, 'nd', ndId],
  );
  return rows;
}

export async function getHistory(
  companyId: string,
  user: { id: string; role: Role; companyId: string | null },
  entity: HistoryEntity,
  id: string,
): Promise<HistoryItemDto[]> {
  let rows: RawItem[];
  if (entity === 'sample') {
    // Namuna ko'rinish qoidalari (kimyogar — biriktirilgan, kontrolyor — o'zi yaratgan) — 404
    await getSampleById(companyId, user, id);
    rows = await sampleHistory(companyId, id);
  } else if (entity === 'reagent') {
    const r = await query(`SELECT 1 FROM reagents WHERE id = $1 AND company_id = $2`, [
      id,
      companyId,
    ]);
    if (!r.rows.length) throw new NotFoundError('Reaktiv topilmadi');
    rows = await reagentHistory(companyId, id);
  } else {
    const r = await query(`SELECT 1 FROM normative_documents WHERE id = $1 AND company_id = $2`, [
      id,
      companyId,
    ]);
    if (!r.rows.length) throw new NotFoundError('Normativ hujjat (ND) topilmadi');
    rows = await ndHistory(companyId, id);
  }
  return rows
    .map(toDto)
    .sort((a, b) => (a.at === b.at ? a.id.localeCompare(b.id) : a.at < b.at ? -1 : 1));
}
