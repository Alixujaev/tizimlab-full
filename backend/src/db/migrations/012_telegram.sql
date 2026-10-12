-- 012_telegram.sql: Telegram integratsiyasi (link tokenlar va foydalanuvchi maydonlari)
-- Spec §13, SCHEMA_DIFF P11, DECISIONS.md D-65

ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username varchar(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_language varchar(10) DEFAULT 'uz';

CREATE TABLE telegram_link_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT telegram_link_tokens_pkey PRIMARY KEY (id),
    CONSTRAINT telegram_link_tokens_token_hash_key UNIQUE (token_hash),
    CONSTRAINT telegram_link_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_tlt_token_hash ON telegram_link_tokens USING btree (token_hash);
CREATE INDEX idx_tlt_user_id ON telegram_link_tokens USING btree (user_id);
