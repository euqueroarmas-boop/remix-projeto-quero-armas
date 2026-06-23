
CREATE TABLE IF NOT EXISTS public.qa_documentos_cliente_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.qa_documentos_cliente(id) ON DELETE CASCADE,
  customer_id uuid,
  qa_cliente_id integer,
  acao text NOT NULL CHECK (acao IN ('upload','visualizado','baixado','renovado','removido','aprovado','reprovado','substituido','editado','expirou')),
  ator_tipo text NOT NULL DEFAULT 'cliente' CHECK (ator_tipo IN ('cliente','admin','sistema')),
  ator_user_id uuid,
  ator_email text,
  detalhes jsonb,
  ip_origem text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.qa_documentos_cliente_eventos TO authenticated;
GRANT ALL ON public.qa_documentos_cliente_eventos TO service_role;

ALTER TABLE public.qa_documentos_cliente_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cliente vê eventos dos próprios documentos"
ON public.qa_documentos_cliente_eventos FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.qa_documentos_cliente d
    WHERE d.id = qa_documentos_cliente_eventos.documento_id
      AND (
        d.customer_id IN (SELECT customer_id FROM public.cliente_auth_links WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::lp_app_role)
      )
  )
);

CREATE POLICY "Cliente insere eventos dos próprios documentos"
ON public.qa_documentos_cliente_eventos FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.qa_documentos_cliente d
    WHERE d.id = qa_documentos_cliente_eventos.documento_id
      AND (
        d.customer_id IN (SELECT customer_id FROM public.cliente_auth_links WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::lp_app_role)
      )
  )
);

CREATE INDEX IF NOT EXISTS idx_qa_docs_eventos_documento ON public.qa_documentos_cliente_eventos(documento_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_docs_eventos_customer ON public.qa_documentos_cliente_eventos(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_docs_eventos_acao ON public.qa_documentos_cliente_eventos(acao, created_at DESC);
