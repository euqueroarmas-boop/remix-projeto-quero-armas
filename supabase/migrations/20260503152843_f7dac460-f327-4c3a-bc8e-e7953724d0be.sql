
-- 1. Bucket público para imagens da base de conhecimento
INSERT INTO storage.buckets (id, name, public)
VALUES ('qa-kb-imagens', 'qa-kb-imagens', true)
ON CONFLICT (id) DO NOTHING;

-- Policies de storage (idempotentes)
DO $$ BEGIN
  CREATE POLICY "qa_kb_imgs_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'qa-kb-imagens');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "qa_kb_imgs_team_write" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'qa-kb-imagens');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "qa_kb_imgs_team_update" ON storage.objects
    FOR UPDATE TO authenticated USING (bucket_id = 'qa-kb-imagens');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "qa_kb_imgs_team_delete" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'qa-kb-imagens');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tabela de imagens dos artigos
CREATE TABLE IF NOT EXISTS public.qa_kb_artigo_imagens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id    uuid NOT NULL REFERENCES public.qa_kb_artigos(id) ON DELETE CASCADE,
  step_number   integer NOT NULL DEFAULT 0,
  step_title    text,
  caption       text,
  prompt_used   text,
  image_url     text,
  storage_path  text,
  status        text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','approved','archived','error')),
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_kb_artigo_imagens_article ON public.qa_kb_artigo_imagens(article_id);
CREATE INDEX IF NOT EXISTS idx_qa_kb_artigo_imagens_status ON public.qa_kb_artigo_imagens(status);

ALTER TABLE public.qa_kb_artigo_imagens ENABLE ROW LEVEL SECURITY;

-- Equipe (qualquer usuário autenticado da área da equipe) pode tudo
DROP POLICY IF EXISTS "kb_img_team_all" ON public.qa_kb_artigo_imagens;
CREATE POLICY "kb_img_team_all" ON public.qa_kb_artigo_imagens
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Cliente: apenas leitura de approved de artigos publicados para clientes
DROP POLICY IF EXISTS "kb_img_cliente_select" ON public.qa_kb_artigo_imagens;
CREATE POLICY "kb_img_cliente_select" ON public.qa_kb_artigo_imagens
  FOR SELECT TO authenticated
  USING (
    status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.qa_kb_artigos a
      WHERE a.id = qa_kb_artigo_imagens.article_id
        AND a.status = 'published'
        AND a.audience = 'cliente'
    )
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.qa_kb_artigo_imagens_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_qa_kb_artigo_imagens_updated ON public.qa_kb_artigo_imagens;
CREATE TRIGGER trg_qa_kb_artigo_imagens_updated
BEFORE UPDATE ON public.qa_kb_artigo_imagens
FOR EACH ROW EXECUTE FUNCTION public.qa_kb_artigo_imagens_set_updated_at();

-- 3. Quando o corpo de um artigo muda, arquivar imagens antigas (não bloqueia)
CREATE OR REPLACE FUNCTION public.qa_kb_archive_old_images()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.body IS DISTINCT FROM OLD.body THEN
    UPDATE public.qa_kb_artigo_imagens
       SET status = 'archived', updated_at = now()
     WHERE article_id = NEW.id AND status IN ('draft','approved');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_qa_kb_archive_old_images ON public.qa_kb_artigos;
CREATE TRIGGER trg_qa_kb_archive_old_images
AFTER UPDATE ON public.qa_kb_artigos
FOR EACH ROW EXECUTE FUNCTION public.qa_kb_archive_old_images();
