
-- Funções SECURITY DEFINER para destravar cadastro (usadas pela edge function qa-admin-destravar-cadastro)

CREATE OR REPLACE FUNCTION public.qa_admin_destravar_cancel_pending_sale(p_cliente_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids integer[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT array_agg(id) INTO v_ids
  FROM public.qa_vendas
  WHERE cliente_id = p_cliente_id AND cobranca_confirmada_em IS NULL;

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'count', 0);
  END IF;

  PERFORM set_config('app.allow_venda_evento_delete', 'on', true);
  PERFORM set_config('qa.allow_total_client_delete', '1', true);

  DELETE FROM public.qa_contract_aceites_log WHERE venda_id = ANY(v_ids);
  DELETE FROM public.qa_contracts WHERE venda_id = ANY(v_ids);
  DELETE FROM public.qa_venda_eventos WHERE venda_id = ANY(v_ids);
  DELETE FROM public.qa_itens_venda WHERE venda_id = ANY(v_ids);
  DELETE FROM public.qa_vendas WHERE id = ANY(v_ids);

  RETURN jsonb_build_object('ok', true, 'count', array_length(v_ids, 1), 'ids', v_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.qa_admin_destravar_reset_total(p_cliente_id integer, p_confirm_cpf text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente RECORD;
  v_venda_ids integer[];
  v_venda_paga boolean;
  v_contrato_assinado boolean;
  v_email_norm text;
  v_cpf_norm text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id, nome_completo, cpf, email, user_id
    INTO v_cliente
  FROM public.qa_clientes
  WHERE id = p_cliente_id;

  IF v_cliente.id IS NULL THEN
    RAISE EXCEPTION 'cliente_nao_encontrado';
  END IF;

  v_cpf_norm := regexp_replace(coalesce(v_cliente.cpf,''), '\D', '', 'g');
  IF v_cpf_norm = '' OR regexp_replace(coalesce(p_confirm_cpf,''), '\D', '', 'g') <> v_cpf_norm THEN
    RAISE EXCEPTION 'cpf_confirmacao_invalida';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.qa_vendas
    WHERE cliente_id = p_cliente_id AND cobranca_confirmada_em IS NOT NULL
  ) INTO v_venda_paga;
  IF v_venda_paga THEN RAISE EXCEPTION 'venda_paga'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.qa_contracts
    WHERE client_id = p_cliente_id AND signed_at IS NOT NULL
  ) INTO v_contrato_assinado;
  IF v_contrato_assinado THEN RAISE EXCEPTION 'contrato_assinado'; END IF;

  SELECT array_agg(id) INTO v_venda_ids
  FROM public.qa_vendas WHERE cliente_id = p_cliente_id;

  v_email_norm := lower(trim(coalesce(v_cliente.email, '')));

  PERFORM set_config('app.allow_venda_evento_delete', 'on', true);
  PERFORM set_config('qa.allow_total_client_delete', '1', true);

  IF v_venda_ids IS NOT NULL AND array_length(v_venda_ids,1) IS NOT NULL THEN
    DELETE FROM public.qa_contract_aceites_log WHERE venda_id = ANY(v_venda_ids);
    DELETE FROM public.qa_contracts WHERE venda_id = ANY(v_venda_ids);
    DELETE FROM public.qa_venda_eventos WHERE venda_id = ANY(v_venda_ids);
    DELETE FROM public.qa_itens_venda WHERE venda_id = ANY(v_venda_ids);
    DELETE FROM public.qa_vendas WHERE id = ANY(v_venda_ids);
  END IF;

  DELETE FROM public.cliente_auth_links WHERE qa_cliente_id = p_cliente_id;
  IF v_cliente.user_id IS NOT NULL THEN
    DELETE FROM public.qa_usuarios_perfis WHERE user_id = v_cliente.user_id;
    DELETE FROM public.cliente_auth_links WHERE user_id = v_cliente.user_id;
  END IF;

  IF v_cpf_norm <> '' THEN
    DELETE FROM public.qa_cadastros_publicos WHERE regexp_replace(coalesce(cpf,''), '\D', '', 'g') = v_cpf_norm;
  END IF;
  IF v_email_norm <> '' THEN
    DELETE FROM public.qa_cadastros_publicos WHERE lower(trim(coalesce(email,''))) = v_email_norm;
  END IF;

  DELETE FROM public.qa_clientes WHERE id = p_cliente_id;

  RETURN jsonb_build_object(
    'ok', true,
    'cliente_id', p_cliente_id,
    'vendas_removidas', coalesce(array_length(v_venda_ids,1), 0),
    'user_id', v_cliente.user_id,
    'email', v_email_norm
  );
END;
$$;

REVOKE ALL ON FUNCTION public.qa_admin_destravar_cancel_pending_sale(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.qa_admin_destravar_reset_total(integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qa_admin_destravar_cancel_pending_sale(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.qa_admin_destravar_reset_total(integer, text) TO service_role;
