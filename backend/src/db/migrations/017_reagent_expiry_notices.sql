-- 017_reagent_expiry_notices.sql: reaktiv yaroqlilik muddati ogohlantirishlari jurnali (TZ §3.2, DECISIONS.md D-170)
-- Har (reaktiv, chegara, muddat) uchun bitta qator — takroriy xabar yuborilmaydi (UNIQUE + ON CONFLICT DO NOTHING).
-- `expires_at` kalitga kiradi: muddat o'zgartirilsa (yangi partiya), yangi sana uchun ogohlantirish qayta ishlaydi.

CREATE TABLE reagent_expiry_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  reagent_id uuid NOT NULL REFERENCES reagents(id) ON DELETE CASCADE,
  threshold smallint NOT NULL CHECK (threshold IN (30, 7, 0)),
  expires_at date NOT NULL,
  notified_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_reagent_expiry_notice UNIQUE (reagent_id, threshold, expires_at)
);

CREATE INDEX idx_reagent_expiry_notices_company ON reagent_expiry_notices(company_id);

-- Job va "muddati yaqin" filtri uchun.
CREATE INDEX IF NOT EXISTS idx_reagents_company_expires ON reagents(company_id, expires_at)
  WHERE expires_at IS NOT NULL;
