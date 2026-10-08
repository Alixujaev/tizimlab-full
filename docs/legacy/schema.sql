--
-- PostgreSQL database dump
--

\restrict v2FobYGFvcK26COZ8CH0hGgBSJMaBdryFkPLuY86Uabxse0UkqBvTg8c4bO41eO

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_type AS ENUM (
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
    'protocol_approved'
);


--
-- Name: pharmacopoeia; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pharmacopoeia AS ENUM (
    'EP',
    'BP',
    'UzDSt',
    'USP',
    'OTHER'
);


--
-- Name: protocol_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.protocol_role AS ENUM (
    'standard',
    'final',
    'in_process'
);


--
-- Name: protocol_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.protocol_status AS ENUM (
    'draft',
    'submitted',
    'approved',
    'rejected',
    'finalized'
);


--
-- Name: reagent_doc_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.reagent_doc_type AS ENUM (
    'passport',
    'analysis'
);


--
-- Name: reagent_transaction_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.reagent_transaction_type AS ENUM (
    'in',
    'out',
    'adjustment',
    'disposal'
);


--
-- Name: sample_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sample_status AS ENUM (
    'pending_assignment',
    'in_progress',
    'stopped',
    'submitted',
    'approved',
    'rejected'
);


--
-- Name: sample_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sample_type AS ENUM (
    'raw_material',
    'finished_product',
    'in_process',
    'reagent',
    'standard_substance',
    'other'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'chemist',
    'lab_head',
    'director',
    'kontrolyor',
    'admin',
    'super_admin'
);


--
-- Name: audit_log_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_log_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_record_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id;
  ELSE
    v_record_id := NEW.id;
  END IF;

  INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values)
  VALUES (
    TG_TABLE_NAME,
    v_record_id,
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('UPDATE', 'INSERT') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    table_name character varying(100) NOT NULL,
    record_id uuid NOT NULL,
    action character varying(20) NOT NULL,
    old_values jsonb,
    new_values jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    company_id uuid
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(100) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    sample_id uuid,
    r2_key text NOT NULL,
    filename text NOT NULL,
    mime_type text NOT NULL,
    size_bytes bigint NOT NULL,
    uploaded_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type public.notification_type DEFAULT 'general'::public.notification_type NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    reference_id uuid,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    company_id uuid NOT NULL
);


--
-- Name: protocol_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.protocol_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    protocol_id uuid NOT NULL,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_size integer,
    file_mime text,
    uploaded_by uuid,
    uploaded_at timestamp with time zone DEFAULT now()
);


--
-- Name: protocol_signatures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.protocol_signatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    protocol_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.user_role NOT NULL,
    signature_hash character varying(64) NOT NULL,
    signed_at timestamp with time zone DEFAULT now() NOT NULL,
    ip_address inet
);


--
-- Name: protocol_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.protocol_values (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    protocol_id uuid NOT NULL,
    parameter_id uuid NOT NULL,
    value numeric(12,4),
    passed boolean,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by uuid NOT NULL
);


--
-- Name: protocols; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.protocols (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    substance_id uuid,
    created_by uuid NOT NULL,
    status public.protocol_status DEFAULT 'draft'::public.protocol_status NOT NULL,
    batch_number character varying(100),
    sample_source character varying(255),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    submitted_at timestamp with time zone,
    approved_at timestamp with time zone,
    finalized_at timestamp with time zone,
    sample_id uuid,
    rejected_at timestamp with time zone,
    file_path character varying(500),
    file_name character varying(255),
    file_size integer,
    file_mime character varying(100),
    protocol_role public.protocol_role DEFAULT 'standard'::public.protocol_role,
    rejection_reason text,
    company_id uuid NOT NULL,
    passport_file_name text,
    passport_file_size integer,
    passport_file_mime text,
    passport_file_path text
);


