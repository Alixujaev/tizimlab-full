-- 014_analytics.sql: P13 xodimlar analitikasi uchun indekslar va sof muddat funksiyasi
-- DECISIONS.md D-159..D-165. Faqat qo'shimcha: mavjud jadvallar o'zgarmaydi.

CREATE INDEX IF NOT EXISTS idx_sample_tracking_company_event_time
  ON sample_tracking (company_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_sample_tracking_sample_event_time
  ON sample_tracking (sample_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_sample_tracking_user_time
  ON sample_tracking (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_protocol_signatures_company_action_time
  ON protocol_signatures (company_id, action, signed_at);
CREATE INDEX IF NOT EXISTS idx_protocol_signatures_protocol_action_time
  ON protocol_signatures (protocol_id, action, signed_at);
CREATE INDEX IF NOT EXISTS idx_protocol_signatures_user_time
  ON protocol_signatures (user_id, signed_at);
CREATE INDEX IF NOT EXISTS idx_samples_company_assignee_status
  ON samples (company_id, assigned_to, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_samples_company_created
  ON samples (company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stability_cp_assignee_status
  ON stability_checkpoints (assigned_to, status);

-- D-162: namuna bo'yicha [p_start, p_end] oralig'idagi sof muddat (soat) — to'xtatilgan
-- (`stopped` → keyingi `resumed`, resumed bo'lmasa p_end gacha) oraliqlar chiqarib tashlanadi.
-- Boshlanish/tugash yo'q yoki teskari bo'lsa NULL.
CREATE OR REPLACE FUNCTION analytics_net_hours(p_sample uuid, p_start timestamptz, p_end timestamptz)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_start IS NULL OR p_end IS NULL OR p_end < p_start THEN NULL
    ELSE GREATEST(
      0,
      EXTRACT(EPOCH FROM (p_end - p_start)) - COALESCE((
        SELECT sum(EXTRACT(EPOCH FROM (
          LEAST(COALESCE(r.resumed_at, p_end), p_end) - GREATEST(s.created_at, p_start)
        )))
        FROM sample_tracking s
        LEFT JOIN LATERAL (
          SELECT min(t.created_at) AS resumed_at
          FROM sample_tracking t
          WHERE t.sample_id = s.sample_id
            AND t.event_type = 'resumed'
            AND t.created_at > s.created_at
        ) r ON true
        WHERE s.sample_id = p_sample
          AND s.event_type = 'stopped'
          AND s.created_at < p_end
          AND COALESCE(r.resumed_at, p_end) > p_start
      ), 0)
    ) / 3600.0
  END
$$;

-- D-163: o'chirilmagan namunalar + birinchi biriktirish / birinchi tasdiq vaqti (sample_tracking dan).
CREATE OR REPLACE VIEW analytics_samples AS
SELECT
  s.id,
  s.company_id,
  s.type,
  s.status,
  s.substance_name,
  s.lot_number,
  s.serial_number,
  s.analysis_end,
  s.created_by,
  s.assigned_to,
  s.assigned_at,
  s.created_at,
  s.updated_at,
  (SELECT min(t.created_at) FROM sample_tracking t
    WHERE t.sample_id = s.id AND t.event_type IN ('assigned', 'reassigned')) AS first_assigned,
  (SELECT min(t.created_at) FROM sample_tracking t
    WHERE t.sample_id = s.id AND t.event_type = 'approved') AS first_approved
FROM samples s
WHERE s.deleted_at IS NULL;

-- D-163: protokol qarorlari (approved/rejected). Qaror o'zidan oldingi oxirgi `submitted` imzosi
-- egasiga (submitter) yoziladi; `had_prior_reject` — shu protokolda avval rad etilganmi;
-- `reason` — shu rad etishning tracking sababi (in_process uchun protokolning oxirgi sababi).
CREATE OR REPLACE VIEW analytics_decisions AS
SELECT
  d.id,
  d.company_id,
  d.protocol_id,
  p.sample_id,
  s.created_by AS sample_created_by,
  d.user_id AS decider_id,
  d.action,
  d.signed_at,
  sub.user_id AS submitter_id,
  sub.signed_at AS submitted_at,
  EXISTS (
    SELECT 1 FROM protocol_signatures x
    WHERE x.protocol_id = d.protocol_id AND x.action = 'rejected' AND x.signed_at < d.signed_at
  ) AS had_prior_reject,
  CASE WHEN d.action = 'rejected' THEN COALESCE(
    (SELECT t.reason FROM sample_tracking t
      WHERE t.sample_id = p.sample_id
        AND t.event_type = 'rejected'
        AND t.metadata ->> 'protocolId' = p.id::text
        AND t.created_at <= d.signed_at
      ORDER BY t.created_at DESC
      LIMIT 1),
    p.rejection_reason
  ) END AS reason
FROM protocol_signatures d
JOIN protocols p ON p.id = d.protocol_id
JOIN samples s ON s.id = p.sample_id AND s.deleted_at IS NULL
LEFT JOIN LATERAL (
  SELECT ps.user_id, ps.signed_at
  FROM protocol_signatures ps
  WHERE ps.protocol_id = d.protocol_id AND ps.action = 'submitted' AND ps.signed_at <= d.signed_at
  ORDER BY ps.signed_at DESC
  LIMIT 1
) sub ON true
WHERE d.action IN ('approved', 'rejected');

-- Barcha imzolar (submitted/finalized ham) — faqat o'chirilmagan namunalar bo'yicha.
CREATE OR REPLACE VIEW analytics_signatures AS
SELECT ps.id, ps.company_id, ps.protocol_id, p.sample_id, ps.user_id, ps.action, ps.signed_at
FROM protocol_signatures ps
JOIN protocols p ON p.id = ps.protocol_id
JOIN samples s ON s.id = p.sample_id AND s.deleted_at IS NULL;
