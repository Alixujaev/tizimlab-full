-- 027_protocol_metadata.sql: protokol/peak fayllari va ND metadata'si, apparat bog'lanishi,
-- rad etish tarixi (TZ Addendum §3, DECISIONS.md D-184..D-186). Backfill: bilinmagani NULL qoladi.

-- 1) Protokol: apparat (P17 equipment) va tahlil sanasi. NULL apparat = "noma'lum" (oqim bloklanmaydi).
ALTER TABLE protocols
  ADD COLUMN equipment_id uuid NULL REFERENCES equipment(id) ON DELETE SET NULL,
  ADD COLUMN analysis_date date NULL;

-- Tahlil sanasi faqat D-173 snapshot'idan (yuborishda aniq yozilgan) — boshqa manbadan taxmin qilinmaydi
UPDATE protocols
   SET analysis_date = (temperature_snapshot->>'analysisDate')::date
 WHERE analysis_date IS NULL
   AND temperature_snapshot ? 'analysisDate'
   AND (temperature_snapshot->>'analysisDate') ~ '^\d{4}-\d{2}-\d{2}$';

CREATE INDEX idx_protocols_equipment ON protocols(company_id, equipment_id) WHERE equipment_id IS NOT NULL;
CREATE INDEX idx_protocols_company_status ON protocols(company_id, status, created_at DESC);
CREATE INDEX idx_protocols_analysis_date ON protocols(company_id, analysis_date);

-- 2) Protokol fayllari: tur + metadata. 'extra' — mavjud qo'shimcha fayllar (D-49), 'protocol' — asosiy
--    tahlil fayli nusxa-bog'i, 'peak' — HPLC/UV peak fayllari (yangi).
ALTER TABLE protocol_files
  ADD COLUMN kind varchar(10) NOT NULL DEFAULT 'extra' CHECK (kind IN ('protocol', 'peak', 'extra')),
  ADD COLUMN substance_name varchar(500) NULL,
  ADD COLUMN series varchar(100) NULL,
  ADD COLUMN analysis_date date NULL,
  ADD COLUMN chemist_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN equipment_id uuid NULL REFERENCES equipment(id) ON DELETE SET NULL;

CREATE INDEX idx_protocol_files_kind ON protocol_files(company_id, kind);
CREATE INDEX idx_protocol_files_equipment ON protocol_files(company_id, equipment_id) WHERE equipment_id IS NOT NULL;

-- Mavjud asosiy protokol fayllari `files` + `protocol_files(kind='protocol')` ga bog'lanadi (R2 obyekti o'sha).
-- Hech narsa ko'chirilmaydi/o'chirilmaydi: protocols.file_* ustunlari avvalgidek manba bo'lib qoladi.
WITH src AS (
  SELECT p.id AS protocol_id, p.company_id, p.sample_id, p.file_path, p.file_name, p.file_mime,
         p.file_size, p.created_by, p.analysis_date, s.substance_name, s.serial_number, s.assigned_to
    FROM protocols p
    JOIN samples s ON s.id = p.sample_id
   WHERE p.file_path IS NOT NULL AND p.file_name IS NOT NULL
     AND COALESCE(p.file_size, 0) > 0
     AND NOT EXISTS (SELECT 1 FROM files f WHERE f.r2_key = p.file_path)
), ins AS (
  INSERT INTO files (company_id, sample_id, r2_key, filename, mime_type, size_bytes, uploaded_by)
  SELECT company_id, sample_id, file_path, file_name, COALESCE(file_mime, 'application/octet-stream'),
         file_size, created_by
    FROM src
  RETURNING id, r2_key
)
INSERT INTO protocol_files (company_id, protocol_id, file_id, uploaded_by, kind,
                            substance_name, series, analysis_date, chemist_id)
SELECT src.company_id, src.protocol_id, ins.id, src.created_by, 'protocol',
       src.substance_name, src.serial_number, src.analysis_date, src.created_by
  FROM src JOIN ins ON ins.r2_key = src.file_path;

