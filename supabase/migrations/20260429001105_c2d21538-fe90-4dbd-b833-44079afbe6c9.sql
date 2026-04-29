CREATE OR REPLACE FUNCTION public.qa_gov_reconcile_realign_atomic()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_count_phase1 int;
  v_count_phase2 int;
BEGIN
  -- Tabela temporária com o plano (cr_id -> cliente_id_correto)
  CREATE TEMP TABLE _plan ON COMMIT DROP AS
  SELECT cr_id_no_sistema AS cr_id, cliente_id_correto AS cliente_id_novo
    FROM public.qa_gov_reconcile_build_plan();

  -- Validação: nenhum cliente_id_novo deve aparecer mais de uma vez
  IF EXISTS (
    SELECT 1 FROM _plan GROUP BY cliente_id_novo HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Plano contém múltiplos CRs para o mesmo cliente_destino — abortando.';
  END IF;

  -- FASE 1: detach (mover CRs do plano para cliente_id NULL — sai do índice parcial)
  UPDATE public.qa_cadastro_cr
     SET cliente_id = NULL
   WHERE id IN (SELECT cr_id FROM _plan);
  GET DIAGNOSTICS v_count_phase1 = ROW_COUNT;

  -- FASE 2: re-attach com o cliente correto
  UPDATE public.qa_cadastro_cr cr
     SET cliente_id = p.cliente_id_novo
    FROM _plan p
   WHERE cr.id = p.cr_id;
  GET DIAGNOSTICS v_count_phase2 = ROW_COUNT;

  RETURN jsonb_build_object(
    'phase1_detached', v_count_phase1,
    'phase2_attached', v_count_phase2
  );
END $$;

REVOKE ALL ON FUNCTION public.qa_gov_reconcile_realign_atomic() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qa_gov_reconcile_realign_atomic() TO service_role;