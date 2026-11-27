-- 026_reagent_lot_fields.sql: reaktiv lotining CoA/etiketka maydonlari (TZ §3.2, Addendum 1-bosqich, D-183)
-- Mavjud qatorlar NULL qoladi — taxmin qilinmaydi.

ALTER TABLE reagents
  ADD COLUMN lot_number varchar(100) NULL,
  ADD COLUMN manufacturer varchar(255) NULL,
  ADD COLUMN manufactured_at date NULL,
  ADD COLUMN arrival_date date NULL,
  ADD CONSTRAINT reagents_expiry_after_manufacture CHECK (
    manufactured_at IS NULL OR expires_at IS NULL OR expires_at >= manufactured_at);

CREATE INDEX idx_reagents_lot_number ON reagents(company_id, lot_number) WHERE lot_number IS NOT NULL;
