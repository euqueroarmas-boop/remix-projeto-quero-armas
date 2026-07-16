
CREATE TABLE IF NOT EXISTS public.qa_branding (
  chave text PRIMARY KEY,
  data_url text NOT NULL,
  mime_type text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

GRANT SELECT ON public.qa_branding TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.qa_branding TO authenticated;
GRANT ALL ON public.qa_branding TO service_role;

ALTER TABLE public.qa_branding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qa_branding public read" ON public.qa_branding;
CREATE POLICY "qa_branding public read"
ON public.qa_branding FOR SELECT
USING (true);

DROP POLICY IF EXISTS "qa_branding admin insert" ON public.qa_branding;
CREATE POLICY "qa_branding admin insert"
ON public.qa_branding FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p
  WHERE p.user_id = auth.uid() AND p.ativo = true AND p.perfil = 'administrador'));

DROP POLICY IF EXISTS "qa_branding admin update" ON public.qa_branding;
CREATE POLICY "qa_branding admin update"
ON public.qa_branding FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p
  WHERE p.user_id = auth.uid() AND p.ativo = true AND p.perfil = 'administrador'))
WITH CHECK (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p
  WHERE p.user_id = auth.uid() AND p.ativo = true AND p.perfil = 'administrador'));

DROP POLICY IF EXISTS "qa_branding admin delete" ON public.qa_branding;
CREATE POLICY "qa_branding admin delete"
ON public.qa_branding FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.qa_usuarios_perfis p
  WHERE p.user_id = auth.uid() AND p.ativo = true AND p.perfil = 'administrador'));
