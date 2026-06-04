-- 1. Expandir status de artigos
ALTER TABLE public.qa_kb_artigos DROP CONSTRAINT IF EXISTS qa_kb_artigos_status_check;
ALTER TABLE public.qa_kb_artigos ADD CONSTRAINT qa_kb_artigos_status_check
  CHECK (status = ANY (ARRAY['draft','needs_review','audited','published','rejected','archived']));

ALTER TABLE public.qa_kb_artigos
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS visual_bug_detected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_review_reason text;

-- 2. Sessões de auditoria
CREATE TABLE IF NOT EXISTS public.qa_kb_audit_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status = ANY (ARRAY['in_progress','finished','cancelled'])),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  modules_audited text[] NOT NULL DEFAULT '{}',
  routes_audited text[] NOT NULL DEFAULT '{}',
  total_screenshots integer NOT NULL DEFAULT 0,
  created_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_kb_audit_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kb_audit_team_all ON public.qa_kb_audit_sessions;
CREATE POLICY kb_audit_team_all ON public.qa_kb_audit_sessions
  TO authenticated USING (true) WITH CHECK (true);

-- 3. Ampliar imagens
ALTER TABLE public.qa_kb_artigo_imagens
  ADD COLUMN IF NOT EXISTS image_type text NOT NULL DEFAULT 'imagem_ia'
    CHECK (image_type = ANY (ARRAY['screenshot_real','upload_manual','imagem_ia'])),
  ADD COLUMN IF NOT EXISTS route_path text,
  ADD COLUMN IF NOT EXISTS audit_session_id uuid REFERENCES public.qa_kb_audit_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS viewport text,
  ADD COLUMN IF NOT EXISTS device text;

CREATE INDEX IF NOT EXISTS idx_qa_kb_artigo_imagens_type ON public.qa_kb_artigo_imagens(image_type);
CREATE INDEX IF NOT EXISTS idx_qa_kb_artigo_imagens_session ON public.qa_kb_artigo_imagens(audit_session_id);

-- Marca todas imagens existentes como imagem_ia (default já cobre, mas garante)
UPDATE public.qa_kb_artigo_imagens SET image_type = 'imagem_ia' WHERE image_type IS NULL;

-- 4. Histórico de versões
CREATE TABLE IF NOT EXISTS public.qa_kb_article_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.qa_kb_artigos(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  images_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  UNIQUE (article_id, version_number)
);
ALTER TABLE public.qa_kb_article_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kb_versions_team_all ON public.qa_kb_article_versions;
CREATE POLICY kb_versions_team_all ON public.qa_kb_article_versions
  TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_qa_kb_article_versions_article ON public.qa_kb_article_versions(article_id, version_number DESC);

-- 5. Reviews
CREATE TABLE IF NOT EXISTS public.qa_kb_article_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.qa_kb_artigos(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action = ANY (ARRAY['approved','rejected','regenerated'])),
  reason text,
  notes text,
  screenshot_id uuid REFERENCES public.qa_kb_artigo_imagens(id) ON DELETE SET NULL,
  screenshot_url text,
  old_body text,
  new_body text,
  reviewed_by uuid,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_kb_article_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kb_reviews_team_all ON public.qa_kb_article_reviews;
CREATE POLICY kb_reviews_team_all ON public.qa_kb_article_reviews
  TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_qa_kb_article_reviews_article ON public.qa_kb_article_reviews(article_id, reviewed_at DESC);

-- 6. Trigger updated_at em audit_sessions
CREATE OR REPLACE FUNCTION public.qa_kb_audit_sessions_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_qa_kb_audit_sessions_updated ON public.qa_kb_audit_sessions;
CREATE TRIGGER trg_qa_kb_audit_sessions_updated BEFORE UPDATE ON public.qa_kb_audit_sessions
  FOR EACH ROW EXECUTE FUNCTION public.qa_kb_audit_sessions_set_updated_at();