--
-- Name: reagent_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reagent_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reagent_id uuid NOT NULL,
    doc_type public.reagent_doc_type NOT NULL,
    file_name character varying(255) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_size integer,
    file_mime character varying(100),
    uploaded_by uuid NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reagent_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reagent_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reagent_id uuid NOT NULL,
    user_id uuid NOT NULL,
    type public.reagent_transaction_type NOT NULL,
    quantity numeric(12,3) NOT NULL,
    quantity_before numeric(12,3) NOT NULL,
    quantity_after numeric(12,3) NOT NULL,
    note text,
    protocol_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    analysis_purpose text,
    recorded_date date,
    CONSTRAINT reagent_tx_quantity_positive CHECK ((quantity > (0)::numeric))
);


--
-- Name: reagents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reagents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    cas_number character varying(50),
    unit character varying(30) NOT NULL,
    quantity numeric(12,3) DEFAULT 0 NOT NULL,
    low_stock_threshold numeric(12,3) DEFAULT 0 NOT NULL,
    expires_at date,
    supplier character varying(255),
    storage_conditions character varying(255),
    is_hazardous boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    company_id uuid NOT NULL,
    CONSTRAINT reagents_quantity_non_negative CHECK ((quantity >= (0)::numeric))
);


--
-- Name: sample_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sample_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sample_id uuid NOT NULL,
    uploaded_by uuid NOT NULL,
    file_name character varying(255) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_size integer,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: samples; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.samples (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by uuid NOT NULL,
    substance_id uuid,
    type public.sample_type NOT NULL,
    serial_number character varying(100),
    lot_number character varying(100),
    manufactured_at date,
    expires_at date,
    quantity character varying(50),
    notes text,
    status public.sample_status DEFAULT 'pending_assignment'::public.sample_status NOT NULL,
    assigned_to uuid,
    assigned_by uuid,
    assigned_at timestamp with time zone,
    deadline date,
    stop_reason text,
    stopped_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    manufacturer character varying(255),
    analysis_start date,
    analysis_end date,
    company_id uuid NOT NULL,
    substance_name character varying(500) NOT NULL,
    passport_file_name text,
    passport_file_path text,
    passport_file_size integer,
    passport_status text,
    passport_uploaded_by uuid,
    CONSTRAINT samples_passport_status_check CHECK ((passport_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying(255) NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sensor_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sensor_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sensor_id character varying(100) NOT NULL,
    location_name character varying(255) NOT NULL,
    temp_min numeric(5,1) NOT NULL,
    temp_max numeric(5,1) NOT NULL,
    humidity_min numeric(5,1),
    humidity_max numeric(5,1),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    company_id uuid NOT NULL,
    CONSTRAINT temp_range_valid CHECK ((temp_min < temp_max))
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    ip_address inet,
    user_agent text,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_activity timestamp with time zone
);


--
-- Name: stability_checkpoints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stability_checkpoints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    study_id uuid NOT NULL,
    interval_tag text NOT NULL,
    due_date date NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    assigned_to uuid,
    completed_at timestamp with time zone,
    completed_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stability_checkpoints_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'overdue'::text])))
);


--
-- Name: stability_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stability_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    checkpoint_id uuid NOT NULL,
    parameter character varying(200) NOT NULL,
    initial_value text,
    current_value text NOT NULL,
    specification text,
    result_status text DEFAULT 'pass'::text NOT NULL,
    recorded_by uuid NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stability_results_result_status_check CHECK ((result_status = ANY (ARRAY['pass'::text, 'fail'::text, 'warning'::text])))
);


--
-- Name: stability_studies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stability_studies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sample_id uuid NOT NULL,
    started_at date DEFAULT CURRENT_DATE NOT NULL,
    storage_conditions text,
    status text DEFAULT 'active'::text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    company_id uuid NOT NULL,
    CONSTRAINT stability_studies_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: substance_parameters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.substance_parameters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    substance_id uuid NOT NULL,
    parameter_name character varying(255) NOT NULL,
    unit character varying(50),
    spec_min numeric(12,4),
    spec_max numeric(12,4),
    method character varying(255),
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: substances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.substances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name_uz character varying(255) NOT NULL,
    name_ru character varying(255),
    name_en character varying(255),
    pharmacopoeia public.pharmacopoeia NOT NULL,
    cas_number character varying(50),
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    company_id uuid NOT NULL
);


