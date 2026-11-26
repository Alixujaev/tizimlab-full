-- 015_sample_dates.sql: namunaga kelgan sana va yaroqlilik muddati (TZ §3.1, DECISIONS.md D-168)
-- `manufactured_at` (ishlab chiqarilgan sana) va `analysis_end` (analiz tugash sanasi) 003 da bor.

ALTER TABLE samples
  ADD COLUMN arrival_date date NULL,
  ADD COLUMN expiry_date date NULL;

-- Yaroqlilik muddati ishlab chiqarilgan sanadan oldin bo'lishi mumkin emas (ikkalasi berilganda).
ALTER TABLE samples
  ADD CONSTRAINT samples_expiry_after_manufacture_check
  CHECK (expiry_date IS NULL OR manufactured_at IS NULL OR expiry_date >= manufactured_at);

-- Audit qidiruvi uchun kelgan sana bo'yicha filtrlash (kompaniya ichida).
CREATE INDEX IF NOT EXISTS idx_samples_company_arrival ON samples(company_id, arrival_date)
  WHERE deleted_at IS NULL;
