-- ============================================================
-- HOTFIX: qa_explodir_checklist_processo
-- Bug: referenciava colunas inexistentes v_cli.end1_cep / end1_logradouro
--      / end1_numero / end1_cidade / end1_estado.
-- Causa: checklist nascia VAZIO após confirmar pagamento e a UI
--        forçava o cliente a re-selecionar a condição profissional
--        mesmo quando a profissão (ex.: ADMINISTRADOR) já tinha sido
--        declarada no cadastro público.
-- Correção: usar as colunas reais (cep, endereco, numero, cidade, estado).
-- ============================================================
CREATE OR REPLACE FUNCTION public.qa_explodir_checklist_processo(p_processo_id uuid)
 RETURNS TABLE(inseridos integer, ja_existentes integer, reaproveitados_cofre integer, pre_validados integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_proc                public.qa_processos%ROWTYPE;
  v_cli                 public.qa_clientes%ROWTYPE;
  v_condicao            text;
  v_profissao_upper     text;
  v_ins                 integer := 0;
  v_exi                 integer := 0;
  v_reaprov             integer := 0;
  v_prevalid            integer := 0;
BEGIN
  SELECT * INTO v_proc FROM public.qa_processos WHERE id = p_processo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processo % nao encontrado', p_processo_id;
  END IF;

  IF v_proc.servico_id IS NULL THEN
    RAISE EXCEPTION 'Processo % sem servico_id - fallback Posse proibido', p_processo_id;
  END IF;

  SELECT * INTO v_cli FROM public.qa_clientes WHERE id = v_proc.cliente_id;

  v_condicao := COALESCE(v_proc.condicao_profissional, 'indefinido');
  v_profissao_upper := NULLIF(TRIM(UPPER(COALESCE(v_cli.profissao, ''))), '');

  -- (a) INSERIR itens novos
  WITH desejados AS (
    SELECT sd.tipo_documento, sd.nome_documento, sd.etapa, sd.validade_dias,
           sd.formato_aceito, sd.regra_validacao, sd.link_emissao
    FROM public.qa_servicos_documentos sd
    WHERE sd.servico_id = v_proc.servico_id
      AND sd.ativo = true
      AND (sd.condicao_profissional IS NULL OR sd.condicao_profissional = v_condicao)
  ),
  ja AS (
    SELECT tipo_documento FROM public.qa_processo_documentos
    WHERE processo_id = p_processo_id
  ),
  inserted AS (
    INSERT INTO public.qa_processo_documentos (
      processo_id, cliente_id, tipo_documento, nome_documento, etapa,
      status, obrigatorio, validade_dias, formato_aceito, regra_validacao
    )
    SELECT p_processo_id, v_proc.cliente_id, d.tipo_documento,
           CASE
             WHEN v_profissao_upper IS NOT NULL
              AND (d.tipo_documento ILIKE 'renda_%' OR d.tipo_documento ILIKE '%atividade%')
             THEN d.nome_documento || ' — ' || v_profissao_upper
             ELSE d.nome_documento
           END,
           d.etapa,
           'pendente', true, d.validade_dias, d.formato_aceito, d.regra_validacao
    FROM desejados d
    WHERE NOT EXISTS (SELECT 1 FROM ja j WHERE j.tipo_documento = d.tipo_documento)
    RETURNING 1
  )
  SELECT
    (SELECT COUNT(*) FROM inserted)::int,
    (SELECT COUNT(*) FROM desejados d WHERE EXISTS (SELECT 1 FROM ja j WHERE j.tipo_documento = d.tipo_documento))::int
  INTO v_ins, v_exi;

  -- (b) REAPROVEITAR cofre
  WITH cofre_validos AS (
    SELECT DISTINCT ON (dc.tipo_documento)
           dc.tipo_documento, dc.arquivo_storage_path, dc.id
      FROM public.qa_documentos_cliente dc
     WHERE dc.qa_cliente_id = v_proc.cliente_id
       AND dc.validado_admin = true
       AND dc.arquivo_storage_path IS NOT NULL
       AND (dc.data_validade IS NULL OR dc.data_validade >= CURRENT_DATE)
     ORDER BY dc.tipo_documento, dc.created_at DESC
  ),
  reaproveitados AS (
    UPDATE public.qa_processo_documentos pd
       SET arquivo_storage_key = cv.arquivo_storage_path,
           arquivo_url = cv.arquivo_storage_path,
           status = 'em_analise',
           data_envio = now(),
           observacoes = COALESCE(pd.observacoes, '') ||
             CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
             '[' || to_char(now(),'YYYY-MM-DD HH24:MI') || '] Reaproveitado do cofre do cliente (doc #' || cv.id::text || ')',
           updated_at = now()
      FROM cofre_validos cv
     WHERE pd.processo_id = p_processo_id
       AND pd.tipo_documento = cv.tipo_documento
       AND pd.status = 'pendente'
       AND pd.arquivo_storage_key IS NULL
    RETURNING pd.tipo_documento
  )
  SELECT COUNT(*) INTO v_reaprov FROM reaproveitados;

  -- (c) PRÉ-PREENCHER textuais — FIX: usar colunas reais (cep, endereco, numero, cidade, estado)
  IF v_cli.cep IS NOT NULL AND v_cli.endereco IS NOT NULL
     AND v_cli.cidade IS NOT NULL AND v_cli.estado IS NOT NULL THEN
    UPDATE public.qa_processo_documentos
       SET observacoes = COALESCE(observacoes,'') ||
             CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
             '[' || to_char(now(),'YYYY-MM-DD HH24:MI') ||
             '] Endereço pré-preenchido do cadastro: ' ||
             v_cli.endereco || ', ' || COALESCE(v_cli.numero,'s/n') ||
             ' — ' || v_cli.cidade || '/' || v_cli.estado ||
             ' — CEP ' || v_cli.cep,
           updated_at = now()
     WHERE processo_id = p_processo_id
       AND tipo_documento = 'comprovante_residencia'
       AND status = 'pendente';
    GET DIAGNOSTICS v_prevalid = ROW_COUNT;
  END IF;

  IF v_profissao_upper IS NOT NULL THEN
    UPDATE public.qa_processo_documentos
       SET observacoes = COALESCE(observacoes,'') ||
             CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
             '[' || to_char(now(),'YYYY-MM-DD HH24:MI') ||
             '] Profissão informada no cadastro: ' || v_profissao_upper ||
             '. O comprovante deve ser compatível com esta atividade.',
           updated_at = now()
     WHERE processo_id = p_processo_id
       AND (tipo_documento ILIKE 'renda_%' OR tipo_documento ILIKE '%atividade%')
       AND status = 'pendente';
  END IF;

  INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, ator)
  VALUES (
    p_processo_id, 'checklist_explodido',
    format('Checklist liberado pos-pagamento: %s novos, %s ja existentes, %s reaproveitados do cofre, profissao=%s (servico_id=%s, condicao=%s)',
           v_ins, v_exi, v_reaprov, COALESCE(v_profissao_upper,'(vazia)'), v_proc.servico_id, v_condicao),
    'sistema'
  );

  inseridos := v_ins;
  ja_existentes := v_exi;
  reaproveitados_cofre := v_reaprov;
  pre_validados := v_prevalid;
  RETURN NEXT;
END $function$;

-- ============================================================
-- HOTFIX dados: NF da empresa do processo do Willian (e qualquer
-- outro processo de empresário existente) deve ser obrigatória.
-- ============================================================
UPDATE public.qa_processo_documentos
   SET obrigatorio = true,
       nome_documento = 'Nota fiscal recente da empresa',
       observacoes_cliente = 'OBRIGATÓRIO. A NF comprova movimentação real da empresa — exigência da PF/EB para CR de empresário/sócio. Se a empresa não emite NF, contate o operador para substituição formal (Pró-labore, IRPJ, DAS).',
       updated_at = now()
 WHERE tipo_documento = 'renda_nf_empresa'
   AND status IN ('pendente','em_analise','rejeitado');