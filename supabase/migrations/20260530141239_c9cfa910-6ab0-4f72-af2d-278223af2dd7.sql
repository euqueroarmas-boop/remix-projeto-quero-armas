-- Helper: avança para o próximo serviço da mesma venda quando o atual já está executado
CREATE OR REPLACE FUNCTION public.qa_avancar_proximo_servico_venda(p_processo_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_proc           public.qa_processos%ROWTYPE;
  v_current_item   public.qa_itens_venda%ROWTYPE;
  v_next_item      public.qa_itens_venda%ROWTYPE;
  v_next_proc_id   uuid;
  v_servico_nome   text;
  v_advanced       text[] := ARRAY['enviado_ao_orgao','em_analise_orgao','deferido','indeferido','concluido'];
BEGIN
  SELECT * INTO v_proc FROM public.qa_processos WHERE id = p_processo_id;
  IF NOT FOUND OR v_proc.venda_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Item atual: bate por venda + serviço
  SELECT * INTO v_current_item
    FROM public.qa_itens_venda
   WHERE venda_id = v_proc.venda_id AND servico_id = v_proc.servico_id
   ORDER BY id ASC LIMIT 1;

  -- Próximo item da venda (por id) com serviço definido, ainda não executado
  SELECT * INTO v_next_item
    FROM public.qa_itens_venda
   WHERE venda_id = v_proc.venda_id
     AND servico_id IS NOT NULL
     AND id > COALESCE(v_current_item.id, 0)
     AND LOWER(COALESCE(status,'')) <> ALL(v_advanced)
   ORDER BY id ASC
   LIMIT 1;

  IF NOT FOUND OR v_next_item.id IS NULL THEN
    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
    VALUES (p_processo_id, 'proximo_servico_nao_encontrado',
      'Não há próximo serviço pendente na venda para liberar checklist automaticamente.',
      jsonb_build_object('venda_id', v_proc.venda_id, 'servico_id_atual', v_proc.servico_id),
      'sistema');
    RETURN NULL;
  END IF;

  -- Localiza ou cria processo do próximo serviço
  SELECT id INTO v_next_proc_id
    FROM public.qa_processos
   WHERE venda_id = v_proc.venda_id AND servico_id = v_next_item.servico_id
   LIMIT 1;

  IF v_next_proc_id IS NULL THEN
    SELECT nome_servico INTO v_servico_nome
      FROM public.qa_servicos WHERE id = v_next_item.servico_id;
    IF v_servico_nome IS NULL THEN
      v_servico_nome := 'Serviço ' || v_next_item.servico_id::text;
    END IF;

    INSERT INTO public.qa_processos (
      cliente_id, servico_id, servico_nome, venda_id,
      status, pagamento_status, condicao_profissional
    ) VALUES (
      v_proc.cliente_id, v_next_item.servico_id, v_servico_nome, v_proc.venda_id,
      'aguardando_documentos', 'confirmado',
      COALESCE(NULLIF(v_proc.condicao_profissional,''),'indefinido')
    )
    RETURNING id INTO v_next_proc_id;

    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
    VALUES (v_next_proc_id, 'processo_criado_auto_skip',
      format('Processo criado automaticamente porque o serviço anterior (id=%s) já foi executado fora do sistema.', v_proc.servico_id),
      jsonb_build_object('venda_id', v_proc.venda_id, 'servico_id', v_next_item.servico_id, 'processo_origem', p_processo_id),
      'sistema');
  END IF;

  -- Log no processo de origem
  INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
  VALUES (p_processo_id, 'proximo_servico_liberado',
    format('Checklist do próximo serviço da venda (servico_id=%s, processo=%s) foi liberado automaticamente.',
           v_next_item.servico_id, v_next_proc_id),
    jsonb_build_object('venda_id', v_proc.venda_id, 'servico_id_proximo', v_next_item.servico_id, 'processo_proximo', v_next_proc_id),
    'sistema');

  -- Explode checklist do próximo (que pode recursivamente pular também)
  PERFORM public.qa_explodir_checklist_processo(v_next_proc_id);

  RETURN v_next_proc_id;
END;
$$;

-- Patch qa_explodir_checklist_processo: skip se status já avançado
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
  v_dup                 integer := 0;
  v_invalid             integer := 0;
  v_reaprov             integer := 0;
  v_prevalid            integer := 0;
  v_endereco_seed       integer := 0;
  v_endereco_aproveit   integer := 0;
  v_inserted_tipos      text[] := ARRAY[]::text[];
  v_existing_tipos      text[] := ARRAY[]::text[];
  v_duplicate_tipos     text[] := ARRAY[]::text[];
  v_invalid_items       jsonb := '[]'::jsonb;
  v_item_status         text;
  v_advanced_proc       text[] := ARRAY['protocolado','em_analise_orgao','deferido','indeferido','concluido'];
  v_advanced_item       text[] := ARRAY['enviado_ao_orgao','em_analise_orgao','deferido','indeferido','concluido'];
  v_skip                boolean := false;
  v_next_proc_id        uuid;
BEGIN
  SELECT * INTO v_proc FROM public.qa_processos WHERE id = p_processo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processo % nao encontrado', p_processo_id;
  END IF;

  IF v_proc.servico_id IS NULL THEN
    RAISE EXCEPTION 'Processo % sem servico_id - fallback Posse proibido', p_processo_id;
  END IF;

  -- NOVO: detecta status avançado no processo OU no item da venda
  IF LOWER(COALESCE(v_proc.status,'')) = ANY(v_advanced_proc) THEN
    v_skip := true;
  ELSIF v_proc.venda_id IS NOT NULL THEN
    SELECT LOWER(COALESCE(status,'')) INTO v_item_status
      FROM public.qa_itens_venda
     WHERE venda_id = v_proc.venda_id AND servico_id = v_proc.servico_id
     ORDER BY id ASC LIMIT 1;
    IF v_item_status = ANY(v_advanced_item) THEN
      v_skip := true;
    END IF;
  END IF;

  IF v_skip THEN
    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
    VALUES (p_processo_id, 'checklist_suprimido_status_avancado',
      'Checklist não foi gerado: serviço já executado fora do sistema (status avançado).',
      jsonb_build_object(
        'processo_status', v_proc.status,
        'item_status', v_item_status,
        'venda_id', v_proc.venda_id,
        'servico_id', v_proc.servico_id
      ), 'sistema');

    -- Tenta avançar para o próximo serviço da venda
    BEGIN
      v_next_proc_id := public.qa_avancar_proximo_servico_venda(p_processo_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'qa_avancar_proximo_servico_venda falhou: %', SQLERRM;
    END;

    inseridos := 0; ja_existentes := 0; reaproveitados_cofre := 0; pre_validados := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO v_cli FROM public.qa_clientes WHERE id = v_proc.cliente_id;

  v_condicao := COALESCE(NULLIF(v_proc.condicao_profissional, ''), 'indefinido');
  v_profissao_upper := NULLIF(TRIM(UPPER(COALESCE(v_cli.profissao, ''))), '');

  WITH catalogo_bruto AS (
    SELECT sd.*,
           CASE
             WHEN sd.etapa IN ('base','complementar','tecnico','final') THEN sd.etapa
             WHEN sd.etapa = 'antecedentes' THEN 'base'
             WHEN sd.etapa = 'declaracoes' THEN 'complementar'
             WHEN sd.etapa = 'renda' THEN 'complementar'
             ELSE 'base'
           END AS etapa_segura,
           (sd.etapa IS NULL OR sd.etapa NOT IN ('base','complementar','tecnico','final')) AS etapa_invalida,
           row_number() OVER (
             PARTITION BY sd.tipo_documento
             ORDER BY
               CASE WHEN sd.condicao_profissional IS NULL THEN 0 ELSE 1 END,
               COALESCE(sd.ordem, 999),
               sd.created_at,
               sd.id
           ) AS rn
      FROM public.qa_servicos_documentos sd
     WHERE sd.servico_id = v_proc.servico_id
       AND sd.ativo = true
       AND (sd.condicao_profissional IS NULL OR sd.condicao_profissional = v_condicao)
  ),
  desejados AS (SELECT * FROM catalogo_bruto WHERE rn = 1),
  duplicados AS (SELECT * FROM catalogo_bruto WHERE rn > 1),
  ja AS (SELECT DISTINCT tipo_documento FROM public.qa_processo_documentos WHERE processo_id = p_processo_id),
  inserted AS (
    INSERT INTO public.qa_processo_documentos (
      processo_id, cliente_id, tipo_documento, nome_documento, etapa,
      status, obrigatorio, validade_dias, formato_aceito, regra_validacao, link_emissao,
      instrucoes, observacoes_cliente, modelo_url, exemplo_url, orgao_emissor, prazo_recomendado_dias
    )
    SELECT p_processo_id, v_proc.cliente_id, d.tipo_documento,
           CASE WHEN v_profissao_upper IS NOT NULL
                 AND (d.tipo_documento ILIKE 'renda_%' OR d.tipo_documento ILIKE '%atividade%')
                THEN d.nome_documento || ' — ' || v_profissao_upper
                ELSE d.nome_documento END,
           d.etapa_segura, 'pendente', COALESCE(d.obrigatorio, true),
           d.validade_dias, d.formato_aceito, d.regra_validacao, d.link_emissao,
           d.instrucoes, d.observacoes_cliente, d.modelo_url, d.exemplo_url,
           d.orgao_emissor, d.prazo_recomendado_dias
      FROM desejados d
     WHERE NOT EXISTS (SELECT 1 FROM ja j WHERE j.tipo_documento = d.tipo_documento)
    RETURNING tipo_documento
  )
  SELECT
    COALESCE((SELECT COUNT(*) FROM inserted), 0)::int,
    COALESCE((SELECT COUNT(*) FROM desejados d WHERE EXISTS (SELECT 1 FROM ja j WHERE j.tipo_documento = d.tipo_documento)), 0)::int,
    COALESCE((SELECT COUNT(*) FROM duplicados), 0)::int,
    COALESCE((SELECT COUNT(*) FROM desejados d WHERE d.etapa_invalida), 0)::int,
    COALESCE((SELECT array_agg(tipo_documento ORDER BY tipo_documento) FROM inserted), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(d.tipo_documento ORDER BY d.tipo_documento) FROM desejados d WHERE EXISTS (SELECT 1 FROM ja j WHERE j.tipo_documento = d.tipo_documento)), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(tipo_documento ORDER BY tipo_documento) FROM duplicados), ARRAY[]::text[]),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('tipo_documento', d.tipo_documento, 'etapa_original', d.etapa, 'etapa_usada', d.etapa_segura) ORDER BY d.tipo_documento) FROM desejados d WHERE d.etapa_invalida), '[]'::jsonb)
  INTO v_ins, v_exi, v_dup, v_invalid, v_inserted_tipos, v_existing_tipos, v_duplicate_tipos, v_invalid_items;

  IF v_invalid > 0 THEN
    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
    VALUES (p_processo_id, 'checklist_etapa_invalida_normalizada',
      format('Catálogo com %s etapa(s) inválida(s).', v_invalid),
      jsonb_build_object('servico_id', v_proc.servico_id, 'condicao_profissional', v_condicao, 'itens', v_invalid_items),
      'sistema');
  END IF;

  IF v_dup > 0 THEN
    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
    VALUES (p_processo_id, 'checklist_duplicados_ignorados',
      format('Checklist ignorou %s item(ns) duplicado(s).', v_dup),
      jsonb_build_object('servico_id', v_proc.servico_id, 'condicao_profissional', v_condicao, 'tipos_documento', v_duplicate_tipos),
      'sistema');
  END IF;

  WITH cofre_validos AS (
    SELECT DISTINCT ON (dc.tipo_documento) dc.tipo_documento, dc.arquivo_storage_path, dc.id
      FROM public.qa_documentos_cliente dc
     WHERE dc.qa_cliente_id = v_proc.cliente_id
       AND dc.validado_admin = true
       AND dc.arquivo_storage_path IS NOT NULL
       AND (dc.data_validade IS NULL OR dc.data_validade >= CURRENT_DATE)
     ORDER BY dc.tipo_documento, dc.created_at DESC
  ),
  reaproveitados AS (
    UPDATE public.qa_processo_documentos pd
       SET arquivo_storage_key = cv.arquivo_storage_path, arquivo_url = cv.arquivo_storage_path,
           status = 'em_analise', data_envio = now(),
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

  IF v_cli.cep IS NOT NULL AND v_cli.endereco IS NOT NULL
     AND v_cli.cidade IS NOT NULL AND v_cli.estado IS NOT NULL THEN
    UPDATE public.qa_processo_documentos
       SET observacoes = COALESCE(observacoes,'') ||
             CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
             '[' || to_char(now(),'YYYY-MM-DD HH24:MI') ||
             '] Endereço pré-preenchido do cadastro: ' ||
             v_cli.endereco || ', ' || COALESCE(v_cli.numero, 's/n') || ' - ' ||
             v_cli.cidade || '/' || v_cli.estado || ' - CEP ' || v_cli.cep,
           updated_at = now()
     WHERE processo_id = p_processo_id
       AND tipo_documento ILIKE '%comprovante_residencia%'
       AND status = 'pendente';
    GET DIAGNOSTICS v_prevalid = ROW_COUNT;
  END IF;

  IF v_proc.servico_id IN (31, 44) THEN
    BEGIN
      v_endereco_seed     := public.qa_seed_endereco_5_anos(p_processo_id);
      v_endereco_aproveit := public.qa_aproveitar_endereco_cadastro_publico(p_processo_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'qa_seed_endereco_5_anos / aproveitar falhou: %', SQLERRM;
    END;
  END IF;

  INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
  VALUES (p_processo_id, 'checklist_explodido',
    format('Checklist explodido: %s ins, %s exist, %s dup, %s inv, %s cofre, %s slots end5anos, %s end aproveitados (svc=%s, cond=%s).',
           v_ins, v_exi, v_dup, v_invalid, v_reaprov, v_endereco_seed, v_endereco_aproveit, v_proc.servico_id, v_condicao),
    jsonb_build_object(
      'servico_id', v_proc.servico_id, 'condicao_profissional', v_condicao,
      'documentos_inseridos', v_inserted_tipos,
      'documentos_ja_existentes', v_existing_tipos,
      'documentos_ignorados_por_duplicidade', v_duplicate_tipos,
      'documentos_com_etapa_invalida_normalizada', v_invalid_items,
      'reaproveitados_cofre', v_reaprov, 'pre_validados', v_prevalid,
      'endereco_5_anos_slots_criados', v_endereco_seed,
      'endereco_cadastro_publico_aproveitado', v_endereco_aproveit
    ), 'sistema');

  inseridos := v_ins; ja_existentes := v_exi;
  reaproveitados_cofre := v_reaprov; pre_validados := v_prevalid;
  RETURN NEXT;
END;
$function$;