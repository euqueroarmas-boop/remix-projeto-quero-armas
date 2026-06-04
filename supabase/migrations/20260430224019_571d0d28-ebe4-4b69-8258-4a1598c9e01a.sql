ALTER TABLE public.qa_solicitacoes_servico
  ADD COLUMN IF NOT EXISTS categoria_atendimento text NOT NULL DEFAULT 'padrao';

ALTER TABLE public.qa_itens_venda
  ADD COLUMN IF NOT EXISTS tipo_venda text NOT NULL DEFAULT 'padrao';

COMMENT ON COLUMN public.qa_solicitacoes_servico.categoria_atendimento IS
  'Variação de atendimento do serviço canônico. Valores: padrao, civil_sem_clube, civil_com_clube, militar_seguranca_publica.';

COMMENT ON COLUMN public.qa_itens_venda.tipo_venda IS
  'Contexto comercial da venda do serviço. Valores: padrao, avulso, combo.';

UPDATE public.qa_solicitacoes_servico
   SET categoria_atendimento = 'civil_sem_clube'
 WHERE servico_id = 27 AND categoria_atendimento = 'padrao';

UPDATE public.qa_solicitacoes_servico
   SET categoria_atendimento = 'militar_seguranca_publica'
 WHERE servico_id = 29 AND categoria_atendimento = 'padrao';

UPDATE public.qa_itens_venda
   SET tipo_venda = 'avulso'
 WHERE servico_id = 17 AND tipo_venda = 'padrao';

UPDATE public.qa_itens_venda
   SET tipo_venda = 'combo'
 WHERE servico_id = 7 AND tipo_venda = 'padrao';

UPDATE public.qa_solicitacoes_servico SET servico_id = 20, service_slug = 'concessao-cr'      WHERE servico_id IN (27, 29);
UPDATE public.qa_solicitacoes_servico SET servico_id = 15, service_slug = 'autorizacao-compra' WHERE servico_id = 1;
UPDATE public.qa_solicitacoes_servico SET servico_id = 26, service_slug = 'registro-arma-fogo' WHERE servico_id = 16;
UPDATE public.qa_solicitacoes_servico SET servico_id = 18, service_slug = 'gte'                WHERE servico_id = 17;

UPDATE public.qa_solicitacoes_servico SET service_slug = 'concessao-cr'       WHERE service_slug = 'concessao-de-cr';
UPDATE public.qa_solicitacoes_servico SET service_slug = 'registro-arma-fogo' WHERE service_slug = 'renovacao-arma-fogo';

UPDATE public.qa_itens_venda SET servico_id = 20 WHERE servico_id IN (27, 29);
UPDATE public.qa_itens_venda SET servico_id = 15 WHERE servico_id = 1;
UPDATE public.qa_itens_venda SET servico_id = 26 WHERE servico_id = 16;
UPDATE public.qa_itens_venda SET servico_id = 18 WHERE servico_id = 17;

UPDATE public.qa_processos SET servico_id = 20 WHERE servico_id IN (27, 29);
UPDATE public.qa_processos SET servico_id = 15 WHERE servico_id = 1;
UPDATE public.qa_processos SET servico_id = 26 WHERE servico_id = 16;
UPDATE public.qa_processos SET servico_id = 18 WHERE servico_id = 17;

-- Dedup documentos obrigatórios pela chave funcional (servico_id + tipo_documento + condicao_profissional)
DELETE FROM public.qa_servico_documentos_obrigatorios a
 USING public.qa_servico_documentos_obrigatorios b
 WHERE a.id > b.id
   AND a.servico_id = b.servico_id
   AND COALESCE(a.tipo_documento, '') = COALESCE(b.tipo_documento, '')
   AND COALESCE(a.condicao_profissional, '') = COALESCE(b.condicao_profissional, '');
UPDATE public.qa_servico_documentos_obrigatorios SET servico_id = 20 WHERE servico_id IN (27, 29);
UPDATE public.qa_servico_documentos_obrigatorios SET servico_id = 15 WHERE servico_id = 1;
UPDATE public.qa_servico_documentos_obrigatorios SET servico_id = 26 WHERE servico_id = 16;
UPDATE public.qa_servico_documentos_obrigatorios SET servico_id = 18 WHERE servico_id = 17;

UPDATE public.qa_servicos_documentos SET servico_id = 20 WHERE servico_id IN (27, 29);
UPDATE public.qa_servicos_documentos SET servico_id = 15 WHERE servico_id = 1;
UPDATE public.qa_servicos_documentos SET servico_id = 26 WHERE servico_id = 16;
UPDATE public.qa_servicos_documentos SET servico_id = 18 WHERE servico_id = 17;

UPDATE public.qa_servicos_com_exame SET servico_id = 20 WHERE servico_id IN (27, 29);
UPDATE public.qa_servicos_com_exame SET servico_id = 15 WHERE servico_id = 1;
UPDATE public.qa_servicos_com_exame SET servico_id = 26 WHERE servico_id = 16;
UPDATE public.qa_servicos_com_exame SET servico_id = 18 WHERE servico_id = 17;

