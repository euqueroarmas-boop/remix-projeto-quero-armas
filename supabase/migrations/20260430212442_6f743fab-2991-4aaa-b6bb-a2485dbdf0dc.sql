
-- 1) Trigger para preencher valor_informado_cliente automaticamente em novas vendas
CREATE OR REPLACE FUNCTION public.qa_vendas_preencher_valor_informado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Garante histórico do valor original informado pelo cliente
  IF NEW.valor_informado_cliente IS NULL THEN
    NEW.valor_informado_cliente := NEW.valor_a_pagar;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_vendas_preencher_valor_informado ON public.qa_vendas;
CREATE TRIGGER trg_qa_vendas_preencher_valor_informado
BEFORE INSERT ON public.qa_vendas
FOR EACH ROW
EXECUTE FUNCTION public.qa_vendas_preencher_valor_informado();

-- 2) Reforço na função de correção: garante que valor_informado_cliente tenha histórico
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
  v_valor_informado_efetivo numeric;
BEGIN
  IF NOT public.qa_is_active_staff(v_uid) THEN
    RAISE EXCEPTION 'Apenas Equipe Operacional pode corrigir valor.';
  END IF;
  IF p_venda_id IS NULL OR p_valor_corrigido IS NULL THEN
    RAISE EXCEPTION 'p_venda_id e p_valor_corrigido são obrigatórios';
  END IF;
  IF p_motivo IS NULL OR length(btrim(p_motivo)) < 3 THEN
    RAISE EXCEPTION 'Motivo é obrigatório (mínimo 3 caracteres).';
  END IF;
  IF p_valor_corrigido < 0 THEN
    RAISE EXCEPTION 'Valor não pode ser negativo';
  END IF;

  SELECT * INTO v_venda FROM public.qa_vendas WHERE id = p_venda_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda % não encontrada', p_venda_id;
  END IF;

  v_cli_real := public.qa_resolve_cliente_id_real(v_venda.cliente_id);

  -- Histórico: se valor_informado_cliente estiver vazio, usar valor_a_pagar como base
  v_valor_informado_efetivo := COALESCE(v_venda.valor_informado_cliente, v_venda.valor_a_pagar);

  IF v_venda.valor_aprovado IS NOT DISTINCT FROM p_valor_corrigido
     AND v_venda.motivo_correcao IS NOT DISTINCT FROM btrim(p_motivo)
     AND v_venda.status_validacao_valor = 'corrigido' THEN
    v_dup := true;
  ELSE
    UPDATE public.qa_vendas
       SET valor_aprovado          = p_valor_corrigido,
           valor_informado_cliente = COALESCE(valor_informado_cliente, valor_a_pagar),
           motivo_correcao         = btrim(p_motivo),
           status_validacao_valor  = 'corrigido',
           validacao_valor_atualizado_em = now()
     WHERE id = p_venda_id;

    INSERT INTO public.qa_venda_eventos (
      venda_id, cliente_id, qa_cliente_id, tipo_evento, descricao, dados_json, ator, user_id
    ) VALUES (
      p_venda_id, v_venda.cliente_id, v_cli_real,
      'valor_corrigido',
      format('Valor corrigido para R$ %s. Motivo: %s', p_valor_corrigido::text, btrim(p_motivo)),
      jsonb_build_object(
        'valor_corrigido', p_valor_corrigido,
        'valor_anterior_informado', v_valor_informado_efetivo,
        'valor_anterior_aprovado', v_venda.valor_aprovado,
        'motivo', btrim(p_motivo)
      ),
      'equipe_operacional', v_uid
    );
  END IF;

  RETURN jsonb_build_object(
    'venda_id', p_venda_id,
    'valor_aprovado', p_valor_corrigido,
    'valor_informado_cliente', v_valor_informado_efetivo,
    'status_validacao_valor', 'corrigido',
    'evento_duplicado_ignorado', v_dup
  );
END;
$function$;

-- 3) Backfill: para todas as vendas existentes sem valor_informado_cliente, copiar de valor_a_pagar
UPDATE public.qa_vendas
   SET valor_informado_cliente = valor_a_pagar
 WHERE valor_informado_cliente IS NULL
   AND valor_a_pagar IS NOT NULL;
