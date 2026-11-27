-- 025_ai.sql: AI yordamchi qatlami (TZ Addendum §1–§3, DECISIONS.md D-179..D-182)
-- AI hech narsani o'zi saqlamaydi/tasdiqlamaydi: bu jadvallar faqat AI chaqiruvlari jurnali va
-- inson tasdiqlagan paytdagi "AI qiymati → yakuniy qiymat" izi.

-- Kompaniya bo'yicha AI flag — faqat super_admin yoqadi (D-179). Standart: o'chiq.
ALTER TABLE companies ADD COLUMN ai_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE ai_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  kind varchar(10) NOT NULL CHECK (kind IN ('sample', 'reagent', 'nd')),
  -- R2 kaliti (fayl mazmuni DB/logga yozilmaydi); R2 sozlanmagan bo'lsa NULL
  file_key text NULL,
  file_name text NULL,
  model varchar(100) NOT NULL,
  -- ok — sxemadan o'tdi; failed — xizmat/sxema xatosi; rejected — model rad etdi yoki rasm o'qilmaydi
  status varchar(10) NOT NULL CHECK (status IN ('ok', 'failed', 'rejected')),
  image_quality varchar(12) NULL CHECK (image_quality IN ('good', 'poor', 'unreadable')),
  -- Normallashtirilgan natija (maydon → { value, confidence }); failed bo'lsa NULL
  result_json jsonb NULL,
  error_code varchar(40) NULL,
  input_tokens integer NULL,
  output_tokens integer NULL,
  -- Namuna/reaktiv yaratishda bir marta "iste'mol qilinadi" (D-181)
  nd_id uuid NULL REFERENCES normative_documents(id) ON DELETE SET NULL,
  consumed_at timestamptz NULL,
  consumed_entity_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Kunlik limit hisobi (kompaniya + vaqt) va foydalanuvchi tarixi
CREATE INDEX idx_ai_extractions_company_day ON ai_extractions(company_id, created_at);
CREATE INDEX idx_ai_extractions_user ON ai_extractions(user_id, created_at);

-- AI to'ldirgan har maydon: AI qiymati va inson tasdiqlagan yakuniy qiymat (Addendum §3, D-181)
CREATE TABLE ai_field_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  extraction_id uuid NULL REFERENCES ai_extractions(id) ON DELETE SET NULL,
  entity_type varchar(10) NOT NULL CHECK (entity_type IN ('sample', 'reagent', 'nd')),
  entity_id uuid NOT NULL,
  field varchar(80) NOT NULL,
  ai_value text NULL,
  final_value text NULL,
  confidence varchar(6) NULL CHECK (confidence IN ('high', 'medium', 'low')),
  changed boolean NOT NULL,
  reviewed_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_field_reviews_entity ON ai_field_reviews(company_id, entity_type, entity_id);

-- ND talabi: AI taklif qilgan asl qiymat (tasdiqlashda yakuniy bilan solishtiriladi, D-182)
ALTER TABLE nd_requirements
  ADD COLUMN ai_value jsonb NULL,
  ADD COLUMN ai_reviewed_at timestamptz NULL;
