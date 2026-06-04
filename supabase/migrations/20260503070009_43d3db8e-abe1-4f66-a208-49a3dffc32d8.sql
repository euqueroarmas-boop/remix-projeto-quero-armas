BEGIN;

-- Triggers legados
DROP TRIGGER IF EXISTS trg_qa_clientes_set_id_legado ON public.qa_clientes;
DROP TRIGGER IF EXISTS trg_qa_vendas_set_id_legado ON public.qa_vendas;
DROP TRIGGER IF EXISTS qa_vendas_set_id_legado_trg ON public.qa_vendas;

-- Funções legadas
DROP FUNCTION IF EXISTS public.qa_homologar_cliente CASCADE;
DROP FUNCTION IF EXISTS public.qa_reabrir_homologacao_cliente CASCADE;
DROP FUNCTION IF EXISTS public.qa_atualizar_status_homologacao_cliente CASCADE;
DROP FUNCTION IF EXISTS public.qa_load_staging_admin(jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.qa_load_staging_chunk(jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.qa_gov_reconcile_build_plan CASCADE;
DROP FUNCTION IF EXISTS public.qa_gov_reconcile_build_plan_safe CASCADE;
DROP FUNCTION IF EXISTS public.qa_gov_reconcile_realign_atomic() CASCADE;
DROP FUNCTION IF EXISTS public.qa_clientes_set_id_legado() CASCADE;
DROP FUNCTION IF EXISTS public.qa_vendas_set_id_legado() CASCADE;

COMMIT;