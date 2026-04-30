CREATE OR REPLACE FUNCTION public.qa_venda_corrigir_valor(p_venda_id integer, p_valor_corrigido numeric, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_venda  public.qa_vendas%ROWTYPE;
  v_dup    boolean := false;
  v_cli_real integer;
  v_motivo text := btrim(COALESCE(p_motivo, 'CORREÇÃO OPERACIONAL DE VALOR'));
BEGIN
  IF NOT public.qa_is_active_staff(v_uid) THEN
    RAISE EXCEPTION 'Apenas Equipe Operacional pode corrigir valor.';
  END IF;
  IF p_venda_id IS NULL OR p_valor_corrigido IS NULL THEN
    RAISE EXCEPTION 'p_venda_id e p_valor_corrigido são obrigatórios';
  END IF;
  IF length(v_motivo) < 3 THEN
    RAISE EXCEPTION 'Motivo é obrigatório (mínimo 3 caracteres).';
  END IF;
  IF p_valor_corrigido <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser maior que zero';
  END IF;

  SELECT * INTO v_venda FROM public.qa_vendas WHERE id = p_venda_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda % não encontrada', p_venda_id;
  END IF;

  v_cli_real := public.qa_resolve_cliente_id_real(v_venda.cliente_id);

  IF v_venda.valor_aprovado IS NOT DISTINCT FROM p_valor_corrigido
     AND v_venda.valor_informado_cliente IS NOT DISTINCT FROM p_valor_corrigido
     AND v_venda.valor_a_pagar IS NOT DISTINCT FROM p_valor_corrigido
     AND v_venda.motivo_correcao IS NOT DISTINCT FROM v_motivo
     AND v_venda.status_validacao_valor = 'corrigido' THEN
    v_dup := true;
  ELSE
    UPDATE public.qa_vendas
       SET valor_aprovado          = p_valor_corrigido,
           valor_informado_cliente = p_valor_corrigido,
           valor_a_pagar           = p_valor_corrigido,
           motivo_correcao         = v_motivo,
           status_validacao_valor  = 'corrigido',
           validacao_valor_atualizado_em = now()
     WHERE id = p_venda_id;

    INSERT INTO public.qa_venda_eventos (
      venda_id, cliente_id, qa_cliente_id, tipo_evento, descricao, dados_json, ator, user_id
    ) VALUES (
      p_venda_id, v_venda.cliente_id, v_cli_real,
      'valor_corrigido',
      format('Valor corrigido para R$ %s. Motivo: %s', p_valor_corrigido::text, v_motivo),
      jsonb_build_object(
        'valor_corrigido', p_valor_corrigido,
        'valor_anterior_informado', v_venda.valor_informado_cliente,
        'valor_anterior_aprovado', v_venda.valor_aprovado,
        'valor_anterior_a_pagar', v_venda.valor_a_pagar,
        'motivo', v_motivo
      ),
      'equipe_operacional', v_uid
    );
  END IF;

  RETURN jsonb_build_object(
    'venda_id', p_venda_id,
    'valor_aprovado', p_valor_corrigido,
    'valor_informado_cliente', p_valor_corrigido,
    'valor_a_pagar', p_valor_corrigido,
    'status_validacao_valor', 'corrigido',
    'evento_duplicado_ignorado', v_dup
  );
END;
$function$;

UPDATE public.qa_vendas
   SET valor_aprovado = COALESCE(NULLIF(valor_aprovado, 0), valor_informado_cliente, valor_a_pagar),
       valor_informado_cliente = COALESCE(NULLIF(valor_informado_cliente, 0), valor_a_pagar),
       valor_a_pagar = COALESCE(NULLIF(valor_a_pagar, 0), valor_informado_cliente, valor_aprovado)
 WHERE (id_legado IN (138, 139) OR id IN (138, 139))
   AND COALESCE(valor_aprovado, 0) = 0;