--
-- Name: telegram_link_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telegram_link_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: temperature_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temperature_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sensor_id character varying(100) NOT NULL,
    reading_id uuid NOT NULL,
    temperature numeric(5,2) NOT NULL,
    alert_type character varying(50) NOT NULL,
    notified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: temperature_readings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temperature_readings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sensor_id character varying(100) NOT NULL,
    temperature numeric(5,2) NOT NULL,
    humidity numeric(5,2),
    alert_triggered boolean DEFAULT false NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    is_manual boolean DEFAULT false NOT NULL,
    recorded_by uuid
);


--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    resource character varying(50) NOT NULL,
    action character varying(50) NOT NULL,
    granted_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    full_name character varying(255) NOT NULL,
    role public.user_role NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_login_at timestamp with time zone,
    created_by uuid,
    company_id uuid,
    telegram_chat_id bigint,
    telegram_linked_at timestamp with time zone
);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: companies companies_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_name_key UNIQUE (name);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: companies companies_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_slug_key UNIQUE (slug);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: files files_r2_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_r2_key_key UNIQUE (r2_key);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: protocol_files protocol_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocol_files
    ADD CONSTRAINT protocol_files_pkey PRIMARY KEY (id);


--
-- Name: protocol_signatures protocol_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocol_signatures
    ADD CONSTRAINT protocol_signatures_pkey PRIMARY KEY (id);


--
-- Name: protocol_signatures protocol_signatures_protocol_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocol_signatures
    ADD CONSTRAINT protocol_signatures_protocol_id_role_key UNIQUE (protocol_id, role);


--
-- Name: protocol_values protocol_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocol_values
    ADD CONSTRAINT protocol_values_pkey PRIMARY KEY (id);


--
-- Name: protocol_values protocol_values_protocol_id_parameter_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocol_values
    ADD CONSTRAINT protocol_values_protocol_id_parameter_id_key UNIQUE (protocol_id, parameter_id);


--
-- Name: protocols protocols_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocols
    ADD CONSTRAINT protocols_pkey PRIMARY KEY (id);


--
-- Name: reagent_documents reagent_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reagent_documents
    ADD CONSTRAINT reagent_documents_pkey PRIMARY KEY (id);


--
-- Name: reagent_transactions reagent_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reagent_transactions
    ADD CONSTRAINT reagent_transactions_pkey PRIMARY KEY (id);


--
-- Name: reagents reagents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reagents
    ADD CONSTRAINT reagents_pkey PRIMARY KEY (id);


--
-- Name: sample_documents sample_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sample_documents
    ADD CONSTRAINT sample_documents_pkey PRIMARY KEY (id);


--
-- Name: samples samples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.samples
    ADD CONSTRAINT samples_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sensor_configs sensor_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensor_configs
    ADD CONSTRAINT sensor_configs_pkey PRIMARY KEY (id);


