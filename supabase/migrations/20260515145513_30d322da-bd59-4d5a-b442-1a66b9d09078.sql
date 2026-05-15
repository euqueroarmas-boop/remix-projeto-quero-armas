CREATE TABLE IF NOT EXISTS public.qa_homologacao_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_codigo text NOT NULL UNIQUE,
  etapa text NOT NULL,
  servico_slug text,
  venda_id bigint,
  cliente_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qa_homologacao_sessoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_homologacao_sessoes_staff_all"
ON public.qa_homologacao_sessoes
FOR ALL
USING (public.qa_is_active_staff(auth.uid()))
WITH CHECK (public.qa_is_active_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_qa_homologacao_sessoes_codigo ON public.qa_homologacao_sessoes(sessao_codigo);