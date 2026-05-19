
CREATE OR REPLACE FUNCTION public.qa_pos_pagamento_protocolar(p_processo_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proc record;
  v_numero TEXT;
  v_doc_status_inseridos INT := 0;
BEGIN
  IF p_processo_id IS NULL THEN
    RAISE EXCEPTION 'p_processo_id é obrigatório';
  END IF;

  SELECT id, venda_id, servico_id, cliente_id, pagamento_status
    INTO v_proc
    FROM qa_processos
   WHERE id = p_processo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processo % não encontrado', p_processo_id USING ERRCODE = 'P0002';
  END IF;

  IF v_proc.venda_id IS NULL THEN
    -- Processo sem venda (gratuito/admin) — não gera protocolo
    RETURN jsonb_build_object(
      'processo_id', p_processo_id,
      'protocolo_numero', NULL,
      'docs_producao_inseridos', 0,
      'skipped_reason', 'sem_venda_vinculada'
    );
  END IF;

  -- Gera protocolo (idempotente)
  BEGIN
    v_numero := qa_gerar_protocolo(v_proc.venda_id);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO qa_processo_eventos (processo_id, tipo_evento, descricao, ator)
    VALUES (p_processo_id, 'erro_protocolo',
            'Falha ao gerar protocolo: ' || SQLERRM, 'sistema');
    v_numero := NULL;
  END;

  -- Cria status_producao para docs emitidos pela Quero Armas
  WITH inseridos AS (
    INSERT INTO qa_documento_status_producao (processo_documento_id, status)
    SELECT pd.id, 'nao_iniciado'
      FROM qa_processo_documentos pd
      JOIN qa_servicos_documentos sd
        ON sd.servico_id = v_proc.servico_id
       AND sd.tipo_documento = pd.tipo_documento
     WHERE pd.processo_id = p_processo_id
       AND sd.emissor = 'quero_armas'
       AND COALESCE(sd.ativo, true) = true
    ON CONFLICT (processo_documento_id) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_doc_status_inseridos FROM inseridos;

  RETURN jsonb_build_object(
    'processo_id', p_processo_id,
    'venda_id', v_proc.venda_id,
    'protocolo_numero', v_numero,
    'docs_producao_inseridos', v_doc_status_inseridos
  );
END;
$$;

COMMENT ON FUNCTION public.qa_pos_pagamento_protocolar IS
  'Wave 3D — Pós-pagamento: gera protocolo da venda e cria rastreio de produção interna dos docs quero_armas. Idempotente.';
