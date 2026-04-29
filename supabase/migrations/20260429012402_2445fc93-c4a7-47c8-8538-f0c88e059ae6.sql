-- Tabela global de toggles para a página Monitoramento
CREATE TABLE IF NOT EXISTS public.qa_monitoramento_configuracoes (
  id BIGSERIAL PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_monit_cfg_key ON public.qa_monitoramento_configuracoes(config_key);

-- Trigger updated_at (reusa a função update_updated_at_column se existir, senão cria local)
CREATE OR REPLACE FUNCTION public.qa_monit_cfg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_qa_monit_cfg_updated_at ON public.qa_monitoramento_configuracoes;
CREATE TRIGGER trg_qa_monit_cfg_updated_at
BEFORE UPDATE ON public.qa_monitoramento_configuracoes
FOR EACH ROW EXECUTE FUNCTION public.qa_monit_cfg_set_updated_at();

-- RLS: apenas staff QA ativa
ALTER TABLE public.qa_monitoramento_configuracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qa_monit_cfg_select_staff" ON public.qa_monitoramento_configuracoes;
CREATE POLICY "qa_monit_cfg_select_staff"
ON public.qa_monitoramento_configuracoes
FOR SELECT
TO authenticated
USING (public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "qa_monit_cfg_insert_staff" ON public.qa_monitoramento_configuracoes;
CREATE POLICY "qa_monit_cfg_insert_staff"
ON public.qa_monitoramento_configuracoes
FOR INSERT
TO authenticated
WITH CHECK (public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "qa_monit_cfg_update_staff" ON public.qa_monitoramento_configuracoes;
CREATE POLICY "qa_monit_cfg_update_staff"
ON public.qa_monitoramento_configuracoes
FOR UPDATE
TO authenticated
USING (public.qa_is_active_staff(auth.uid()))
WITH CHECK (public.qa_is_active_staff(auth.uid()));

DROP POLICY IF EXISTS "qa_monit_cfg_delete_staff" ON public.qa_monitoramento_configuracoes;
CREATE POLICY "qa_monit_cfg_delete_staff"
ON public.qa_monitoramento_configuracoes
FOR DELETE
TO authenticated
USING (public.qa_is_active_staff(auth.uid()));