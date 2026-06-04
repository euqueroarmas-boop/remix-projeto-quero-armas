CREATE TABLE IF NOT EXISTS public.qa_armamentos_validacao_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.qa_armamentos_catalogo(id) ON DELETE CASCADE,
  imagem_url text NOT NULL,
  validacao_resultado text NOT NULL CHECK (validacao_resultado IN ('correta', 'incorreta')),
  confianca integer NOT NULL CHECK (confianca >= 0 AND confianca <= 100),
  motivo text,
  validado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qa_armamentos_validacao_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe QA pode ver logs de validação de imagens"
ON public.qa_armamentos_validacao_logs
FOR SELECT
TO authenticated
USING (public.qa_is_active_staff(auth.uid()));

CREATE POLICY "Equipe QA pode criar logs de validação de imagens"
ON public.qa_armamentos_validacao_logs
FOR INSERT
TO authenticated
WITH CHECK (public.qa_is_active_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_qa_armamentos_validacao_logs_item_id
ON public.qa_armamentos_validacao_logs(item_id);

CREATE INDEX IF NOT EXISTS idx_qa_armamentos_validacao_logs_validado_em
ON public.qa_armamentos_validacao_logs(validado_em DESC);