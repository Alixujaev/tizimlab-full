-- 006_protocol_extras.sql: protokol pasporti va qo'shimcha fayllar (protocol_files)
-- Spec 04-protocols §4, DECISIONS.md D-47, D-49, D-76, D-84, D-123..D-125

-- 1. protocols jadvaliga pasport ustunlari (holatsiz qo'shimcha hujjat)
ALTER TABLE protocols
  ADD COLUMN IF NOT EXISTS passport_file_name text NULL,
  ADD COLUMN IF NOT EXISTS passport_file_path text NULL,
  ADD COLUMN IF NOT EXISTS passport_file_size integer NULL,
  ADD COLUMN IF NOT EXISTS passport_file_mime text NULL,
  ADD COLUMN IF NOT EXISTS passport_uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS passport_uploaded_at timestamptz NULL;

-- 2. protocol_files jadvali (faqat finished_product namunalari uchun qo'shimcha tahlil fayllari)
CREATE TABLE IF NOT EXISTS protocol_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  protocol_id uuid NOT NULL REFERENCES protocols(id) ON DELETE RESTRICT,
  file_id uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_protocol_files_file UNIQUE (file_id)
);

CREATE INDEX IF NOT EXISTS idx_protocol_files_company_id ON protocol_files(company_id);
CREATE INDEX IF NOT EXISTS idx_protocol_files_protocol_id ON protocol_files(protocol_id);
CREATE INDEX IF NOT EXISTS idx_protocol_files_file_id ON protocol_files(file_id);
CREATE INDEX IF NOT EXISTS idx_protocol_files_created_at ON protocol_files(created_at DESC);
