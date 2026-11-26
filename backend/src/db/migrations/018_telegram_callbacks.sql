-- 018_telegram_callbacks.sql: Telegram inline callback tugmalari (TZ §4, DECISIONS.md D-171)

-- callback_data = 'cb:<id>' (Telegram cheklovi 64 bayt). id — 16 belgili kriptografik tasodifiy base64url,
-- taxmin qilib bo'lmaydi; amal va parametrlar faqat serverda saqlanadi (callback_data da ID/rol yo'q).
CREATE TABLE telegram_callback_tokens (
  id varchar(16) PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{16}$'),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action varchar(32) NOT NULL CHECK (action IN ('assign_pick', 'assign', 'protocol_approve', 'protocol_reject')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_callback_tokens_user ON telegram_callback_tokens(user_id);
CREATE INDEX idx_telegram_callback_tokens_expires ON telegram_callback_tokens(expires_at);

-- "Rad etish" bosilgandan keyin sababni keyingi matnli xabardan olish uchun (chat bo'yicha bitta kutilayotgan kiritish).
CREATE TABLE telegram_pending_inputs (
  chat_id bigint PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action varchar(32) NOT NULL CHECK (action IN ('protocol_reject')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
