-- 019_registry_search_indexes.sql: audit qidiruvi (reyestr) uchun qisman indekslar (TZ §3.5, DECISIONS.md D-172)
-- Reyestr faqat tasdiqlangan, o'chirilmagan namunalarni ko'rsatadi — indekslar shu to'plam bilan cheklangan.

CREATE INDEX IF NOT EXISTS idx_samples_registry_assignee
  ON samples (company_id, assigned_to)
  WHERE status = 'approved' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_samples_registry_serial
  ON samples (company_id, lower(serial_number))
  WHERE status = 'approved' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_samples_registry_lot
  ON samples (company_id, lower(lot_number))
  WHERE status = 'approved' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_samples_registry_name
  ON samples (company_id, lower(substance_name))
  WHERE status = 'approved' AND deleted_at IS NULL;

-- Kimyogarlar ro'yxati (filtr tanlovi) uchun
CREATE INDEX IF NOT EXISTS idx_users_company_role ON users (company_id, role);
