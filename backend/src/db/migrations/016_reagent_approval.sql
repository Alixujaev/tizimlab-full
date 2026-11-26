-- 016_reagent_approval.sql: reaktivni tasdiqlash oqimi (TZ §3.2, DECISIONS.md D-169)
-- va P16 xabarnoma turlari (D-169, D-170).

CREATE TYPE reagent_approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Mavjud reaktivlar allaqachon ishlatilmoqda — ular `approved` hisoblanadi; yangi qatorlar uchun default `pending`.
ALTER TABLE reagents
  ADD COLUMN approval_status reagent_approval_status NOT NULL DEFAULT 'approved',
  ADD COLUMN created_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN approved_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN approved_at timestamptz NULL,
  ADD COLUMN rejection_reason text NULL;

ALTER TABLE reagents ALTER COLUMN approval_status SET DEFAULT 'pending';

ALTER TABLE reagents
  ADD CONSTRAINT reagents_rejection_reason_check CHECK (
    approval_status <> 'rejected'
    OR (rejection_reason IS NOT NULL AND length(trim(rejection_reason)) >= 5)
  ),
  ADD CONSTRAINT reagents_decision_fields_check CHECK (
    approval_status = 'pending' OR approved_at IS NOT NULL
  );

CREATE INDEX idx_reagents_company_approval ON reagents(company_id, approval_status);

-- Xabarnoma turlari (yangi qiymatlar shu migratsiyada ishlatilmaydi — tranzaksiya ichida xavfsiz).
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'reagent_pending_approval';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'reagent_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'reagent_rejected';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'reagent_expiring';
