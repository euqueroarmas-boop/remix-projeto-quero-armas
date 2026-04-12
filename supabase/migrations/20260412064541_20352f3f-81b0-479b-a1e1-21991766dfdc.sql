
-- Config table for ranking weights
CREATE TABLE IF NOT EXISTS public.qa_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor numeric NOT NULL DEFAULT 0,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qa_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_config_auth_read" ON public.qa_config
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo = true));

CREATE POLICY "qa_config_auth_update" ON public.qa_config
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo = true AND p.perfil = 'administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM qa_usuarios_perfis p WHERE p.user_id = auth.uid() AND p.ativo = true AND p.perfil = 'administrador'));

CREATE POLICY "qa_config_service" ON public.qa_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Insert default ranking weights
INSERT INTO public.qa_config (chave, valor, descricao) VALUES
  ('peso_similaridade_vetorial', 0.25, 'Peso da busca semântica vetorial no ranking de fontes'),
  ('peso_relevancia_textual', 0.25, 'Peso da busca textual no ranking de fontes'),
  ('peso_validacao_humana', 0.20, 'Peso de fontes validadas humanamente'),
  ('peso_feedback_positivo', 0.15, 'Peso de fontes com feedback positivo anterior'),
  ('peso_feedback_negativo', -0.10, 'Penalidade para fontes com feedback negativo'),
  ('peso_referencia_aprovada', 0.30, 'Bônus para fontes promovidas a referência'),
  ('peso_recencia', 0.05, 'Bônus para fontes mais recentes'),
  ('peso_manual', 0.10, 'Peso de priorização manual')
ON CONFLICT (chave) DO NOTHING;
