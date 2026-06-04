CREATE OR REPLACE FUNCTION public.qa_venda_excluir_total(p_venda_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venda public.qa_vendas%ROWTYPE;
  v_venda_ids integer[] := ARRAY[]::integer[];
  v_venda_legado_ids integer[] := ARRAY[]::integer[];
  v_contract_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.qa_is_active_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas equipe operacional pode excluir vendas.';
  END IF;

  SELECT * INTO v_venda
  FROM public.qa_vendas
  WHERE id = p_venda_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Venda não encontrada.');
  END IF;

  v_venda_ids := ARRAY[v_venda.id];
  v_venda_legado_ids := ARRAY[COALESCE(v_venda.id_legado, v_venda.id)];

  PERFORM set_config('qa.allow_total_client_delete', '1', true);
  PERFORM set_config('app.allow_venda_evento_delete', 'on', true);

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_contract_ids
  FROM public.qa_contracts
  WHERE venda_id = ANY(v_venda_ids)
     OR venda_id = ANY(v_venda_legado_ids);

  IF cardinality(v_contract_ids) > 0 THEN
    DELETE FROM public.qa_contract_events WHERE contract_id = ANY(v_contract_ids);
    DELETE FROM public.qa_contract_signatures WHERE contract_id = ANY(v_contract_ids);
    DELETE FROM public.qa_contract_items WHERE contract_id = ANY(v_contract_ids);
  END IF;

  DELETE FROM public.qa_contract_items
   WHERE venda_id = ANY(v_venda_ids)
      OR venda_id = ANY(v_venda_legado_ids);

  DELETE FROM public.qa_contracts
   WHERE id = ANY(v_contract_ids)
      OR venda_id = ANY(v_venda_ids)
      OR venda_id = ANY(v_venda_legado_ids);

  DELETE FROM public.qa_venda_eventos
   WHERE venda_id = ANY(v_venda_ids)
      OR venda_id = ANY(v_venda_legado_ids);

  DELETE FROM public.qa_itens_venda
   WHERE venda_id = ANY(v_venda_ids)
      OR venda_id = ANY(v_venda_legado_ids);

  IF to_regclass('public.qa_pagamento_auditoria') IS NOT NULL THEN
    DELETE FROM public.qa_pagamento_auditoria
     WHERE venda_id = ANY(v_venda_ids)
        OR venda_id = ANY(v_venda_legado_ids);
  END IF;

  IF to_regclass('public.qa_asaas_cobrancas') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'qa_asaas_cobrancas' AND column_name = 'venda_id') THEN
      EXECUTE 'DELETE FROM public.qa_asaas_cobrancas WHERE venda_id = ANY($1) OR venda_id = ANY($2)'
      USING v_venda_ids, v_venda_legado_ids;
    END IF;
  END IF;

  IF to_regclass('public.qa_asaas_webhook_events') IS NOT NULL THEN
    DELETE FROM public.qa_asaas_webhook_events
     WHERE venda_id = ANY(v_venda_ids)
        OR venda_id = ANY(v_venda_legado_ids);
  END IF;

  IF to_regclass('public.qa_homologacao_sessoes') IS NOT NULL THEN
    DELETE FROM public.qa_homologacao_sessoes
     WHERE venda_id = ANY(v_venda_ids)
        OR venda_id = ANY(v_venda_legado_ids);
  END IF;

  IF to_regclass('public.qa_homologacao_logs') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'qa_homologacao_logs' AND column_name = 'venda_id') THEN
    EXECUTE 'DELETE FROM public.qa_homologacao_logs WHERE venda_id = ANY($1) OR venda_id = ANY($2)'
    USING v_venda_ids, v_venda_legado_ids;
  END IF;

  IF to_regclass('public.qa_processos') IS NOT NULL THEN
    DELETE FROM public.qa_processos
     WHERE venda_id = ANY(v_venda_ids)
        OR venda_id = ANY(v_venda_legado_ids);
  END IF;

  DELETE FROM public.qa_vendas
   WHERE id = v_venda.id;

  RETURN jsonb_build_object('ok', true, 'venda_id', v_venda.id, 'id_legado', v_venda.id_legado);
END;
$$;

GRANT EXECUTE ON FUNCTION public.qa_venda_excluir_total(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qa_venda_excluir_total(integer) TO service_role;