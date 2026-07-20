
-- ============================================================
-- P2 — Dedupe de alertas de acervo / CRAF / autorização
-- ============================================================
CREATE TABLE IF NOT EXISTS public.qa_acervo_alertas_enviados (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES public.qa_clientes(id) ON DELETE CASCADE,
  item_tipo TEXT NOT NULL,           -- 'arma_manual' | 'craf' | 'autorizacao' | 'acervo'
  item_id TEXT,                       -- id textual do item (pode ser numérico ou uuid)
  divergencia_tipo TEXT NOT NULL,    -- 'arma_sem_craf' | 'craf_sem_arma' | ...
  template_name TEXT NOT NULL,
  hash_estado TEXT NOT NULL,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_acervo_alertas_dedupe
  ON public.qa_acervo_alertas_enviados(cliente_id, item_tipo, COALESCE(item_id,''), divergencia_tipo, template_name, hash_estado);

CREATE INDEX IF NOT EXISTS idx_qa_acervo_alertas_cliente
  ON public.qa_acervo_alertas_enviados(cliente_id);

GRANT SELECT ON public.qa_acervo_alertas_enviados TO authenticated;
GRANT ALL ON public.qa_acervo_alertas_enviados TO service_role;

ALTER TABLE public.qa_acervo_alertas_enviados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_acervo_alertas_admin_select"
  ON public.qa_acervo_alertas_enviados FOR SELECT TO authenticated
  USING (qa_has_qa_perfil(auth.uid(), ARRAY['administrador'::text]));

-- ============================================================
-- P4 — Dedupe de alertas de consistência de GTE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.qa_gte_consistencia_alertas_enviados (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES public.qa_clientes(id) ON DELETE CASCADE,
  gte_documento_id UUID,
  divergencia_tipo TEXT NOT NULL,
  template_name TEXT NOT NULL,
  hash_estado TEXT NOT NULL,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_gte_consistencia_alertas_dedupe
  ON public.qa_gte_consistencia_alertas_enviados(cliente_id, COALESCE(gte_documento_id, '00000000-0000-0000-0000-000000000000'::uuid), divergencia_tipo, template_name, hash_estado);

CREATE INDEX IF NOT EXISTS idx_qa_gte_consistencia_alertas_cliente
  ON public.qa_gte_consistencia_alertas_enviados(cliente_id);

GRANT SELECT ON public.qa_gte_consistencia_alertas_enviados TO authenticated;
GRANT ALL ON public.qa_gte_consistencia_alertas_enviados TO service_role;

ALTER TABLE public.qa_gte_consistencia_alertas_enviados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_gte_consistencia_alertas_admin_select"
  ON public.qa_gte_consistencia_alertas_enviados FOR SELECT TO authenticated
  USING (qa_has_qa_perfil(auth.uid(), ARRAY['administrador'::text]));

-- ============================================================
-- P5 — Dedupe do hook de documento incompatível
-- ============================================================
CREATE TABLE IF NOT EXISTS public.qa_doc_incompat_alertas_enviados (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_id INTEGER,
  processo_id UUID,
  documento_id UUID NOT NULL,
  hash_estado TEXT NOT NULL,
  template_name TEXT NOT NULL DEFAULT 'documento-incompativel-processo',
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_doc_incompat_alertas_dedupe
  ON public.qa_doc_incompat_alertas_enviados(documento_id, hash_estado, template_name);

CREATE INDEX IF NOT EXISTS idx_qa_doc_incompat_alertas_cliente
  ON public.qa_doc_incompat_alertas_enviados(cliente_id);

GRANT SELECT ON public.qa_doc_incompat_alertas_enviados TO authenticated;
GRANT ALL ON public.qa_doc_incompat_alertas_enviados TO service_role;

ALTER TABLE public.qa_doc_incompat_alertas_enviados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_doc_incompat_alertas_admin_select"
  ON public.qa_doc_incompat_alertas_enviados FOR SELECT TO authenticated
  USING (qa_has_qa_perfil(auth.uid(), ARRAY['administrador'::text]));
