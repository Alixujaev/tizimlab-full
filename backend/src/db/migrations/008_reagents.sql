-- 008_reagents.sql: reaktivlar, tranzaksiyalar, xarajat jurnali va hujjatlar
-- Spec §6, SCHEMA_DIFF P7, DECISIONS.md D-08, D-51, D-69, D-79, D-132..D-136

-- 1. ENUM turlari
DO $$ BEGIN
  CREATE TYPE reagent_transaction_type AS ENUM ('in', 'out', 'adjustment', 'disposal');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE reagent_doc_type AS ENUM ('passport', 'analysis');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. `reagents` jadvali
CREATE TABLE reagents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  name varchar(255) NOT NULL,
  cas_number varchar(50) NULL,
  unit varchar(30) NOT NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 0,
  low_stock_threshold numeric(12,3) NOT NULL DEFAULT 0,
  expires_at date NULL,
  supplier varchar(255) NULL,
  storage_conditions varchar(255) NULL,
  is_hazardous boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reagents_quantity_non_negative CHECK (quantity >= 0),
  CONSTRAINT reagents_low_stock_threshold_non_negative CHECK (low_stock_threshold >= 0)
);

CREATE INDEX idx_reagents_company_id ON reagents(company_id);
CREATE INDEX idx_reagents_expires_at ON reagents(expires_at);
CREATE INDEX idx_reagents_name ON reagents(name);

-- 3. `reagent_transactions` jadvali
CREATE TABLE reagent_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  reagent_id uuid NOT NULL REFERENCES reagents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type reagent_transaction_type NOT NULL,
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  quantity_before numeric(12,3) NOT NULL,
  quantity_after numeric(12,3) NOT NULL CHECK (quantity_after >= 0),
  note text NULL,
  protocol_id uuid NULL REFERENCES protocols(id) ON DELETE SET NULL,
  analysis_purpose text NULL,
  recorded_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reagent_transactions_company_id ON reagent_transactions(company_id);
CREATE INDEX idx_reagent_transactions_reagent_id ON reagent_transactions(reagent_id);
CREATE INDEX idx_reagent_transactions_user_id ON reagent_transactions(user_id);
CREATE INDEX idx_reagent_transactions_created_at ON reagent_transactions(created_at DESC);
CREATE INDEX idx_reagent_tx_recorded_date ON reagent_transactions(recorded_date);

-- 4. `reagent_expense_log` view (xarajat jurnali: out tipidagi tranzaksiyalar)
CREATE OR REPLACE VIEW reagent_expense_log AS
SELECT * FROM reagent_transactions WHERE type = 'out';

-- 5. `reagent_documents` jadvali (files jadvaliga bog'langan)
CREATE TABLE reagent_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  reagent_id uuid NOT NULL REFERENCES reagents(id) ON DELETE CASCADE,
  file_id uuid NULL REFERENCES files(id) ON DELETE SET NULL,
  doc_type reagent_doc_type NOT NULL,
  file_name varchar(255) NOT NULL,
  file_path varchar(500) NOT NULL,
  file_size integer NULL,
  file_mime varchar(100) NULL,
  uploaded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reagent_documents_company_id ON reagent_documents(company_id);
CREATE INDEX idx_reagent_documents_reagent_id ON reagent_documents(reagent_id);
CREATE INDEX idx_reagent_documents_file_id ON reagent_documents(file_id);
