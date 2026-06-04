CREATE TABLE IF NOT EXISTS public.qa_status_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id bigint NULL,
  processo_id uuid NULL,
  solicitacao_id uuid NULL,
  documento_id uuid NULL,
  origem text NOT NULL,
  entidade text NOT NULL,
  entidade_id text NOT NULL,
  campo_status text NOT NULL,
  status_anterior text NULL,
  status_novo text NULL,
  usuario_id uuid NULL,
  motivo text NULL,
  detalhes jsonb NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qa_status_eventos_origem_check
    CHECK (origem IN ('sistema','ia','equipe','cliente','webhook','cron','importacao'))
);

CREATE INDEX IF NOT EXISTS idx_qa_status_eventos_cliente ON public.qa_status_eventos (cliente_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_qa_status_eventos_entidade ON public.qa_status_eventos (entidade, entidade_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_qa_status_eventos_processo ON public.qa_status_eventos (processo_id);
CREATE INDEX IF NOT EXISTS idx_qa_status_eventos_solicitacao ON public.qa_status_eventos (solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_qa_status_eventos_documento ON public.qa_status_eventos (documento_id);
CREATE INDEX IF NOT EXISTS idx_qa_status_eventos_criado_em ON public.qa_status_eventos (criado_em DESC);

ALTER TABLE public.qa_status_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe QA pode ver eventos de status"
ON public.qa_status_eventos
FOR SELECT
TO authenticated
USING (public.qa_is_active_staff(auth.uid()));
-- Sem políticas de INSERT/UPDATE/DELETE: somente service_role escreve.