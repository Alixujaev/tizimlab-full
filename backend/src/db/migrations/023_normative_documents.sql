-- 023_normative_documents.sql: normativ hujjatlar (ND) va ularning talablari (TZ §3.2, §3.3, DECISIONS.md D-176)

CREATE TYPE nd_status AS ENUM ('draft', 'approved', 'archived');

CREATE TABLE normative_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  code varchar(100) NOT NULL,
  name varchar(500) NOT NULL,
  version varchar(50) NULL,
  -- Talablar to'plami holati: draft (tahrirlanadi, P18 da AI to'ldiradi) -> approved (sarf va moslik shu bilan)
  status nd_status NOT NULL DEFAULT 'draft',
  approved_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz NULL,
  file_id uuid NULL REFERENCES files(id) ON DELETE SET NULL,
  file_name varchar(255) NULL,
  file_path varchar(500) NULL,
  file_size integer NULL,
  file_mime varchar(100) NULL,
  created_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nd_code_check CHECK (length(trim(code)) > 0),
  CONSTRAINT nd_name_check CHECK (length(trim(name)) > 0),
  CONSTRAINT nd_approved_check CHECK (status <> 'approved' OR approved_at IS NOT NULL)
);

-- Kod + versiya kompaniya ichida unikal
CREATE UNIQUE INDEX uq_nd_company_code_version
  ON normative_documents(company_id, lower(code), coalesce(lower(version), ''));
CREATE INDEX idx_nd_company ON normative_documents(company_id, status);

CREATE TRIGGER trg_nd_updated_at BEFORE UPDATE ON normative_documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TYPE nd_requirement_kind AS ENUM ('equipment', 'reagent');

CREATE TABLE nd_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  nd_id uuid NOT NULL REFERENCES normative_documents(id) ON DELETE CASCADE,
  kind nd_requirement_kind NOT NULL,
  -- Metodika/tahlil nomi (masalan "Sulfated ash")
  method_name varchar(255) NULL,
  equipment_category varchar(120) NULL,
  equipment_category_key varchar(120) GENERATED ALWAYS AS (
    lower(regexp_replace(trim(equipment_category), '\s+', ' ', 'g'))) STORED,
  reagent_item_id uuid NULL REFERENCES reagent_items(id) ON DELETE RESTRICT,
  quantity_per_analysis numeric(12,4) NULL,
  unit varchar(30) NULL,
  -- P18: 'ai' — model to'ldirgan, odam tasdiqlashi kerak; hozir 'manual'
  source varchar(10) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai')),
  note text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nd_req_equipment_shape CHECK (
    kind <> 'equipment' OR (equipment_category IS NOT NULL AND length(trim(equipment_category)) > 0
      AND reagent_item_id IS NULL AND quantity_per_analysis IS NULL)),
  CONSTRAINT nd_req_reagent_shape CHECK (
    kind <> 'reagent' OR (reagent_item_id IS NOT NULL AND quantity_per_analysis > 0 AND unit IS NOT NULL
      AND equipment_category IS NULL))
);

CREATE INDEX idx_nd_requirements_nd ON nd_requirements(nd_id, sort_order);
CREATE INDEX idx_nd_requirements_company ON nd_requirements(company_id);

CREATE TRIGGER trg_nd_requirements_updated_at BEFORE UPDATE ON nd_requirements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Tahlil <-> ND: protokol (tahlil yozuvi) bitta ND ga bog'lanadi; tahlillar soni sarf ko'paytuvchisi (D-177)
ALTER TABLE protocols
  ADD COLUMN nd_id uuid NULL REFERENCES normative_documents(id) ON DELETE SET NULL,
  ADD COLUMN n_analyses smallint NOT NULL DEFAULT 1 CHECK (n_analyses BETWEEN 1 AND 100);

CREATE INDEX idx_protocols_nd ON protocols(nd_id) WHERE nd_id IS NOT NULL;
