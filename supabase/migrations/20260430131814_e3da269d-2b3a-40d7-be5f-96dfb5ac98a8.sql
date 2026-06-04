-- =========================================================================
-- 1) qa_clientes: vínculo reverso ao formulário público
-- =========================================================================
ALTER TABLE public.qa_clientes
  ADD COLUMN IF NOT EXISTS cadastro_publico_id uuid NULL,
  ADD COLUMN IF NOT EXISTS cadastro_publico_aplicado_em timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_qa_clientes_cadastro_publico_id
  ON public.qa_clientes (cadastro_publico_id);

-- =========================================================================
-- 2) qa_documentos_cliente: vínculo ao formulário público de origem
-- =========================================================================
ALTER TABLE public.qa_documentos_cliente
  ADD COLUMN IF NOT EXISTS cadastro_publico_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_qa_doccli_cadastro_publico_id
  ON public.qa_documentos_cliente (cadastro_publico_id);

-- =========================================================================
-- 3) qa_solicitacoes_servico — fonte canônica do "serviço solicitado"
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.qa_solicitacoes_servico (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id          integer NOT NULL,
  cadastro_publico_id uuid NULL,
  servico_id          integer NULL,
  service_slug        text NOT NULL,
  service_name        text NOT NULL,
  origem              text NOT NULL DEFAULT 'manual',
  status_servico      text NOT NULL DEFAULT 'aguardando_contratacao',
  status_financeiro   text NOT NULL DEFAULT 'sem_cobranca_vinculada',
  status_processo     text NOT NULL DEFAULT 'processo_nao_aberto',
  pendente_classificacao boolean NOT NULL DEFAULT false,
  servico_interesse_raw text NULL,
  venda_id            integer NULL,
  item_venda_id       integer NULL,
  processo_id         integer NULL,
  observacoes         text NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_solicitacoes_cli_cad_slug
  ON public.qa_solicitacoes_servico (cliente_id, cadastro_publico_id, service_slug)
  WHERE cadastro_publico_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_solicitacoes_cli_slug_manual
  ON public.qa_solicitacoes_servico (cliente_id, service_slug)
  WHERE cadastro_publico_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_qa_solicitacoes_cliente_id
  ON public.qa_solicitacoes_servico (cliente_id);
CREATE INDEX IF NOT EXISTS idx_qa_solicitacoes_cadastro_publico
  ON public.qa_solicitacoes_servico (cadastro_publico_id);
CREATE INDEX IF NOT EXISTS idx_qa_solicitacoes_status
  ON public.qa_solicitacoes_servico (status_servico);

CREATE OR REPLACE FUNCTION public.qa_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_solicitacoes_updated_at ON public.qa_solicitacoes_servico;
CREATE TRIGGER trg_qa_solicitacoes_updated_at
BEFORE UPDATE ON public.qa_solicitacoes_servico
FOR EACH ROW EXECUTE FUNCTION public.qa_set_updated_at();

ALTER TABLE public.qa_solicitacoes_servico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qa_solicitacoes_staff_select ON public.qa_solicitacoes_servico;
CREATE POLICY qa_solicitacoes_staff_select
  ON public.qa_solicitacoes_servico
  FOR SELECT
  TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS qa_solicitacoes_staff_insert ON public.qa_solicitacoes_servico;
CREATE POLICY qa_solicitacoes_staff_insert
  ON public.qa_solicitacoes_servico
  FOR INSERT
  TO authenticated
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS qa_solicitacoes_staff_update ON public.qa_solicitacoes_servico;
CREATE POLICY qa_solicitacoes_staff_update
  ON public.qa_solicitacoes_servico
  FOR UPDATE
  TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS qa_solicitacoes_admin_delete ON public.qa_solicitacoes_servico;
CREATE POLICY qa_solicitacoes_admin_delete
  ON public.qa_solicitacoes_servico
  FOR DELETE
  TO authenticated
  USING (public.qa_has_qa_perfil(auth.uid(), ARRAY['administrador']));

-- =========================================================================
-- 4) qa_cadastro_publico_audit — log de ações sobre cadastros públicos
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.qa_cadastro_publico_audit (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cadastro_publico_id uuid NOT NULL,
  cliente_id          integer NULL,
  cpf_normalizado     text NULL,
  acao                text NOT NULL,
  campo               text NULL,
  valor_anterior      text NULL,
  valor_novo          text NULL,
  divergencia         boolean NOT NULL DEFAULT false,
  service_slug        text NULL,
  user_id             uuid NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_cad_audit_cad
  ON public.qa_cadastro_publico_audit (cadastro_publico_id);
CREATE INDEX IF NOT EXISTS idx_qa_cad_audit_cli
  ON public.qa_cadastro_publico_audit (cliente_id);
CREATE INDEX IF NOT EXISTS idx_qa_cad_audit_created
  ON public.qa_cadastro_publico_audit (created_at DESC);

ALTER TABLE public.qa_cadastro_publico_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qa_cad_audit_staff_select ON public.qa_cadastro_publico_audit;
CREATE POLICY qa_cad_audit_staff_select
  ON public.qa_cadastro_publico_audit
  FOR SELECT
  TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS qa_cad_audit_staff_insert ON public.qa_cadastro_publico_audit;
CREATE POLICY qa_cad_audit_staff_insert
  ON public.qa_cadastro_publico_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (public.qa_is_active_staff(auth.uid()));