CREATE OR REPLACE FUNCTION public.qa_arsenal_criar_venda_pendente(
  p_qa_cliente_id integer,
  p_catalogo_slug text,
  p_valor numeric,
  p_observacoes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cli_legado integer;
  v_servico_id integer;
  v_existente_id integer;
  v_venda_id integer;
  v_venda_id_legado integer;
BEGIN
  IF p_qa_cliente_id IS NULL THEN
    RAISE EXCEPTION 'qa_cliente_id obrigatório';
  END IF;
  IF p_catalogo_slug IS NULL OR length(btrim(p_catalogo_slug))=0 THEN
    RAISE EXCEPTION 'catalogo_slug obrigatório';
  END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN
    p_valor := 1;
  END IF;

  SELECT COALESCE(id_legado, id) INTO v_cli_legado
    FROM public.qa_clientes WHERE id = p_qa_cliente_id;
  IF v_cli_legado IS NULL THEN
    RAISE EXCEPTION 'cliente % não encontrado', p_qa_cliente_id;
  END IF;

  SELECT servico_id INTO v_servico_id
    FROM public.qa_servicos_catalogo
   WHERE slug = p_catalogo_slug AND ativo = true;
  IF v_servico_id IS NULL THEN
    RAISE EXCEPTION 'serviço % não disponível para contratação online', p_catalogo_slug;
  END IF;

  SELECT v.id INTO v_existente_id
    FROM public.qa_vendas v
    JOIN public.qa_itens_venda iv ON iv.venda_id = v.id_legado
   WHERE v.cliente_id = v_cli_legado
     AND iv.servico_id = v_servico_id
     AND COALESCE(v.status_validacao_valor,'aguardando_validacao') IN ('aguardando_validacao','corrigido')
     AND upper(btrim(coalesce(v.status,''))) IN ('NÃO PAGOU','NAO PAGOU','À INICIAR','A INICIAR')
   ORDER BY v.created_at DESC LIMIT 1;

  IF v_existente_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'ja_existia', true, 'venda_id', v_existente_id);
  END IF;

  INSERT INTO public.qa_vendas (
    cliente_id, status, valor_a_pagar, valor_aberto, valor_informado_cliente,
    status_validacao_valor, origem_proposta, data_cadastro, created_at
  ) VALUES (
    v_cli_legado, 'NÃO PAGOU', p_valor, p_valor, p_valor,
    'aguardando_validacao', 'cadastro_arsenal_publico', now(), now()
  ) RETURNING id, id_legado INTO v_venda_id, v_venda_id_legado;

  INSERT INTO public.qa_itens_venda (venda_id, servico_id, valor, status)
  VALUES (v_venda_id_legado, v_servico_id, p_valor, 'À INICIAR');

  RETURN jsonb_build_object('ok', true, 'venda_id', v_venda_id, 'ja_existia', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.qa_arsenal_criar_venda_pendente(integer, text, numeric, text) TO service_role;

-- Backfill Willian
SELECT public.qa_arsenal_criar_venda_pendente(118, 'concessao-cr', 1239.00,
  'Backfill: contratação iniciada no cadastro Arsenal — aguardando validação da equipe.');
