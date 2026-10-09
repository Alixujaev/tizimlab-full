-- 004_files_passport.sql: generic fayllar (R2 metama'lumoti) va namuna pasporti uchun tracking kengaytmasi
-- Spec §3, §12, DECISIONS.md D-61, D-111, D-116, D-117, D-120
-- `samples.passport_*` ustunlari 003 da bor (SCHEMA_DIFF: yangi ustun qo'shilmaydi, D-85).

CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sample_id uuid REFERENCES samples(id) ON DELETE SET NULL,
  r2_key text NOT NULL,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT files_r2_key_key UNIQUE (r2_key),
  CONSTRAINT files_size_bytes_check CHECK (size_bytes > 0),
  CONSTRAINT files_filename_check CHECK (length(trim(filename)) > 0)
);

CREATE INDEX IF NOT EXISTS files_company_id_idx ON files(company_id);
CREATE INDEX IF NOT EXISTS files_sample_id_idx ON files(sample_id);

-- D-117: pasport o'chirilishi tracking'ga yoziladi (D-109 ro'yxati kengayadi)
ALTER TABLE sample_tracking DROP CONSTRAINT IF EXISTS sample_tracking_event_type_check;
ALTER TABLE sample_tracking ADD CONSTRAINT sample_tracking_event_type_check CHECK (
  event_type IN (
    'sample_created',
    'assigned',
    'reassigned',
    'stopped',
    'resumed',
    'submitted',
    'approved',
    'rejected',
    'passport_uploaded',
    'passport_reviewed',
    'passport_deleted',
    'deleted'
  )
);

-- D-120: reyestrda tasdiqlangan sana oxirgi `approved` voqeasidan olinadi
CREATE INDEX IF NOT EXISTS idx_sample_tracking_sample_event
  ON sample_tracking(sample_id, event_type, created_at DESC);
