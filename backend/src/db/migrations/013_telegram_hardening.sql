-- Migration 013: Telegram hardening - database-level initData replay protection
CREATE TABLE IF NOT EXISTS used_init_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hash VARCHAR(64) NOT NULL UNIQUE,
    auth_date TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_used_init_data_expires_at ON used_init_data (expires_at);
