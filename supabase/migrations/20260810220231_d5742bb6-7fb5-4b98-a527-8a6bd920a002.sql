ALTER TABLE public.qa_efetiva_necessidade
  DROP CONSTRAINT IF EXISTS qa_efetiva_necessidade_status_check;

ALTER TABLE public.qa_efetiva_necessidade
  ADD CONSTRAINT qa_efetiva_necessidade_status_check
  CHECK (status IN ('coletando','aguardando_aprovacao','em_revisao','aprovado','devolvido','com_equipe','concluido'));

ALTER TABLE public.qa_efetiva_necessidade
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_por_nome text,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS devolucao_motivo text;

CREATE TABLE IF NOT EXISTS public.qa_efetiva_necessidade_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  efetiva_id uuid NOT NULL REFERENCES public.qa_efetiva_necessidade(id) ON DELETE CASCADE,
  cliente_id bigint,
  acao text NOT NULL CHECK (acao IN ('aceite_cliente','enviado_revisao','aprovado_equipe','devolvido_equipe','reaberto')),
  status_anterior text,
  status_novo text,
  autor_tipo text NOT NULL DEFAULT 'equipe' CHECK (autor_tipo IN ('cliente','equipe','sistema')),
  autor_id uuid,
  autor_nome text,
  observacao text,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_ef_auditoria_efetiva ON public.qa_efetiva_necessidade_auditoria(efetiva_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_ef_auditoria_cliente ON public.qa_efetiva_necessidade_auditoria(cliente_id, created_at DESC);

GRANT SELECT ON public.qa_efetiva_necessidade_auditoria TO authenticated;
GRANT ALL ON public.qa_efetiva_necessidade_auditoria TO service_role;

ALTER TABLE public.qa_efetiva_necessidade_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe autenticada le auditoria da efetiva necessidade"
  ON public.qa_efetiva_necessidade_auditoria
  FOR SELECT TO authenticated
  USING (true);