-- Mavjud qo'shimcha fayllar metadata'si — namuna va protokoldan (aniq ma'lum bo'lganlari)
UPDATE protocol_files pf
   SET substance_name = s.substance_name,
       series = s.serial_number,
       analysis_date = p.analysis_date,
       chemist_id = p.created_by
  FROM protocols p
  JOIN samples s ON s.id = p.sample_id
 WHERE pf.protocol_id = p.id AND pf.kind = 'extra';

-- 3) ND metadata (Addendum §3): xomashyo nomi, seriya, sana, mas'ul kimyogar, apparat — hammasi ixtiyoriy
ALTER TABLE normative_documents
  ADD COLUMN substance_name varchar(500) NULL,
  ADD COLUMN series varchar(100) NULL,
  ADD COLUMN doc_date date NULL,
  ADD COLUMN chemist_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN equipment_id uuid NULL REFERENCES equipment(id) ON DELETE SET NULL;

CREATE INDEX idx_nd_equipment ON normative_documents(company_id, equipment_id) WHERE equipment_id IS NOT NULL;

-- 4) Rad etish tarixi: qayta yuborishda protocols.rejection_reason NULL bo'ladi (avvalgi xatti-harakat),
--    tarix esa shu jadvalda saqlanadi.
CREATE TABLE protocol_rejections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  protocol_id uuid NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  reason text NOT NULL,
  rejected_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  rejected_at timestamptz NOT NULL DEFAULT now(),
  -- Backfill manbasi (audit | tracking | current) yoki 'app'
  source varchar(10) NOT NULL DEFAULT 'app' CHECK (source IN ('app', 'audit', 'tracking', 'current'))
);

CREATE INDEX idx_protocol_rejections_protocol ON protocol_rejections(protocol_id, rejected_at);
CREATE INDEX idx_protocol_rejections_company ON protocol_rejections(company_id, rejected_at);

-- Backfill (a): audit_log — har bir rad etish (P5 dan beri yoziladi)
INSERT INTO protocol_rejections (company_id, protocol_id, reason, rejected_by, rejected_at, source)
SELECT p.company_id, p.id, a.new_values->>'rejectionReason', a.user_id, a.created_at, 'audit'
  FROM audit_log a
  JOIN protocols p ON p.id::text = a.record_id::text
 WHERE a.table_name = 'protocols' AND a.action = 'reject'
   AND length(trim(COALESCE(a.new_values->>'rejectionReason', ''))) > 0;

-- Backfill (b): sample_tracking (standard/final protokollar) — auditda yo'q bo'lganlari
INSERT INTO protocol_rejections (company_id, protocol_id, reason, rejected_by, rejected_at, source)
SELECT p.company_id, p.id, t.reason, t.user_id, t.created_at, 'tracking'
  FROM sample_tracking t
  JOIN protocols p ON p.id::text = t.metadata->>'protocolId'
 WHERE t.event_type = 'rejected'
   AND length(trim(COALESCE(t.reason, ''))) > 0
   AND NOT EXISTS (
     SELECT 1 FROM protocol_rejections r
      WHERE r.protocol_id = p.id AND r.reason = t.reason
        AND abs(extract(epoch FROM (r.rejected_at - t.created_at))) < 60);

-- Backfill (c): joriy rad etilgan protokollar sababi (masalan ETL) — boshqa manbada yo'q bo'lsa
INSERT INTO protocol_rejections (company_id, protocol_id, reason, rejected_by, rejected_at, source)
SELECT p.company_id, p.id, p.rejection_reason, NULL, COALESCE(p.rejected_at, p.updated_at), 'current'
  FROM protocols p
 WHERE p.status = 'rejected'
   AND length(trim(COALESCE(p.rejection_reason, ''))) > 0
   AND NOT EXISTS (
     SELECT 1 FROM protocol_rejections r WHERE r.protocol_id = p.id AND r.reason = p.rejection_reason);
