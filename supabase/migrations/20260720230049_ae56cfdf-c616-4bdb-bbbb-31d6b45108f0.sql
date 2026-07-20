
CREATE TABLE IF NOT EXISTS public.qa_acervo_alertas_enviados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id BIGINT NOT NULL,
  item_tipo TEXT NOT NULL,
  item_id TEXT NOT NULL,
  divergencia_tipo TEXT NOT NULL,
  template_name TEXT NOT NULL,
  hash_estado TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS qa_acervo_alertas_enviados_dedupe
  ON public.qa_acervo_alertas_enviados
  (cliente_id, item_tipo, item_id, divergencia_tipo, template_name, hash_estado);
CREATE INDEX IF NOT EXISTS qa_acervo_alertas_enviados_cli_idx
  ON public.qa_acervo_alertas_enviados (cliente_id);
GRANT SELECT ON public.qa_acervo_alertas_enviados TO authenticated;
GRANT ALL ON public.qa_acervo_alertas_enviados TO service_role;
ALTER TABLE public.qa_acervo_alertas_enviados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acervo_alertas_admin_select" ON public.qa_acervo_alertas_enviados
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.qa_gte_consistencia_alertas_enviados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id BIGINT NOT NULL,
  gte_documento_id UUID NOT NULL,
  divergencia_tipo TEXT NOT NULL,
  template_name TEXT NOT NULL,
  hash_estado TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS qa_gte_consist_alertas_dedupe
  ON public.qa_gte_consistencia_alertas_enviados
  (gte_documento_id, divergencia_tipo, template_name, hash_estado);
CREATE INDEX IF NOT EXISTS qa_gte_consist_alertas_cli_idx
  ON public.qa_gte_consistencia_alertas_enviados (cliente_id);
GRANT SELECT ON public.qa_gte_consistencia_alertas_enviados TO authenticated;
GRANT ALL ON public.qa_gte_consistencia_alertas_enviados TO service_role;
ALTER TABLE public.qa_gte_consistencia_alertas_enviados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gte_consist_alertas_admin_select" ON public.qa_gte_consistencia_alertas_enviados
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.qa_doc_incompat_alertas_enviados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id BIGINT,
  processo_id UUID,
  documento_id UUID NOT NULL,
  template_name TEXT NOT NULL,
  hash_estado TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS qa_doc_incompat_alertas_dedupe
  ON public.qa_doc_incompat_alertas_enviados
  (documento_id, template_name, hash_estado);
CREATE INDEX IF NOT EXISTS qa_doc_incompat_alertas_cli_idx
  ON public.qa_doc_incompat_alertas_enviados (cliente_id);
GRANT SELECT ON public.qa_doc_incompat_alertas_enviados TO authenticated;
GRANT ALL ON public.qa_doc_incompat_alertas_enviados TO service_role;
ALTER TABLE public.qa_doc_incompat_alertas_enviados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc_incompat_alertas_admin_select" ON public.qa_doc_incompat_alertas_enviados
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