--
-- Name: sensor_configs sensor_configs_sensor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensor_configs
    ADD CONSTRAINT sensor_configs_sensor_id_key UNIQUE (sensor_id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_hash_key UNIQUE (token_hash);


--
-- Name: stability_checkpoints stability_checkpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stability_checkpoints
    ADD CONSTRAINT stability_checkpoints_pkey PRIMARY KEY (id);


--
-- Name: stability_results stability_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stability_results
    ADD CONSTRAINT stability_results_pkey PRIMARY KEY (id);


--
-- Name: stability_studies stability_studies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stability_studies
    ADD CONSTRAINT stability_studies_pkey PRIMARY KEY (id);


--
-- Name: substance_parameters substance_parameters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.substance_parameters
    ADD CONSTRAINT substance_parameters_pkey PRIMARY KEY (id);


--
-- Name: substances substances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.substances
    ADD CONSTRAINT substances_pkey PRIMARY KEY (id);


--
-- Name: telegram_link_tokens telegram_link_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_link_tokens
    ADD CONSTRAINT telegram_link_tokens_pkey PRIMARY KEY (id);


--
-- Name: telegram_link_tokens telegram_link_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_link_tokens
    ADD CONSTRAINT telegram_link_tokens_token_key UNIQUE (token);


--
-- Name: temperature_alerts temperature_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temperature_alerts
    ADD CONSTRAINT temperature_alerts_pkey PRIMARY KEY (id);


--
-- Name: temperature_readings temperature_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temperature_readings
    ADD CONSTRAINT temperature_readings_pkey PRIMARY KEY (id);


--
-- Name: stability_checkpoints uq_checkpoint; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stability_checkpoints
    ADD CONSTRAINT uq_checkpoint UNIQUE (study_id, interval_tag);


--
-- Name: stability_studies uq_stability_sample; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stability_studies
    ADD CONSTRAINT uq_stability_sample UNIQUE (sample_id);


--
-- Name: user_permissions uq_user_permissions; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT uq_user_permissions UNIQUE (user_id, resource, action);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_telegram_chat_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_telegram_chat_id_key UNIQUE (telegram_chat_id);


--
-- Name: files_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX files_company_id_idx ON public.files USING btree (company_id);


--
-- Name: files_sample_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX files_sample_id_idx ON public.files USING btree (sample_id);


--
-- Name: idx_audit_logs_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_company_id ON public.audit_logs USING btree (company_id);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_record_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_record_id ON public.audit_logs USING btree (record_id);


--
-- Name: idx_audit_logs_table_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_table_name ON public.audit_logs USING btree (table_name);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_companies_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_companies_is_active ON public.companies USING btree (is_active);


--
-- Name: idx_companies_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_companies_slug ON public.companies USING btree (slug);


--
-- Name: idx_notifications_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_company_id ON public.notifications USING btree (company_id);


--
-- Name: idx_notifications_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (user_id, is_read) WHERE (is_read = false);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_protocol_files_protocol_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_protocol_files_protocol_id ON public.protocol_files USING btree (protocol_id);


--
-- Name: idx_protocol_signatures_protocol_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_protocol_signatures_protocol_id ON public.protocol_signatures USING btree (protocol_id);


--
-- Name: idx_protocol_values_protocol_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_protocol_values_protocol_id ON public.protocol_values USING btree (protocol_id);


--
-- Name: idx_protocols_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_protocols_company_id ON public.protocols USING btree (company_id);


--
-- Name: idx_protocols_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_protocols_created_at ON public.protocols USING btree (created_at DESC);


--
-- Name: idx_protocols_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_protocols_created_by ON public.protocols USING btree (created_by);


--
-- Name: idx_protocols_sample_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_protocols_sample_id ON public.protocols USING btree (sample_id);


--
-- Name: idx_protocols_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_protocols_status ON public.protocols USING btree (status);


--
-- Name: idx_protocols_substance_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_protocols_substance_id ON public.protocols USING btree (substance_id);


--
-- Name: idx_reagent_documents_reagent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reagent_documents_reagent_id ON public.reagent_documents USING btree (reagent_id);


--
-- Name: idx_reagent_transactions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reagent_transactions_created_at ON public.reagent_transactions USING btree (created_at DESC);


--
-- Name: idx_reagent_transactions_reagent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reagent_transactions_reagent_id ON public.reagent_transactions USING btree (reagent_id);


--
-- Name: idx_reagent_transactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reagent_transactions_user_id ON public.reagent_transactions USING btree (user_id);


--
-- Name: idx_reagent_tx_recorded_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reagent_tx_recorded_date ON public.reagent_transactions USING btree (recorded_date);


--
-- Name: idx_reagents_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reagents_company_id ON public.reagents USING btree (company_id);


--
-- Name: idx_reagents_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reagents_expires_at ON public.reagents USING btree (expires_at);


--
-- Name: idx_reagents_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reagents_name ON public.reagents USING btree (name);


--
-- Name: idx_sample_docs_sample_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sample_docs_sample_id ON public.sample_documents USING btree (sample_id);


--
-- Name: idx_samples_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_samples_assigned_to ON public.samples USING btree (assigned_to);


--
-- Name: idx_samples_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_samples_company_id ON public.samples USING btree (company_id);


--
-- Name: idx_samples_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_samples_created_at ON public.samples USING btree (created_at DESC);


--
-- Name: idx_samples_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_samples_created_by ON public.samples USING btree (created_by);


--
-- Name: idx_samples_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_samples_status ON public.samples USING btree (status);


--
-- Name: idx_samples_substance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_samples_substance ON public.samples USING btree (substance_id);


--
-- Name: idx_samples_substance_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_samples_substance_name ON public.samples USING btree (substance_name);


--
-- Name: idx_sensor_configs_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sensor_configs_company_id ON public.sensor_configs USING btree (company_id);


--
-- Name: idx_sessions_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_expires_at ON public.sessions USING btree (expires_at);


--
-- Name: idx_sessions_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_token_hash ON public.sessions USING btree (token_hash);


--
-- Name: idx_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id);


