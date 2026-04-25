-- Adiciona colunas de governança
ALTER TABLE public.qa_armamentos_catalogo
  ADD COLUMN IF NOT EXISTS status_revisao TEXT NOT NULL DEFAULT 'verificado'
    CHECK (status_revisao IN ('rascunho','pendente_revisao','verificado','rejeitado')),
  ADD COLUMN IF NOT EXISTS fonte_dados TEXT NOT NULL DEFAULT 'curado'
    CHECK (fonte_dados IN ('curado','ia_gerado','scrape_fabricante','importado')),
  ADD COLUMN IF NOT EXISTS fonte_url TEXT,
  ADD COLUMN IF NOT EXISTS revisado_por UUID,
  ADD COLUMN IF NOT EXISTS revisado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS imagem_url TEXT;

-- Índice para filtro de status
CREATE INDEX IF NOT EXISTS idx_qa_armamentos_catalogo_status
  ON public.qa_armamentos_catalogo (status_revisao);

-- Políticas admin (insert/update/delete) - apenas role admin
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='qa_armamentos_catalogo' AND policyname='qa_armamentos_catalogo_admin_insert') THEN
    CREATE POLICY "qa_armamentos_catalogo_admin_insert"
      ON public.qa_armamentos_catalogo FOR INSERT TO authenticated
      WITH CHECK (public.has_role(auth.uid(),'admin'::lp_app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='qa_armamentos_catalogo' AND policyname='qa_armamentos_catalogo_admin_update') THEN
    CREATE POLICY "qa_armamentos_catalogo_admin_update"
      ON public.qa_armamentos_catalogo FOR UPDATE TO authenticated
      USING (public.has_role(auth.uid(),'admin'::lp_app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='qa_armamentos_catalogo' AND policyname='qa_armamentos_catalogo_admin_delete') THEN
    CREATE POLICY "qa_armamentos_catalogo_admin_delete"
      ON public.qa_armamentos_catalogo FOR DELETE TO authenticated
      USING (public.has_role(auth.uid(),'admin'::lp_app_role));
  END IF;
END$$;