-- 029_peak_results.sql: peak fayllaridan raqamli natijalar (TZ §3.4, DECISIONS.md D-193)
-- Solishtirish faqat TASDIQLANGAN (`confirmed`) qatorlar bilan; AI to'ldirgani `draft` + ai_value (P18 naqshi).
-- Apparat va metodika (ND) — peak faylining metadata'sidan (protocol_files / protocols), takrorlanmaydi.

CREATE TABLE peak_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  protocol_id uuid NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  protocol_file_id uuid NOT NULL REFERENCES protocol_files(id) ON DELETE CASCADE,
  peak_name varchar(120) NULL,
  retention_time numeric(10,4) NOT NULL CHECK (retention_time > 0),
  area numeric(18,4) NULL CHECK (area IS NULL OR area >= 0),
  height numeric(18,4) NULL CHECK (height IS NULL OR height >= 0),
  area_percent numeric(7,4) NULL CHECK (area_percent IS NULL OR (area_percent >= 0 AND area_percent <= 100)),
  tailing numeric(8,4) NULL CHECK (tailing IS NULL OR tailing > 0),
  plates numeric(14,2) NULL CHECK (plates IS NULL OR plates >= 0),
  resolution numeric(8,4) NULL CHECK (resolution IS NULL OR resolution >= 0),
  source varchar(10) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai')),
  ai_value jsonb NULL,
  status varchar(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
  confirmed_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at timestamptz NULL,
  created_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT peak_results_confirm_check CHECK (status <> 'confirmed' OR confirmed_at IS NOT NULL)
);

CREATE INDEX idx_peak_results_file ON peak_results(protocol_file_id, retention_time);
CREATE INDEX idx_peak_results_company ON peak_results(company_id, status);

CREATE TRIGGER trg_peak_results_updated_at BEFORE UPDATE ON peak_results
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- AI to'ldirgan peak qiymatlari tasdiqlanganda AI → yakuniy izi (D-181 naqshi)
ALTER TABLE ai_field_reviews DROP CONSTRAINT IF EXISTS ai_field_reviews_entity_type_check;
ALTER TABLE ai_field_reviews ADD CONSTRAINT ai_field_reviews_entity_type_check
  CHECK (entity_type IN ('sample', 'reagent', 'nd', 'peak'));
