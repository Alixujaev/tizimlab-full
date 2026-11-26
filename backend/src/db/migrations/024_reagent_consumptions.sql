-- 024_reagent_consumptions.sql: ND normasi bo'yicha avtomatik sarf (TZ §3.2, DECISIONS.md D-177)

CREATE TYPE reagent_consumption_status AS ENUM ('auto', 'confirmed', 'corrected');

CREATE TABLE reagent_consumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  protocol_id uuid NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  nd_id uuid NULL REFERENCES normative_documents(id) ON DELETE SET NULL,
  nd_requirement_id uuid NULL REFERENCES nd_requirements(id) ON DELETE SET NULL,
  reagent_item_id uuid NOT NULL REFERENCES reagent_items(id) ON DELETE RESTRICT,
  -- Hisob birligi — ND talabidagi birlik; lotlardan konvertatsiya bilan ayiriladi
  unit varchar(30) NOT NULL,
  -- Avto-sarfda > 0; tuzatishda 0 bo'lishi mumkin (tahlil o'tkazilmadi — hammasi omborga qaytadi)
  required_qty numeric(14,4) NOT NULL CHECK (required_qty >= 0),
  consumed_qty numeric(14,4) NOT NULL DEFAULT 0 CHECK (consumed_qty >= 0),
  shortfall_qty numeric(14,4) NOT NULL DEFAULT 0 CHECK (shortfall_qty >= 0),
  status reagent_consumption_status NOT NULL DEFAULT 'auto',
  correction_reason text NULL,
  reviewed_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz NULL,
  created_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Idempotentlik: bir tahlil (protokol) uchun har reaktiv bo'yicha sarf faqat bir marta
  CONSTRAINT uq_consumption_protocol_item UNIQUE (protocol_id, reagent_item_id),
  CONSTRAINT consumption_correction_check CHECK (
    status <> 'corrected' OR (correction_reason IS NOT NULL AND length(trim(correction_reason)) >= 5))
);

CREATE INDEX idx_reagent_consumptions_company ON reagent_consumptions(company_id, status);
CREATE INDEX idx_reagent_consumptions_protocol ON reagent_consumptions(protocol_id);

CREATE TRIGGER trg_reagent_consumptions_updated_at BEFORE UPDATE ON reagent_consumptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Qaysi lotdan qancha olingani (lot birligida; manfiy — tuzatishda qaytarilgan)
CREATE TABLE reagent_consumption_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  consumption_id uuid NOT NULL REFERENCES reagent_consumptions(id) ON DELETE CASCADE,
  reagent_id uuid NOT NULL REFERENCES reagents(id) ON DELETE RESTRICT,
  quantity numeric(14,4) NOT NULL CHECK (quantity <> 0),
  transaction_id uuid NULL REFERENCES reagent_transactions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reagent_consumption_lots_consumption ON reagent_consumption_lots(consumption_id);
CREATE INDEX idx_reagent_consumption_lots_reagent ON reagent_consumption_lots(reagent_id);