--
-- Name: idx_sessions_user_last_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user_last_activity ON public.sessions USING btree (user_id, last_activity);


--
-- Name: idx_stability_cp_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stability_cp_due ON public.stability_checkpoints USING btree (due_date);


--
-- Name: idx_stability_cp_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stability_cp_status ON public.stability_checkpoints USING btree (status);


--
-- Name: idx_stability_cp_study; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stability_cp_study ON public.stability_checkpoints USING btree (study_id);


--
-- Name: idx_stability_results_cp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stability_results_cp ON public.stability_results USING btree (checkpoint_id);


--
-- Name: idx_stability_studies_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stability_studies_company_id ON public.stability_studies USING btree (company_id);


--
-- Name: idx_stability_studies_sample; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stability_studies_sample ON public.stability_studies USING btree (sample_id);


--
-- Name: idx_stability_studies_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stability_studies_status ON public.stability_studies USING btree (status);


--
-- Name: idx_substance_parameters_substance_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_substance_parameters_substance_id ON public.substance_parameters USING btree (substance_id);


--
-- Name: idx_substances_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_substances_active ON public.substances USING btree (is_active);


--
-- Name: idx_substances_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_substances_company_id ON public.substances USING btree (company_id);


--
-- Name: idx_substances_name_uz; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_substances_name_uz ON public.substances USING gin (to_tsvector('simple'::regconfig, (name_uz)::text));


--
-- Name: idx_substances_pharmacopoeia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_substances_pharmacopoeia ON public.substances USING btree (pharmacopoeia);


--
-- Name: idx_temp_alerts_notified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_alerts_notified ON public.temperature_alerts USING btree (notified_at) WHERE (notified_at IS NULL);


--
-- Name: idx_temp_readings_alerts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_readings_alerts ON public.temperature_readings USING btree (alert_triggered) WHERE (alert_triggered = true);


--
-- Name: idx_temp_readings_recorded_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_readings_recorded_at ON public.temperature_readings USING btree (recorded_at DESC);


--
-- Name: idx_temp_readings_sensor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_readings_sensor_id ON public.temperature_readings USING btree (sensor_id);


--
-- Name: idx_temperature_readings_recorded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temperature_readings_recorded_by ON public.temperature_readings USING btree (recorded_by) WHERE (recorded_by IS NOT NULL);


--
-- Name: idx_tlt_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tlt_token ON public.telegram_link_tokens USING btree (token);


--
-- Name: idx_user_permissions_granted_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_permissions_granted_by ON public.user_permissions USING btree (granted_by);


--
-- Name: idx_user_permissions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_permissions_user_id ON public.user_permissions USING btree (user_id);


--
-- Name: idx_users_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_active ON public.users USING btree (is_active);


--
-- Name: idx_users_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_company_id ON public.users USING btree (company_id);


--
-- Name: idx_users_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_created_by ON public.users USING btree (created_by);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_users_telegram_chat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_telegram_chat_id ON public.users USING btree (telegram_chat_id);


--
-- Name: uq_protocols_sample_role; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_protocols_sample_role ON public.protocols USING btree (sample_id, protocol_role) WHERE ((sample_id IS NOT NULL) AND (protocol_role IS NOT NULL));


