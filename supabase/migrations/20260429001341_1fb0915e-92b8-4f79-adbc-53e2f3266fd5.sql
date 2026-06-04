CREATE OR REPLACE FUNCTION public.qa_gov_reconcile_build_plan_safe()
RETURNS TABLE (
  id_access text,
  nome_access text,
  cpf_access text,
  numero_cr_access text,
  cliente_id_correto integer,
  nome_cliente_correto text,
  cr_id_no_sistema integer,
  cliente_id_atualmente_vinculado integer,
  nome_cliente_atualmente_vinculado text,
  senha_plaintext text,
  tem_senha_sistema boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  WITH plano AS (
    SELECT * FROM public.qa_gov_reconcile_build_plan()
  ),
  cr_ids AS (SELECT cr_id_no_sistema FROM plano)
  SELECT p.*
  FROM plano p
  WHERE NOT EXISTS (
    SELECT 1 FROM qa_cadastro_cr cr2
     WHERE cr2.cliente_id = p.cliente_id_correto
       AND cr2.consolidado_em IS NULL
       AND cr2.id <> p.cr_id_no_sistema
       AND cr2.id NOT IN (SELECT cr_id_no_sistema FROM cr_ids)
  );
$$;

REVOKE ALL ON FUNCTION public.qa_gov_reconcile_build_plan_safe() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qa_gov_reconcile_build_plan_safe() TO service_role;

-- Atualiza realign atomic para usar a versão SAFE
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
  CREATE TEMP TABLE _plan ON COMMIT DROP AS
  SELECT cr_id_no_sistema AS cr_id, cliente_id_correto AS cliente_id_novo
    FROM public.qa_gov_reconcile_build_plan_safe();

  IF EXISTS (
    SELECT 1 FROM _plan GROUP BY cliente_id_novo HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Plano contém múltiplos CRs para o mesmo cliente_destino — abortando.';
  END IF;

  UPDATE public.qa_cadastro_cr
     SET cliente_id = NULL
   WHERE id IN (SELECT cr_id FROM _plan);
  GET DIAGNOSTICS v_count_phase1 = ROW_COUNT;

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