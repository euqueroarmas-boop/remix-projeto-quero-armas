
-- FASE 4.2: função de teste E2E temporária para validar fluxo do portal sob identidade do Will
CREATE OR REPLACE FUNCTION public.qa_test_fase42_run()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_will_uid uuid := '5bb58eb6-019d-406a-b544-a4b26058c959';
  v_cliente_id int;
  v_before_manual int;
  v_before_view int;
  v_will_before int;
  v_after_manual int;
  v_after_view int;
  v_will_after int;
  v_test_id bigint;
  v_dup_blocked boolean := false;
  v_modelo_sanitized boolean := false;
  v_inserted_modelo text;
  v_inserted_needs_review boolean;
  v_rls_violated boolean := false;
  v_result jsonb;
BEGIN
  -- Resolve identidade
  v_cliente_id := public.qa_current_cliente_id(v_will_uid);
  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Will sem qa_cliente_id resolvido';
  END IF;

  -- Snapshot ANTES
  SELECT COUNT(*) INTO v_before_manual FROM qa_cliente_armas_manual;
  SELECT COUNT(*) INTO v_before_view FROM qa_cliente_armas;
  SELECT COUNT(*) INTO v_will_before FROM qa_cliente_armas_manual WHERE qa_cliente_id = v_cliente_id;

  -- TESTE A: Inserir arma de teste válida
  INSERT INTO qa_cliente_armas_manual
    (qa_cliente_id, user_id, origem, sistema, tipo_arma, marca, modelo, calibre, numero_serie)
  VALUES
    (v_cliente_id, v_will_uid, 'manual', 'SINARM', 'PISTOLA', 'TESTE', 'QA TESTE PORTAL FASE42', '9MM', 'TEST-FASE42-001')
  RETURNING id, modelo, needs_review INTO v_test_id, v_inserted_modelo, v_inserted_needs_review;

  -- TESTE B: Duplicidade — tentar inserir GLOCK G25 .380 ACP novamente
  BEGIN
    INSERT INTO qa_cliente_armas_manual
      (qa_cliente_id, user_id, origem, sistema, marca, modelo, calibre)
    VALUES
      (v_cliente_id, v_will_uid, 'manual', 'SINARM', 'GLOCK', 'G25', '.380 ACP');
    -- backend permite (dedupe é só no front). Marcamos como NÃO bloqueado e removemos.
    DELETE FROM qa_cliente_armas_manual
      WHERE qa_cliente_id = v_cliente_id AND marca = 'GLOCK' AND modelo = 'G25'
        AND id <> ALL(SELECT id FROM qa_cliente_armas_manual
                       WHERE qa_cliente_id = v_cliente_id AND marca = 'GLOCK' AND modelo = 'G25'
                       ORDER BY id LIMIT 1);
    v_dup_blocked := false;
  EXCEPTION WHEN OTHERS THEN
    v_dup_blocked := true;
  END;

  -- TESTE C: Modelo numérico — trigger deve sanitizar
  INSERT INTO qa_cliente_armas_manual
    (qa_cliente_id, user_id, origem, sistema, marca, modelo, calibre, numero_serie)
  VALUES
    (v_cliente_id, v_will_uid, 'manual', 'SINARM', 'TESTE', '906761217', '9MM', 'TEST-FASE42-NUM');
  SELECT (modelo IS NULL AND needs_review = true) INTO v_modelo_sanitized
    FROM qa_cliente_armas_manual
    WHERE qa_cliente_id = v_cliente_id AND numero_serie = 'TEST-FASE42-NUM';

  -- TESTE D: RLS — tentar gravar com qa_cliente_id de outro (ID 1) como SECURITY DEFINER bypassa RLS,
  -- então testamos manualmente a expressão da policy
  v_rls_violated := NOT (
    1 = public.qa_current_cliente_id(v_will_uid)
    OR public.qa_is_active_staff(v_will_uid)
  );
  -- v_rls_violated = true => RLS bloquearia (correto: outro cliente)

  -- LIMPEZA dos registros de teste
  DELETE FROM qa_cliente_armas_manual
    WHERE qa_cliente_id = v_cliente_id
      AND (numero_serie IN ('TEST-FASE42-001','TEST-FASE42-NUM') OR marca = 'TESTE');

  -- Snapshot DEPOIS
  SELECT COUNT(*) INTO v_after_manual FROM qa_cliente_armas_manual;
  SELECT COUNT(*) INTO v_after_view FROM qa_cliente_armas;
  SELECT COUNT(*) INTO v_will_after FROM qa_cliente_armas_manual WHERE qa_cliente_id = v_cliente_id;

  v_result := jsonb_build_object(
    'will_uid', v_will_uid,
    'qa_cliente_id_resolvido', v_cliente_id,
    'snapshot_antes', jsonb_build_object(
      'manual_total', v_before_manual,
      'view_total', v_before_view,
      'will_manual', v_will_before
    ),
    'teste_A_insert_valido', jsonb_build_object(
      'id_criado', v_test_id,
      'modelo_salvo', v_inserted_modelo,
      'needs_review', v_inserted_needs_review,
      'ok', v_inserted_modelo = 'QA TESTE PORTAL FASE42'
    ),
    'teste_B_duplicidade', jsonb_build_object(
      'backend_bloqueia', v_dup_blocked,
      'observacao', 'Dedupe é responsabilidade do front (ArmaManualForm). Backend não duplica via UNIQUE constraint pois aceita variantes legítimas.'
    ),
    'teste_C_modelo_numerico', jsonb_build_object(
      'trigger_sanitizou', v_modelo_sanitized,
      'ok', v_modelo_sanitized
    ),
    'teste_D_rls', jsonb_build_object(
      'cliente_outro_seria_bloqueado', v_rls_violated,
      'ok', v_rls_violated
    ),
    'snapshot_depois', jsonb_build_object(
      'manual_total', v_after_manual,
      'view_total', v_after_view,
      'will_manual', v_will_after
    ),
    'integridade', jsonb_build_object(
      'manual_inalterado', v_after_manual = v_before_manual,
      'view_inalterada', v_after_view = v_before_view,
      'will_inalterado', v_will_after = v_will_before
    )
  );

  RETURN v_result;
END;
$$;