--
-- Name: protocol_signatures audit_protocol_signatures; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_protocol_signatures AFTER INSERT OR DELETE OR UPDATE ON public.protocol_signatures FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: protocol_values audit_protocol_values; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_protocol_values AFTER INSERT OR DELETE OR UPDATE ON public.protocol_values FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: protocols audit_protocols; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_protocols AFTER INSERT OR DELETE OR UPDATE ON public.protocols FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: reagent_transactions audit_reagent_transactions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_reagent_transactions AFTER INSERT OR DELETE OR UPDATE ON public.reagent_transactions FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: sample_documents audit_sample_documents; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_sample_documents AFTER INSERT OR DELETE OR UPDATE ON public.sample_documents FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: samples audit_samples; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_samples AFTER INSERT OR DELETE OR UPDATE ON public.samples FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: users audit_users; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_users AFTER INSERT OR DELETE OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: companies trg_companies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: protocols trg_protocols_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protocols_updated_at BEFORE UPDATE ON public.protocols FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: reagents trg_reagents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reagents_updated_at BEFORE UPDATE ON public.reagents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: samples trg_samples_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_samples_updated_at BEFORE UPDATE ON public.samples FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sensor_configs trg_sensor_configs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sensor_configs_updated_at BEFORE UPDATE ON public.sensor_configs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: stability_checkpoints trg_stability_checkpoints_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_stability_checkpoints_updated_at BEFORE UPDATE ON public.stability_checkpoints FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: stability_studies trg_stability_studies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_stability_studies_updated_at BEFORE UPDATE ON public.stability_studies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: substances trg_substances_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_substances_updated_at BEFORE UPDATE ON public.substances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: audit_logs audit_logs_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: files files_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: files files_sample_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_sample_id_fkey FOREIGN KEY (sample_id) REFERENCES public.samples(id) ON DELETE SET NULL;


--
-- Name: files files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: notifications notifications_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: protocol_files protocol_files_protocol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocol_files
    ADD CONSTRAINT protocol_files_protocol_id_fkey FOREIGN KEY (protocol_id) REFERENCES public.protocols(id) ON DELETE CASCADE;


--
-- Name: protocol_files protocol_files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocol_files
    ADD CONSTRAINT protocol_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: protocol_signatures protocol_signatures_protocol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocol_signatures
    ADD CONSTRAINT protocol_signatures_protocol_id_fkey FOREIGN KEY (protocol_id) REFERENCES public.protocols(id) ON DELETE CASCADE;


--
-- Name: protocol_signatures protocol_signatures_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocol_signatures
    ADD CONSTRAINT protocol_signatures_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: protocol_values protocol_values_parameter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocol_values
    ADD CONSTRAINT protocol_values_parameter_id_fkey FOREIGN KEY (parameter_id) REFERENCES public.substance_parameters(id);


--
-- Name: protocol_values protocol_values_protocol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocol_values
    ADD CONSTRAINT protocol_values_protocol_id_fkey FOREIGN KEY (protocol_id) REFERENCES public.protocols(id) ON DELETE CASCADE;


--
-- Name: protocol_values protocol_values_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocol_values
    ADD CONSTRAINT protocol_values_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: protocols protocols_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocols
    ADD CONSTRAINT protocols_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: protocols protocols_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocols
    ADD CONSTRAINT protocols_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: protocols protocols_sample_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocols
    ADD CONSTRAINT protocols_sample_id_fkey FOREIGN KEY (sample_id) REFERENCES public.samples(id);


--
-- Name: protocols protocols_substance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocols
    ADD CONSTRAINT protocols_substance_id_fkey FOREIGN KEY (substance_id) REFERENCES public.substances(id);


--
-- Name: reagent_documents reagent_documents_reagent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reagent_documents
    ADD CONSTRAINT reagent_documents_reagent_id_fkey FOREIGN KEY (reagent_id) REFERENCES public.reagents(id) ON DELETE CASCADE;


--
-- Name: reagent_documents reagent_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reagent_documents
    ADD CONSTRAINT reagent_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: reagent_transactions reagent_transactions_protocol_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reagent_transactions
    ADD CONSTRAINT reagent_transactions_protocol_id_fkey FOREIGN KEY (protocol_id) REFERENCES public.protocols(id);


--
-- Name: reagent_transactions reagent_transactions_reagent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reagent_transactions
    ADD CONSTRAINT reagent_transactions_reagent_id_fkey FOREIGN KEY (reagent_id) REFERENCES public.reagents(id);


