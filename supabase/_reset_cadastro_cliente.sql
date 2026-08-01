-- ============================================================================
-- RESET DE CADASTRO DE CLIENTE (QUERO ARMAS) — POR CPF
-- Volta o cliente ao estado "logo apos assinar contrato e procuracao":
--   * PRESERVA: contrato assinado, procuracao assinada, venda, pagamento,
--     dados cadastrais, Auth/login, base de IA.
--   * ZERA: demais documentos do hub, checklist do processo (volta a pendente),
--     alertas de vencimento/incompatibilidade e notificacoes do cliente.
-- Seguro para rodar mais de uma vez.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- COMANDO 1 — GENERICO (troque o CPF na 1a linha do DECLARE)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_cpf     text := '00000000000';   -- <<< CPF do cliente (com ou sem pontuacao)
  v_cliente integer;
  v_qtd     integer;
BEGIN
  v_cpf := regexp_replace(v_cpf, '\D', '', 'g');

  SELECT id INTO v_cliente
  FROM public.qa_clientes
  WHERE regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = v_cpf
  LIMIT 1;

  IF v_cliente IS NULL THEN
    RAISE EXCEPTION 'Cliente com CPF % nao encontrado', v_cpf;
  END IF;

  -- 1) Hub documental: apaga tudo, menos contrato e procuracao assinados
  DELETE FROM public.qa_documentos_cliente
  WHERE qa_cliente_id = v_cliente
    AND tipo_documento NOT IN ('contrato_assinado', 'procuracao_assinada');
  GET DIAGNOSTICS v_qtd = ROW_COUNT;
  RAISE NOTICE 'Documentos do hub removidos: %', v_qtd;

  -- 2) Checklist do processo: volta tudo para pendente e limpa envios/IA
  UPDATE public.qa_processo_documentos SET
    status                     = 'pendente',
    arquivo_url                = NULL,
    arquivo_storage_key        = NULL,
    data_envio                 = NULL,
    data_validacao             = NULL,
    revisado_por               = NULL,
    motivo_rejeicao            = NULL,
    dados_extraidos_json       = NULL,
    divergencias_json          = NULL,
    validacao_ia_status        = NULL,
    validacao_ia_erro          = NULL,
    validacao_ia_confianca     = NULL,
    validacao_ia_modelo        = NULL,
    decisao_ia                 = NULL,
    extracao_ia_status         = 'pendente',
    extracao_ia_json           = NULL,
    texto_ocr_extraido         = NULL,
    data_emissao               = NULL,
    data_validade              = NULL,
    data_validade_efetiva      = NULL,
    proxima_leitura            = NULL,
    confirmado_pelo_cliente_em = NULL,
    assinatura_status          = NULL,
    assinatura_signatario      = NULL,
    assinatura_cpf             = NULL,
    assinatura_data            = NULL,
    assinatura_autoridade      = NULL,
    assinatura_motivo_falha    = NULL,
    assinatura_validada_em     = NULL,
    assinatura_detalhes_json   = NULL,
    updated_at                 = now()
  WHERE cliente_id = v_cliente
    AND tipo_documento NOT IN ('contrato_assinado', 'procuracao_assinada');
  GET DIAGNOSTICS v_qtd = ROW_COUNT;
  RAISE NOTICE 'Exigencias reabertas: %', v_qtd;

  -- 3) Alertas e notificacoes ja disparados (para o motor recomecar do zero)
  DELETE FROM public.qa_vencimentos_alertas_enviados  WHERE cliente_id = v_cliente;
  DELETE FROM public.qa_doc_incompat_alertas_enviados WHERE cliente_id = v_cliente;
  DELETE FROM public.qa_notificacoes_cliente          WHERE cliente_id = v_cliente;

  RAISE NOTICE 'Reset concluido para cliente id=% (CPF %)', v_cliente, v_cpf;
END $$;


-- ----------------------------------------------------------------------------
-- COMANDO 2 — WILLIAN RODRIGUES DA SILVA MASSAROTO (CPF 377.995.388-99)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_cpf     text := '37799538899';
  v_cliente integer;
BEGIN
  SELECT id INTO v_cliente
  FROM public.qa_clientes
  WHERE regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = v_cpf
  LIMIT 1;

  IF v_cliente IS NULL THEN
    RAISE EXCEPTION 'Cliente com CPF % nao encontrado', v_cpf;
  END IF;

  DELETE FROM public.qa_documentos_cliente
  WHERE qa_cliente_id = v_cliente
    AND tipo_documento NOT IN ('contrato_assinado', 'procuracao_assinada');

  UPDATE public.qa_processo_documentos SET
    status                     = 'pendente',
    arquivo_url                = NULL,
    arquivo_storage_key        = NULL,
    data_envio                 = NULL,
    data_validacao             = NULL,
    revisado_por               = NULL,
    motivo_rejeicao            = NULL,
    dados_extraidos_json       = NULL,
    divergencias_json          = NULL,
    validacao_ia_status        = NULL,
    validacao_ia_erro          = NULL,
    validacao_ia_confianca     = NULL,
    validacao_ia_modelo        = NULL,
    decisao_ia                 = NULL,
    extracao_ia_status         = 'pendente',
    extracao_ia_json           = NULL,
    texto_ocr_extraido         = NULL,
    data_emissao               = NULL,
    data_validade              = NULL,
    data_validade_efetiva      = NULL,
    proxima_leitura            = NULL,
    confirmado_pelo_cliente_em = NULL,
    assinatura_status          = NULL,
    assinatura_signatario      = NULL,
    assinatura_cpf             = NULL,
    assinatura_data            = NULL,
    assinatura_autoridade      = NULL,
    assinatura_motivo_falha    = NULL,
    assinatura_validada_em     = NULL,
    assinatura_detalhes_json   = NULL,
    updated_at                 = now()
  WHERE cliente_id = v_cliente
    AND tipo_documento NOT IN ('contrato_assinado', 'procuracao_assinada');

  DELETE FROM public.qa_vencimentos_alertas_enviados  WHERE cliente_id = v_cliente;
  DELETE FROM public.qa_doc_incompat_alertas_enviados WHERE cliente_id = v_cliente;
  DELETE FROM public.qa_notificacoes_cliente          WHERE cliente_id = v_cliente;
END $$;

-- Conferencia (opcional):
-- SELECT tipo_documento, status FROM public.qa_documentos_cliente WHERE qa_cliente_id = 216;
-- SELECT status, count(*) FROM public.qa_processo_documentos WHERE cliente_id = 216 GROUP BY 1;