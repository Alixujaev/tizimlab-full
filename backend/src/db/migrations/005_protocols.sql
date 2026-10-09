-- 005_protocols.sql: protocols va protocol_signatures jadvallari
-- Spec §4, §16, DECISIONS.md D-14, D-15, D-46, D-74, D-122

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'protocol_status') THEN
    CREATE TYPE protocol_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'finalized');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'protocol_role') THEN
    CREATE TYPE protocol_role AS ENUM ('standard', 'final', 'in_process');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  sample_id uuid NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id),
  status protocol_status NOT NULL DEFAULT 'draft',
  protocol_role protocol_role NOT NULL DEFAULT 'standard',
  file_path text NULL,
  file_name text NULL,
  file_size integer NULL,
  file_mime text NULL,
  rejection_reason text NULL,
  submitted_at timestamptz NULL,
  approved_at timestamptz NULL,
  finalized_at timestamptz NULL,
  rejected_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_protocols_sample_role UNIQUE (sample_id, protocol_role),
  CONSTRAINT protocols_file_size_check CHECK (file_size IS NULL OR file_size > 0)
);

CREATE INDEX IF NOT EXISTS idx_protocols_company_id ON protocols(company_id);
CREATE INDEX IF NOT EXISTS idx_protocols_sample_id ON protocols(sample_id);
CREATE INDEX IF NOT EXISTS idx_protocols_status ON protocols(status);
CREATE INDEX IF NOT EXISTS idx_protocols_created_by ON protocols(created_by);
CREATE INDEX IF NOT EXISTS idx_protocols_created_at ON protocols(created_at DESC);

DROP TRIGGER IF EXISTS trg_protocols_updated_at ON protocols;
CREATE TRIGGER trg_protocols_updated_at
  BEFORE UPDATE ON protocols
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS protocol_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  protocol_id uuid NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  role user_role NOT NULL,
  action text NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'finalized')),
  signature_hash varchar(64) NOT NULL,
  ip_address inet NULL,
  signed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_protocol_signatures_protocol_id ON protocol_signatures(protocol_id, signed_at ASC);
CREATE INDEX IF NOT EXISTS idx_protocol_signatures_company_id ON protocol_signatures(company_id);
