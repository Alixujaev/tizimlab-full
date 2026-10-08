-- 002_substances: moddalar va modda parametrlari
-- Manba: docs/spec/BASELINE_PLAN.md (P3), docs/spec/SCHEMA_DIFF.md (P3 bo'limlari), D-67, D-30, R-ARCH-27/28/72.

CREATE TYPE pharmacopoeia AS ENUM (
    'EP',
    'BP',
    'UzDSt',
    'USP',
    'OTHER'
);

-- ---------------------------------------------------------------- substances
CREATE TABLE substances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name_uz character varying(255) NOT NULL,
    name_ru character varying(255),
    name_en character varying(255),
    pharmacopoeia pharmacopoeia NOT NULL,
    cas_number character varying(50),
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    company_id uuid NOT NULL,
    CONSTRAINT substances_pkey PRIMARY KEY (id),
    CONSTRAINT substances_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT substances_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT
);

CREATE INDEX idx_substances_active ON substances USING btree (is_active);
CREATE INDEX idx_substances_company_id ON substances USING btree (company_id);
CREATE INDEX idx_substances_pharmacopoeia ON substances USING btree (pharmacopoeia);
CREATE INDEX idx_substances_name_uz ON substances USING gin (to_tsvector('simple'::regconfig, (name_uz)::text));

CREATE TRIGGER trg_substances_updated_at BEFORE UPDATE ON substances
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------- substance_parameters
CREATE TABLE substance_parameters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    substance_id uuid NOT NULL,
    parameter_name character varying(255) NOT NULL,
    unit character varying(50),
    spec_min numeric(12,4),
    spec_max numeric(12,4),
    method character varying(255),
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    company_id uuid NOT NULL,
    CONSTRAINT substance_parameters_pkey PRIMARY KEY (id),
    CONSTRAINT substance_parameters_spec_range_check CHECK (spec_min IS NULL OR spec_max IS NULL OR spec_min <= spec_max),
    CONSTRAINT substance_parameters_substance_id_fkey FOREIGN KEY (substance_id) REFERENCES substances(id) ON DELETE CASCADE,
    CONSTRAINT substance_parameters_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT
);

CREATE INDEX idx_substance_parameters_substance_id ON substance_parameters USING btree (substance_id);
CREATE INDEX idx_substance_parameters_company_id ON substance_parameters USING btree (company_id);
