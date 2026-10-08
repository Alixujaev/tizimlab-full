-- 001_core: kompaniyalar, foydalanuvchilar, sessiyalar, individual ruxsatlar, audit jurnali.
-- Manba: docs/spec/BASELINE_PLAN.md (P2), docs/spec/SCHEMA_DIFF.md (P2 bo'limlari), D-70.
-- Audit DB triggerlari YO'Q (D-64): audit ilova servis qatlamida yoziladi.

CREATE FUNCTION set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Spec §1: 6 ta rol (sxemadagi tartib)
CREATE TYPE user_role AS ENUM (
    'chemist',
    'lab_head',
    'director',
    'kontrolyor',
    'admin',
    'super_admin'
);

-- ---------------------------------------------------------------- companies
CREATE TABLE companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(100) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT companies_pkey PRIMARY KEY (id),
    CONSTRAINT companies_name_key UNIQUE (name),
    CONSTRAINT companies_slug_key UNIQUE (slug)
);

CREATE INDEX idx_companies_is_active ON companies USING btree (is_active);
CREATE INDEX idx_companies_slug ON companies USING btree (slug);

CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------- users
CREATE TABLE users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    full_name character varying(255) NOT NULL,
    role user_role NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_login_at timestamp with time zone,
    created_by uuid,
    company_id uuid,
    telegram_chat_id bigint,
    telegram_linked_at timestamp with time zone,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_telegram_chat_id_key UNIQUE (telegram_chat_id),
    -- R-ROLE-02/03: super_admin kompaniyasiz, qolgan rollar kompaniyaga bog'langan (D-70)
    CONSTRAINT users_super_admin_company_check CHECK ((role = 'super_admin') = (company_id IS NULL)),
    -- D-91: email kichik harfda saqlanadi (global unikallik registrga bog'liq bo'lmasin)
    CONSTRAINT users_email_lower_check CHECK (email = lower(email)),
    CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
    CONSTRAINT users_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_users_active ON users USING btree (is_active);
CREATE INDEX idx_users_company_id ON users USING btree (company_id);
CREATE INDEX idx_users_created_by ON users USING btree (created_by);
CREATE INDEX idx_users_email ON users USING btree (email);
CREATE INDEX idx_users_role ON users USING btree (role);
CREATE INDEX idx_users_telegram_chat_id ON users USING btree (telegram_chat_id);

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------- sessions
-- Auth jadvali (super_admin ham) — company_id yo'q (BASELINE_PLAN).
CREATE TABLE sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    ip_address inet,
    user_agent text,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_activity timestamp with time zone,
    CONSTRAINT sessions_pkey PRIMARY KEY (id),
    CONSTRAINT sessions_token_hash_key UNIQUE (token_hash),
    CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_expires_at ON sessions USING btree (expires_at);
CREATE INDEX idx_sessions_token_hash ON sessions USING btree (token_hash);
CREATE INDEX idx_sessions_user_id ON sessions USING btree (user_id);
CREATE INDEX idx_sessions_user_last_activity ON sessions USING btree (user_id, last_activity);

-- ---------------------------------------------------------------- user_permissions
CREATE TABLE user_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    resource character varying(50) NOT NULL,
    action character varying(50) NOT NULL,
    granted_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    company_id uuid NOT NULL,
    CONSTRAINT user_permissions_pkey PRIMARY KEY (id),
    CONSTRAINT uq_user_permissions UNIQUE (user_id, resource, action),
    CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT user_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES users(id),
    CONSTRAINT user_permissions_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT
);

CREATE INDEX idx_user_permissions_granted_by ON user_permissions USING btree (granted_by);
CREATE INDEX idx_user_permissions_user_id ON user_permissions USING btree (user_id);
CREATE INDEX idx_user_permissions_company_id ON user_permissions USING btree (company_id);

-- ---------------------------------------------------------------- audit_log
-- Eski nomi audit_logs (spec §16, D-60 — audit_log). Eski yozuvlar ko'chirilmaydi (D-63).
CREATE TABLE audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    table_name character varying(100) NOT NULL,
    record_id uuid,
    action character varying(20) NOT NULL,
    old_values jsonb,
    new_values jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    company_id uuid,
    CONSTRAINT audit_log_pkey PRIMARY KEY (id),
    -- D-80: record_id NULL faqat auth hodisalari uchun (masalan, noma'lum email bilan login urinish)
    CONSTRAINT audit_log_record_id_check CHECK (record_id IS NOT NULL OR table_name = 'auth'),
    CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT audit_log_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_log_company_id ON audit_log USING btree (company_id);
CREATE INDEX idx_audit_log_created_at ON audit_log USING btree (created_at DESC);
CREATE INDEX idx_audit_log_record_id ON audit_log USING btree (record_id);
CREATE INDEX idx_audit_log_table_name ON audit_log USING btree (table_name);
CREATE INDEX idx_audit_log_user_id ON audit_log USING btree (user_id);
