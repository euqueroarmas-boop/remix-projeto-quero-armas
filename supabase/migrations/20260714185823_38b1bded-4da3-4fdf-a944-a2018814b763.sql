CREATE TABLE IF NOT EXISTS public.qa_arsenal_planos (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text        NOT NULL DEFAULT 'Arsenal Inteligente Premium',
  descricao     text,
  valor_anual   numeric(10,2) NOT NULL DEFAULT 297.00,
  parcelas_max  int         NOT NULL DEFAULT 12,
  ativo         boolean     NOT NULL DEFAULT true,
  criado_em     timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

GRANT SELECT ON public.qa_arsenal_planos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.qa_arsenal_planos TO authenticated;
GRANT ALL ON public.qa_arsenal_planos TO service_role;

ALTER TABLE public.qa_arsenal_planos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planos_leitura_publica" ON public.qa_arsenal_planos;
CREATE POLICY "planos_leitura_publica"
  ON public.qa_arsenal_planos FOR SELECT
  USING (ativo = true);

DROP POLICY IF EXISTS "planos_staff_gerenciar" ON public.qa_arsenal_planos;
CREATE POLICY "planos_staff_gerenciar"
  ON public.qa_arsenal_planos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.qa_usuarios_perfis
      WHERE user_id = auth.uid()
        AND perfil IN ('administrador', 'staff')
        AND ativo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.qa_usuarios_perfis
      WHERE user_id = auth.uid()
        AND perfil IN ('administrador', 'staff')
        AND ativo = true
    )
  );

INSERT INTO public.qa_arsenal_planos (nome, descricao, valor_anual, parcelas_max, ativo)
SELECT
  'Arsenal Inteligente Premium',
  'Acesso anual ao Arsenal Inteligente: Klal, gestão de armas e munições, alertas de documentos, análise de alvo e recarga.',
  297.00,
  12,
  true
WHERE NOT EXISTS (SELECT 1 FROM public.qa_arsenal_planos);

NOTIFY pgrst, 'reload schema';