-- 011_stability.sql: Stabilizatsiya tekshiruvlari (studies, checkpoints, results)
-- Spec §8, SCHEMA_DIFF P9, DECISIONS.md D-05, D-12, D-13, D-53..D-58, D-77, D-81, D-142..D-145

-- 1. `stability_studies` jadvali
CREATE TABLE stability_studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  sample_id uuid NOT NULL REFERENCES samples(id) ON DELETE RESTRICT,
  started_at date NOT NULL DEFAULT CURRENT_DATE,
  storage_conditions text NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- D-58, SCHEMA_DIFF: bitta namunada bir vaqtda faqat bitta 'active' study
CREATE UNIQUE INDEX uq_stability_sample_active ON stability_studies (sample_id) WHERE status = 'active';

CREATE INDEX idx_stability_studies_company_id ON stability_studies(company_id);
CREATE INDEX idx_stability_studies_sample ON stability_studies(sample_id);
CREATE INDEX idx_stability_studies_status ON stability_studies(status);

CREATE TRIGGER trg_stability_studies_updated_at BEFORE UPDATE ON stability_studies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. `stability_checkpoints` jadvali
CREATE TABLE stability_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  study_id uuid NOT NULL REFERENCES stability_studies(id) ON DELETE CASCADE,
  interval_tag text NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
  assigned_to uuid NULL REFERENCES users(id),
  completed_at timestamptz NULL,
  completed_by uuid NULL REFERENCES users(id),
  notes text NULL,
  last_due_soon_notified_at timestamptz NULL,
  overdue_notified_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_stability_cp_study_tag UNIQUE (study_id, interval_tag)
);

CREATE INDEX idx_stability_cp_company_id ON stability_checkpoints(company_id);
CREATE INDEX idx_stability_cp_study ON stability_checkpoints(study_id);
CREATE INDEX idx_stability_cp_due ON stability_checkpoints(due_date);
CREATE INDEX idx_stability_cp_status ON stability_checkpoints(status);

CREATE TRIGGER trg_stability_checkpoints_updated_at BEFORE UPDATE ON stability_checkpoints
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. `stability_results` jadvali
CREATE TABLE stability_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  checkpoint_id uuid NOT NULL REFERENCES stability_checkpoints(id) ON DELETE CASCADE,
  parameter varchar(200) NOT NULL,
  initial_value text NULL,
  current_value text NULL,
  specification text NULL,
  result_status text NOT NULL DEFAULT 'pass' CHECK (result_status IN ('pass', 'fail', 'warning')),
  recorded_by uuid NOT NULL REFERENCES users(id),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_stability_results_cp_param UNIQUE (checkpoint_id, parameter)
);

CREATE INDEX idx_stability_results_company_id ON stability_results(company_id);
CREATE INDEX idx_stability_results_cp ON stability_results(checkpoint_id);
