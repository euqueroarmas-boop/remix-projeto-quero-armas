CREATE TABLE IF NOT EXISTS public.qa_suporte_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid,
  cliente_email text,
  cliente_nome text,
  operador_user_id uuid,
  operador_email text,
  motivo text NOT NULL,
  processo_ref text,
  escopo text NOT NULL DEFAULT 'leitura_e_documentos',
  ip text,
  user_agent text,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  encerrado_em timestamptz,
  acoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  resumo text,
  email_inicio_enviado boolean NOT NULL DEFAULT false,
  email_fim_enviado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qa_suporte_sessoes_cliente_idx ON public.qa_suporte_sessoes (cliente_id, iniciado_em DESC);
CREATE INDEX IF NOT EXISTS qa_suporte_sessoes_operador_idx ON public.qa_suporte_sessoes (operador_user_id, iniciado_em DESC);

GRANT SELECT ON public.qa_suporte_sessoes TO authenticated;
GRANT ALL ON public.qa_suporte_sessoes TO service_role;

ALTER TABLE public.qa_suporte_sessoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins podem ver sessoes de suporte" ON public.qa_suporte_sessoes;
CREATE POLICY "Admins podem ver sessoes de suporte"
ON public.qa_suporte_sessoes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::lp_app_role));