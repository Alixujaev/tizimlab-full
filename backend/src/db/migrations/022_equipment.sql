-- 022_equipment.sql: laboratoriya apparatlari va kalibrlash ogohlantirishlari (TZ §3.3, DECISIONS.md D-175)

CREATE TYPE equipment_status AS ENUM ('active', 'maintenance', 'out_of_service');

CREATE TABLE equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  name varchar(255) NOT NULL,
  -- Kategoriya/turi — ND apparat talablari shu kalit bilan solishtiriladi (D-175)
  category varchar(120) NOT NULL,
  category_key varchar(120) GENERATED ALWAYS AS (lower(regexp_replace(trim(category), '\s+', ' ', 'g'))) STORED,
  model varchar(255) NULL,
  serial_number varchar(120) NULL,
  location varchar(255) NULL,
  status equipment_status NOT NULL DEFAULT 'active',
  calibration_due date NULL,
  notes text NULL,
  created_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equipment_name_check CHECK (length(trim(name)) > 0),
  CONSTRAINT equipment_category_check CHECK (length(trim(category)) > 0)
);

CREATE UNIQUE INDEX uq_equipment_company_serial ON equipment(company_id, serial_number)
  WHERE serial_number IS NOT NULL;
CREATE INDEX idx_equipment_company_category ON equipment(company_id, category_key);
CREATE INDEX idx_equipment_company_calibration ON equipment(company_id, calibration_due)
  WHERE calibration_due IS NOT NULL;

CREATE TRIGGER trg_equipment_updated_at BEFORE UPDATE ON equipment
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Kalibrlash ogohlantirishlari jurnali (D-170 naqshi): har (apparat, chegara, muddat) uchun bitta xabar.
CREATE TABLE equipment_calibration_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  threshold smallint NOT NULL CHECK (threshold IN (30, 7, 0)),
  calibration_due date NOT NULL,
  notified_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_equipment_calibration_notice UNIQUE (equipment_id, threshold, calibration_due)
);

CREATE INDEX idx_equipment_calibration_notices_company ON equipment_calibration_notices(company_id);

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'equipment_calibration_due';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'reagent_shortfall';
