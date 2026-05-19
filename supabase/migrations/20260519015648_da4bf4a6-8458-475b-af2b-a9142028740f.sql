
CREATE OR REPLACE FUNCTION public.qa_gerar_protocolo(p_venda_id INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_servico_id     INT;
  v_qa_cliente_id  INT;
  v_sigla          TEXT;
  v_ano            INT;
  v_seq            INT;
  v_numero         TEXT;
  v_existing       TEXT;
BEGIN
  SELECT numero INTO v_existing FROM qa_protocolos WHERE venda_id = p_venda_id LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  -- Schema legado: qa_itens_venda.venda_id referencia qa_vendas.id_legado, não id
  SELECT vi.servico_id, v.cliente_id
  INTO v_servico_id, v_qa_cliente_id
  FROM qa_vendas v
  LEFT JOIN qa_itens_venda vi ON vi.venda_id = v.id_legado
  WHERE v.id = p_venda_id
  ORDER BY vi.id ASC
  LIMIT 1;

  IF v_servico_id IS NULL THEN
    RAISE EXCEPTION 'venda_id % sem servico vinculado', p_venda_id;
  END IF;

  SELECT c.sigla_protocolo INTO v_sigla
  FROM qa_servicos_catalogo c
  WHERE c.servico_id = v_servico_id
  LIMIT 1;
  IF v_sigla IS NULL THEN v_sigla := 'GERAL'; END IF;

  v_ano := EXTRACT(YEAR FROM now())::INT;
  v_seq := qa_proximo_protocolo(v_sigla, v_ano);
  v_numero := 'QA-' || v_sigla || '-' || v_ano || '-' || LPAD(v_seq::TEXT, 3, '0');

  INSERT INTO qa_protocolos (
    numero, venda_id, qa_cliente_id, servico_id,
    sigla_protocolo, sequencia_ano, ano, status
  ) VALUES (
    v_numero, p_venda_id, v_qa_cliente_id, v_servico_id,
    v_sigla, v_seq, v_ano, 'aguardando_documentos'
  );

  RETURN v_numero;
END;
$$;
