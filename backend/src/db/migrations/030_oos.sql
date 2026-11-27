-- 030_oos.sql: OOS (Out of Specification) holatlari va AI Copilot chat (TZ §3.4, Addendum §2 4-bosqich,
-- DECISIONS.md D-194..D-196). OOS ni faqat inson ochadi va yopadi (yopish — lab_head); AI qaror chiqarmaydi.

CREATE TABLE oos_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sample_id uuid NOT NULL REFERENCES samples(id) ON DELETE RESTRICT,
  protocol_id uuid NULL REFERENCES protocols(id) ON DELETE SET NULL,
  test_name varchar(255) NOT NULL CHECK (length(trim(test_name)) > 0),
  result_value varchar(100) NOT NULL CHECK (length(trim(result_value)) > 0),
  spec_limit varchar(255) NOT NULL CHECK (length(trim(spec_limit)) > 0),
  unit varchar(30) NULL,
  description text NULL,
  status varchar(15) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'closed')),
  opened_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  root_cause text NULL,
  closure_note text NULL,
  closed_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  closed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oos_closed_check CHECK (
    status <> 'closed' OR (closed_at IS NOT NULL AND length(trim(COALESCE(root_cause, ''))) >= 5))
);

CREATE INDEX idx_oos_cases_company ON oos_cases(company_id, status, opened_at DESC);
CREATE INDEX idx_oos_cases_sample ON oos_cases(sample_id);

CREATE TRIGGER trg_oos_cases_updated_at BEFORE UPDATE ON oos_cases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- OOS jurnali (izohlar, holat o'zgarishlari) — AI o'chiq bo'lsa ham ishlaydi
CREATE TABLE oos_case_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES oos_cases(id) ON DELETE CASCADE,
  user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  kind varchar(15) NOT NULL DEFAULT 'note' CHECK (kind IN ('note', 'status_change')),
  text text NOT NULL CHECK (length(trim(text)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_oos_notes_case ON oos_case_notes(case_id, created_at);

-- Chat: OOS holatiga bog'langan yoki erkin savol
CREATE TABLE oos_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  case_id uuid NULL REFERENCES oos_cases(id) ON DELETE CASCADE,
  title varchar(200) NOT NULL,
  created_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_oos_sessions_company ON oos_chat_sessions(company_id, updated_at DESC);
CREATE INDEX idx_oos_sessions_case ON oos_chat_sessions(case_id);

CREATE TRIGGER trg_oos_chat_sessions_updated_at BEFORE UPDATE ON oos_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE oos_chat_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES oos_chat_sessions(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  kind varchar(10) NOT NULL CHECK (kind IN ('pdf', 'docx', 'jpeg', 'png', 'webp')),
  -- Word fayl matni (LLM ga matn sifatida); PDF/rasm — to'g'ridan-to'g'ri hujjat/rasm bloki
  extracted_text text NULL,
  uploaded_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_oos_attachments_session ON oos_chat_attachments(session_id, created_at);

-- Har AI javobi uchun audit: ishlatilgan manbalar, peak solishtirish fakti, model, tokenlar (D-196)
CREATE TABLE oos_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES oos_chat_sessions(id) ON DELETE CASCADE,
  role varchar(10) NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  answer jsonb NULL,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  peak_comparison jsonb NULL,
  retrieval_mode varchar(10) NULL CHECK (retrieval_mode IN ('hybrid', 'fts_only')),
  attachment_ids uuid[] NOT NULL DEFAULT '{}',
  model varchar(100) NULL,
  input_tokens integer NULL,
  output_tokens integer NULL,
  error_code varchar(40) NULL,
  created_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_oos_messages_session ON oos_chat_messages(session_id, created_at);
CREATE INDEX idx_oos_messages_company_day ON oos_chat_messages(company_id, created_at) WHERE role = 'assistant';
