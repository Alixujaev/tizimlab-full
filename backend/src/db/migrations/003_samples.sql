-- 003_samples.sql: Namunalar (Samples) va tracking (voqealar tarixi)
-- Spec §3, §16, DECISIONS.md D-14, D-17, D-36, D-37, D-38, D-39, D-43, D-68, D-71, D-72

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sample_type') THEN
    CREATE TYPE sample_type AS ENUM (
      'raw_material',
      'finished_product',
      'reagent',
      'standard_substance',
      'other'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sample_status') THEN
    CREATE TYPE sample_status AS ENUM (
      'pending_assignment',
      'in_progress',
      'stopped',
      'submitted',
      'approved',
      'rejected'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  type sample_type NOT NULL,
  status sample_status NOT NULL DEFAULT 'pending_assignment',
  substance_id uuid REFERENCES substances(id) ON DELETE RESTRICT,
  substance_name varchar(500) NOT NULL,
  serial_number varchar(100),
  lot_number varchar(100),
  quantity varchar(50),
  manufacturer varchar(255),
  manufactured_at date,
  analysis_start date,
  analysis_end date,
  notes text,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  stop_reason text,
  stopped_at timestamptz,
  deleted_at timestamptz,
  passport_file_name text,
  passport_file_path text,
  passport_file_size integer,
  passport_status text CHECK (passport_status IS NULL OR passport_status IN ('pending', 'approved', 'rejected')),
  passport_uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT samples_substance_name_check CHECK (length(trim(substance_name)) > 0),
  CONSTRAINT samples_stop_reason_check CHECK (stop_reason IS NULL OR length(trim(stop_reason)) >= 5)
);

CREATE TABLE IF NOT EXISTS sample_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  sample_id uuid NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
  event_type varchar(50) NOT NULL CHECK (
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
      'deleted'
    )
  ),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  from_status sample_status,
  to_status sample_status,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indekslar
CREATE INDEX IF NOT EXISTS idx_samples_company_id ON samples(company_id);
CREATE INDEX IF NOT EXISTS idx_samples_created_by ON samples(created_by);
CREATE INDEX IF NOT EXISTS idx_samples_assigned_to ON samples(assigned_to);
CREATE INDEX IF NOT EXISTS idx_samples_status ON samples(status);
CREATE INDEX IF NOT EXISTS idx_samples_type ON samples(type);
CREATE INDEX IF NOT EXISTS idx_samples_substance_id ON samples(substance_id);
CREATE INDEX IF NOT EXISTS idx_samples_substance_name ON samples(substance_name);
CREATE INDEX IF NOT EXISTS idx_samples_deleted_at ON samples(deleted_at);
CREATE INDEX IF NOT EXISTS idx_samples_created_at ON samples(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sample_tracking_company_id ON sample_tracking(company_id);
CREATE INDEX IF NOT EXISTS idx_sample_tracking_sample_id ON sample_tracking(sample_id);
CREATE INDEX IF NOT EXISTS idx_sample_tracking_created_at ON sample_tracking(created_at DESC);

-- Trigger: updated_at
DROP TRIGGER IF EXISTS trg_samples_updated_at ON samples;
DROP TRIGGER IF EXISTS set_samples_updated_at ON samples;
CREATE TRIGGER trg_samples_updated_at
  BEFORE UPDATE ON samples
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