--
-- Name: reagent_transactions reagent_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reagent_transactions
    ADD CONSTRAINT reagent_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: reagents reagents_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reagents
    ADD CONSTRAINT reagents_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: sample_documents sample_documents_sample_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sample_documents
    ADD CONSTRAINT sample_documents_sample_id_fkey FOREIGN KEY (sample_id) REFERENCES public.samples(id) ON DELETE CASCADE;


--
-- Name: sample_documents sample_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sample_documents
    ADD CONSTRAINT sample_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: samples samples_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.samples
    ADD CONSTRAINT samples_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: samples samples_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.samples
    ADD CONSTRAINT samples_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: samples samples_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.samples
    ADD CONSTRAINT samples_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: samples samples_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.samples
    ADD CONSTRAINT samples_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: samples samples_passport_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.samples
    ADD CONSTRAINT samples_passport_uploaded_by_fkey FOREIGN KEY (passport_uploaded_by) REFERENCES public.users(id);


--
-- Name: samples samples_substance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.samples
    ADD CONSTRAINT samples_substance_id_fkey FOREIGN KEY (substance_id) REFERENCES public.substances(id);


--
-- Name: sensor_configs sensor_configs_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensor_configs
    ADD CONSTRAINT sensor_configs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: stability_checkpoints stability_checkpoints_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stability_checkpoints
    ADD CONSTRAINT stability_checkpoints_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: stability_checkpoints stability_checkpoints_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stability_checkpoints
    ADD CONSTRAINT stability_checkpoints_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id);


--
-- Name: stability_checkpoints stability_checkpoints_study_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stability_checkpoints
    ADD CONSTRAINT stability_checkpoints_study_id_fkey FOREIGN KEY (study_id) REFERENCES public.stability_studies(id) ON DELETE CASCADE;


--
-- Name: stability_results stability_results_checkpoint_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stability_results
    ADD CONSTRAINT stability_results_checkpoint_id_fkey FOREIGN KEY (checkpoint_id) REFERENCES public.stability_checkpoints(id) ON DELETE CASCADE;


--
-- Name: stability_results stability_results_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stability_results
    ADD CONSTRAINT stability_results_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: stability_studies stability_studies_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stability_studies
    ADD CONSTRAINT stability_studies_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: stability_studies stability_studies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stability_studies
    ADD CONSTRAINT stability_studies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: stability_studies stability_studies_sample_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stability_studies
    ADD CONSTRAINT stability_studies_sample_id_fkey FOREIGN KEY (sample_id) REFERENCES public.samples(id);


--
-- Name: substance_parameters substance_parameters_substance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.substance_parameters
    ADD CONSTRAINT substance_parameters_substance_id_fkey FOREIGN KEY (substance_id) REFERENCES public.substances(id) ON DELETE CASCADE;


--
-- Name: substances substances_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.substances
    ADD CONSTRAINT substances_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: substances substances_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.substances
    ADD CONSTRAINT substances_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: telegram_link_tokens telegram_link_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_link_tokens
    ADD CONSTRAINT telegram_link_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: temperature_alerts temperature_alerts_reading_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temperature_alerts
    ADD CONSTRAINT temperature_alerts_reading_id_fkey FOREIGN KEY (reading_id) REFERENCES public.temperature_readings(id);


--
-- Name: temperature_alerts temperature_alerts_sensor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temperature_alerts
    ADD CONSTRAINT temperature_alerts_sensor_id_fkey FOREIGN KEY (sensor_id) REFERENCES public.sensor_configs(sensor_id);


--
-- Name: temperature_readings temperature_readings_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temperature_readings
    ADD CONSTRAINT temperature_readings_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: temperature_readings temperature_readings_sensor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temperature_readings
    ADD CONSTRAINT temperature_readings_sensor_id_fkey FOREIGN KEY (sensor_id) REFERENCES public.sensor_configs(sensor_id);


--
-- Name: user_permissions user_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id);


--
-- Name: user_permissions user_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: users users_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict v2FobYGFvcK26COZ8CH0hGgBSJMaBdryFkPLuY86Uabxse0UkqBvTg8c4bO41eO