UPDATE public.qa_document_examples SET servico_id = 20 WHERE servico_id IN (27, 29);
UPDATE public.qa_document_examples SET servico_id = 15 WHERE servico_id = 1;
UPDATE public.qa_document_examples SET servico_id = 26 WHERE servico_id = 16;
UPDATE public.qa_document_examples SET servico_id = 18 WHERE servico_id = 17;

UPDATE public.qa_servicos_catalogo SET servico_id = 20 WHERE servico_id IN (27, 29);
UPDATE public.qa_servicos_catalogo SET servico_id = 15 WHERE servico_id = 1;
UPDATE public.qa_servicos_catalogo SET servico_id = 26 WHERE servico_id = 16;
UPDATE public.qa_servicos_catalogo SET servico_id = 18 WHERE servico_id = 17;

DELETE FROM public.qa_servicos WHERE id IN (1, 16, 17, 27, 29);

CREATE OR REPLACE FUNCTION public.qa_create_processo_from_venda(
  p_venda_id integer,
  p_servico_id integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venda           public.qa_vendas%ROWTYPE;
  v_servico         public.qa_servicos%ROWTYPE;
  v_solicitacao     public.qa_solicitacoes_servico%ROWTYPE;
  v_solicitacao_id  uuid;
  v_service_slug    text;
  v_expected_servico_id integer;
  v_existing        public.qa_processos%ROWTYPE;
  v_new_id          uuid;
BEGIN
  SELECT * INTO v_venda FROM public.qa_vendas WHERE id = p_venda_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VENDA_NOT_FOUND: %', p_venda_id USING ERRCODE = 'no_data_found';
  END IF;

  SELECT * INTO v_servico FROM public.qa_servicos WHERE id = p_servico_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SERVICO_NOT_FOUND: %', p_servico_id USING ERRCODE = 'no_data_found';
  END IF;

  v_solicitacao_id := v_venda.solicitacao_id;

  IF v_solicitacao_id IS NOT NULL THEN
    SELECT * INTO v_solicitacao
      FROM public.qa_solicitacoes_servico
     WHERE id = v_solicitacao_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'INTEGRITY_SOLICITACAO_NOT_FOUND: solicitação % referenciada pela venda % não existe.',
        v_solicitacao_id, p_venda_id;
    END IF;

    v_service_slug := v_solicitacao.service_slug;

    IF v_solicitacao.servico_id IS NOT NULL THEN
      v_expected_servico_id := v_solicitacao.servico_id;
    ELSE
      v_expected_servico_id := CASE LOWER(COALESCE(v_solicitacao.service_slug, ''))
        WHEN 'posse-arma-fogo'      THEN 2
        WHEN 'porte-arma-fogo'      THEN 3
        WHEN 'registro-arma-fogo'   THEN 26
        WHEN 'autorizacao-compra'   THEN 15
        WHEN 'concessao-cr'         THEN 20
        WHEN 'gte'                  THEN 18
        ELSE NULL
      END;
    END IF;

    IF v_expected_servico_id IS NOT NULL
       AND v_expected_servico_id <> p_servico_id THEN
      RAISE EXCEPTION
        'INTEGRITY_SOLICITACAO_PROCESSO_MISMATCH: solicitação % (servico_id=%, slug=%) não permite gerar processo de servico_id=% (%).',
        v_solicitacao_id,
        v_solicitacao.servico_id,
        COALESCE(v_solicitacao.service_slug, '∅'),
        p_servico_id,
        v_servico.nome_servico
      USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  SELECT * INTO v_existing
    FROM public.qa_processos
   WHERE venda_id = p_venda_id LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ja_existia', true,
      'processo_id', v_existing.id,
      'venda_id', v_existing.venda_id,
      'cliente_id', v_existing.cliente_id,
      'servico_id', v_existing.servico_id,
      'servico_nome', v_existing.servico_nome,
      'status', v_existing.status,
      'pagamento_status', v_existing.pagamento_status,
      'solicitacao_id', v_existing.solicitacao_id,
      'service_slug', v_service_slug
    );
  END IF;

  INSERT INTO public.qa_processos (
    cliente_id, servico_id, servico_nome, venda_id,
    pagamento_status, status, data_criacao, solicitacao_id
  ) VALUES (
    v_venda.cliente_id, p_servico_id, v_servico.nome_servico, p_venda_id,
    'pendente', 'aguardando_documentos', now(), v_solicitacao_id
  ) RETURNING id INTO v_new_id;

  IF v_solicitacao_id IS NOT NULL THEN
    UPDATE public.qa_solicitacoes_servico
       SET processo_id = (SELECT id FROM public.qa_processos WHERE id = v_new_id),
           updated_at = now()
     WHERE id = v_solicitacao_id;
  END IF;

  RETURN jsonb_build_object(
    'ja_existia', false,
    'processo_id', v_new_id,
    'venda_id', p_venda_id,
    'cliente_id', v_venda.cliente_id,
    'servico_id', p_servico_id,
    'servico_nome', v_servico.nome_servico,
    'status', 'aguardando_documentos',
    'pagamento_status', 'pendente',
    'solicitacao_id', v_solicitacao_id,
    'service_slug', v_service_slug
  );
END;
$$;