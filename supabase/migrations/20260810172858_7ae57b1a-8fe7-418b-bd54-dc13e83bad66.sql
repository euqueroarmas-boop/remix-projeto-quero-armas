CREATE TABLE public.qa_documento_acessos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id bigint,
  documento_id uuid,
  documento_tipo text,
  documento_nome text,
  acao text NOT NULL CHECK (acao IN ('visualizado','baixado','baixado_lote','rejeitado','excluido')),
  quantidade integer NOT NULL DEFAULT 1,
  usuario_id uuid,
  ip text,
  user_agent text,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  notificado_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.qa_documento_acessos TO authenticated;
GRANT ALL ON public.qa_documento_acessos TO service_role;

ALTER TABLE public.qa_documento_acessos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_documento_acessos_staff_select"
ON public.qa_documento_acessos
FOR SELECT
TO authenticated
USING (public.qa_is_active_staff(auth.uid()));

CREATE INDEX idx_qa_doc_acessos_cliente ON public.qa_documento_acessos (cliente_id, created_at DESC);
CREATE INDEX idx_qa_doc_acessos_doc ON public.qa_documento_acessos (documento_id, acao, created_at DESC);