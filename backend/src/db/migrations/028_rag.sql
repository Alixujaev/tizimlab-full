-- 028_rag.sql: pgvector + ichki bilim bazasi (RAG) — TZ §3.4, Addendum §2 4-bosqich, DECISIONS.md D-190..D-192
--
-- pgvector serverda o'rnatilgan bo'lishi SHART (Ubuntu: `apt install postgresql-16-pgvector`).
-- Kengaytma `public` sxemasiga o'rnatiladi: ilova search_path'ida `public` bor; test izolyatsiya sxemalari
-- (t_xxxxxx) ham `search_path = t_xxx, public` bilan ishlaydi va sxema o'chirilganda kengaytma yo'qolmaydi.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    RAISE EXCEPTION USING
      MESSAGE = 'pgvector kengaytmasi serverda o''rnatilmagan (028_rag.sql)',
      HINT = 'PostgreSQL 16: sudo apt install postgresql-16-pgvector; so''ng migratsiyani qayta ishga tushiring. '
          || 'Ilova foydalanuvchisida huquq bo''lmasa superuser bir marta: CREATE EXTENSION vector WITH SCHEMA public;';
  END IF;
END
$$;

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- Indekslash navbati (yangi infratuzilma yo'q: DB jadvali + ilova ichidagi worker, D-191)
CREATE TABLE rag_index_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_type varchar(10) NOT NULL CHECK (source_type IN ('protocol', 'peak', 'nd', 'oos_case')),
  source_id uuid NOT NULL,
  status varchar(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'failed', 'skipped')),
  attempts smallint NOT NULL DEFAULT 0,
  last_error varchar(200) NULL,
  content_hash char(64) NULL,
  chunk_count integer NULL,
  run_after timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_rag_job_source UNIQUE (source_type, source_id)
);

CREATE INDEX idx_rag_jobs_queue ON rag_index_jobs(status, run_after) WHERE status IN ('pending', 'running');
CREATE INDEX idx_rag_jobs_company ON rag_index_jobs(company_id, status);

CREATE TRIGGER trg_rag_index_jobs_updated_at BEFORE UPDATE ON rag_index_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Bo'laklar: faqat TASDIQLANGAN manbalar; har retrieval company_id bilan cheklanadi (D-192)
CREATE TABLE doc_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_type varchar(10) NOT NULL CHECK (source_type IN ('protocol', 'peak', 'nd', 'oos_case')),
  source_id uuid NOT NULL,
  chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  -- Filtr uchun metadata (Addendum §3): xomashyo nomi, seriya, sana, kimyogar, apparat, ND
  substance_name varchar(500) NULL,
  series varchar(100) NULL,
  doc_date date NULL,
  chemist_id uuid NULL,
  equipment_id uuid NULL,
  nd_id uuid NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  chunk_text text NOT NULL CHECK (length(chunk_text) > 0),
  -- Vektor: embedding modeli o'lchami 1024 (D-190); model/o'lcham har bo'lakda — qayta indekslash uchun
  embedding public.vector(1024) NULL,
  embedding_model varchar(100) NULL,
  embedding_dim smallint NULL,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', chunk_text)) STORED,
  content_hash char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_doc_chunk UNIQUE (source_type, source_id, chunk_index)
);

CREATE INDEX idx_doc_chunks_company ON doc_chunks(company_id, source_type);
CREATE INDEX idx_doc_chunks_source ON doc_chunks(source_type, source_id);
CREATE INDEX idx_doc_chunks_tsv ON doc_chunks USING gin (tsv);
CREATE INDEX idx_doc_chunks_substance ON doc_chunks(company_id, lower(substance_name));
CREATE INDEX idx_doc_chunks_embedding ON doc_chunks USING hnsw (embedding public.vector_cosine_ops);

-- AI jurnaliga yangi turlar: OCR (skan/rasm matni) va peak jadvali ekstraksiyasi
ALTER TABLE ai_extractions DROP CONSTRAINT IF EXISTS ai_extractions_kind_check;
ALTER TABLE ai_extractions ADD CONSTRAINT ai_extractions_kind_check
  CHECK (kind IN ('sample', 'reagent', 'nd', 'ocr', 'peaks'));
