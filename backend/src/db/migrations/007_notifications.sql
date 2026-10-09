-- 007_notifications.sql: xabarnomalar (spec §9, D-13, D-59, D-70; SCHEMA_DIFF `notifications`)

-- Production sxemasidagi 11 qiymat (legacy `sample_created`, `sample_overdue`, `general` — faqat ETL qatorlari uchun,
-- ilova ularni yaratmaydi) + spec §9 talab qilgan `temperature_alert`, `low_stock`.
CREATE TYPE notification_type AS ENUM (
  'sample_created',
  'sample_assigned',
  'sample_overdue',
  'general',
  'stability_due_soon',
  'stability_overdue',
  'sample_approved',
  'sample_rejected',
  'protocol_rejected',
  'protocol_submitted',
  'protocol_approved',
  'temperature_alert',
  'low_stock'
);

-- `type` da DEFAULT yo'q (R-ARCH-80): ilova har doim aniq §9 turini beradi
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title varchar(255) NOT NULL,
  message text NOT NULL,
  reference_id uuid NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_company_id ON notifications(company_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read) WHERE is_read = false;
