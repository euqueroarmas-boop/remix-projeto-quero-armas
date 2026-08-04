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
  v_modalidade          text;
  v_ins                 integer := 0;
  v_exi                 integer := 0;
  v_dup                 integer := 0;
  v_invalid             integer := 0;
  v_prevalid            integer := 0;
  v_endereco_seed       integer := 0;
  v_endereco_aproveit   integer := 0;
  v_inserted_tipos      text[] := ARRAY[]::text[];
  v_existing_tipos      text[] := ARRAY[]::text[];
  v_duplicate_tipos     text[] := ARRAY[]::text[];
  v_invalid_items       jsonb := '[]'::jsonb;
  v_reuso               record;
BEGIN
  SELECT * INTO v_proc FROM public.qa_processos WHERE id = p_processo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processo % nao encontrado', p_processo_id;
  END IF;

  IF v_proc.servico_id IS NULL THEN
    RAISE EXCEPTION 'Processo % sem servico_id - fallback Posse proibido', p_processo_id;
  END IF;

  SELECT * INTO v_cli FROM public.qa_clientes WHERE id = v_proc.cliente_id;

  v_condicao := COALESCE(NULLIF(v_proc.condicao_profissional, ''), 'indefinido');
  v_profissao_upper := NULLIF(TRIM(UPPER(COALESCE(v_cli.profissao, ''))), '');
  v_modalidade := NULLIF(TRIM(LOWER(COALESCE(v_proc.modalidade, ''))), '');

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
       AND (sd.condicao_modalidade IS NULL
            OR v_modalidade IS NULL
            OR v_modalidade = ANY(sd.condicao_modalidade))
  ),
  desejados AS (SELECT * FROM catalogo_bruto WHERE rn = 1),
  duplicados AS (SELECT * FROM catalogo_bruto WHERE rn > 1),
  ja AS (SELECT DISTINCT tipo_documento FROM public.qa_processo_documentos WHERE processo_id = p_processo_id),
  inserted AS (
    INSERT INTO public.qa_processo_documentos (
      processo_id, cliente_id, tipo_documento, nome_documento, etapa,
      status, obrigatorio, validade_dias, formato_aceito, regra_validacao, link_emissao,
      instrucoes, observacoes_cliente, modelo_url, exemplo_url, orgao_emissor,
      prazo_recomendado_dias, escopo, ordem
    )
    SELECT p_processo_id, v_proc.cliente_id, d.tipo_documento,
           CASE WHEN v_profissao_upper IS NOT NULL
                 AND (d.tipo_documento ILIKE 'renda_%' OR d.tipo_documento ILIKE '%atividade%')
                THEN d.nome_documento || ' — ' || v_profissao_upper
                ELSE d.nome_documento END,
           d.etapa_segura, 'pendente', COALESCE(d.obrigatorio, true),
           d.validade_dias, d.formato_aceito, d.regra_validacao, d.link_emissao,
           d.instrucoes, d.observacoes_cliente, d.modelo_url, d.exemplo_url,
           d.orgao_emissor, d.prazo_recomendado_dias,
           COALESCE(d.escopo, 'processo'), d.ordem
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

  IF v_cli.cep IS NOT NULL AND v_cli.endereco IS NOT NULL
     AND v_cli.cidade IS NOT NULL AND v_cli.estado IS NOT NULL THEN
    UPDATE public.qa_processo_documentos
       SET observacoes = COALESCE(observacoes,'') ||
             CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
             '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
             '] Endereço pré-preenchido do cadastro: ' ||
             v_cli.endereco || ', ' || COALESCE(v_cli.numero, 's/n') || ' - ' ||
             v_cli.cidade || '/' || v_cli.estado || ' - CEP ' || v_cli.cep,
           updated_at = now()
     WHERE processo_id = p_processo_id
       AND tipo_documento ILIKE '%comprovante_residencia%'
       AND status = 'pendente';
    GET DIAGNOSTICS v_prevalid = ROW_COUNT;
  END IF;

  IF v_proc.servico_id IN (31, 44, 50, 51) THEN
    BEGIN
      v_endereco_seed     := public.qa_seed_endereco_5_anos(p_processo_id);
      v_endereco_aproveit := public.qa_aproveitar_endereco_cadastro_publico(p_processo_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'qa_seed_endereco_5_anos / aproveitar falhou: %', SQLERRM;
    END;
  END IF;

  SELECT * INTO v_reuso
    FROM public.qa_reaproveitar_documentos_hub_processo(p_processo_id, 'checklist_explodido_pos_seed');

  INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
  VALUES (p_processo_id, 'checklist_explodido',
    format('Checklist explodido: %s ins, %s exist, %s dup, %s inv, %s cofre, %s slots end5anos, %s end aproveitados (svc=%s, cond=%s).',
           v_ins, v_exi, v_dup, v_invalid, COALESCE(v_reuso.reaproveitados, 0), v_endereco_seed, v_endereco_aproveit, v_proc.servico_id, v_condicao),
    jsonb_build_object(
      'servico_id', v_proc.servico_id, 'condicao_profissional', v_condicao,
      'documentos_inseridos', v_inserted_tipos,
      'documentos_ja_existentes', v_existing_tipos,
      'documentos_ignorados_por_duplicidade', v_duplicate_tipos,
      'documentos_com_etapa_invalida_normalizada', v_invalid_items,
      'reaproveitados_cofre', COALESCE(v_reuso.reaproveitados, 0),
      'pre_validados', v_prevalid,
      'endereco_5_anos_slots_criados', v_endereco_seed,
      'endereco_cadastro_publico_aproveitado', v_endereco_aproveit
    ), 'sistema');

  inseridos := v_ins;
  ja_existentes := v_exi;
  reaproveitados_cofre := COALESCE(v_reuso.reaproveitados, 0);
  pre_validados := v_prevalid;
  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.qa_sincronizar_checklist_processos_servico(p_servico_id integer)
 RETURNS TABLE(processos_processados integer, exigencias_adicionadas integer, exigencias_atualizadas integer, exigencias_arquivadas integer, documentos_preservados integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_proc       RECORD;
  v_ins_total  int := 0;
  v_upd_total  int := 0;
  v_arq_total  int := 0;
  v_pres_total int := 0;
  v_procs_total int := 0;
  v_ins_proc   int;
  v_upd_proc   int;
  v_arq_proc   int;
  v_pres_proc  int;
  v_now_txt    text := to_char(now(),'YYYY-MM-DD HH24:MI');
BEGIN
  FOR v_proc IN
    SELECT p.id, p.cliente_id, COALESCE(p.condicao_profissional,'indefinido') AS condicao
      FROM public.qa_processos p
     WHERE p.servico_id = p_servico_id
       AND p.status NOT IN ('concluido','cancelado')
  LOOP
    v_procs_total := v_procs_total + 1;

    WITH desejados AS (
      SELECT sd.tipo_documento, sd.nome_documento, sd.etapa, sd.validade_dias,
             sd.formato_aceito, sd.regra_validacao, sd.link_emissao,
             sd.instrucoes, sd.observacoes_cliente, sd.modelo_url, sd.exemplo_url,
             sd.orgao_emissor, sd.prazo_recomendado_dias, sd.obrigatorio, sd.ordem
        FROM public.qa_servicos_documentos sd
       WHERE sd.servico_id = p_servico_id
         AND sd.ativo = true
         AND (sd.condicao_profissional IS NULL OR sd.condicao_profissional = v_proc.condicao)
    ),
    inserted AS (
      INSERT INTO public.qa_processo_documentos (
        processo_id, cliente_id, tipo_documento, nome_documento, etapa,
        status, obrigatorio, validade_dias, formato_aceito, regra_validacao, link_emissao,
        instrucoes, observacoes_cliente, modelo_url, exemplo_url, orgao_emissor, prazo_recomendado_dias, ordem
      )
      SELECT v_proc.id, v_proc.cliente_id, d.tipo_documento, d.nome_documento, d.etapa,
             'pendente', COALESCE(d.obrigatorio, true), d.validade_dias, d.formato_aceito,
             d.regra_validacao, d.link_emissao,
             d.instrucoes, d.observacoes_cliente, d.modelo_url, d.exemplo_url,
             d.orgao_emissor, d.prazo_recomendado_dias, d.ordem
        FROM desejados d
       WHERE NOT EXISTS (
         SELECT 1 FROM public.qa_processo_documentos pd
          WHERE pd.processo_id = v_proc.id
            AND pd.tipo_documento = d.tipo_documento
       )
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_ins_proc FROM inserted;

    WITH desejados AS (
      SELECT sd.tipo_documento, sd.nome_documento, sd.etapa, sd.validade_dias,
             sd.formato_aceito, sd.regra_validacao, sd.link_emissao,
             sd.instrucoes, sd.observacoes_cliente, sd.modelo_url, sd.exemplo_url,
             sd.orgao_emissor, sd.prazo_recomendado_dias, sd.obrigatorio, sd.ordem
        FROM public.qa_servicos_documentos sd
       WHERE sd.servico_id = p_servico_id
         AND sd.ativo = true
         AND (sd.condicao_profissional IS NULL OR sd.condicao_profissional = v_proc.condicao)
    ),
    upd AS (
      UPDATE public.qa_processo_documentos pd
         SET nome_documento = d.nome_documento,
             etapa          = d.etapa,
             validade_dias  = d.validade_dias,
             formato_aceito = d.formato_aceito,
             regra_validacao = d.regra_validacao,
             link_emissao    = d.link_emissao,
             instrucoes      = d.instrucoes,
             observacoes_cliente = d.observacoes_cliente,
             modelo_url      = d.modelo_url,
             exemplo_url     = d.exemplo_url,
             orgao_emissor   = d.orgao_emissor,
             prazo_recomendado_dias = d.prazo_recomendado_dias,
             ordem           = d.ordem,
             obrigatorio     = COALESCE(d.obrigatorio, pd.obrigatorio),
             updated_at      = now()
        FROM desejados d
       WHERE pd.processo_id = v_proc.id
         AND pd.tipo_documento = d.tipo_documento
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_upd_proc FROM upd;

    WITH cat AS (
      SELECT sd.tipo_documento
        FROM public.qa_servicos_documentos sd
       WHERE sd.servico_id = p_servico_id
         AND sd.ativo = true
         AND (sd.condicao_profissional IS NULL OR sd.condicao_profissional = v_proc.condicao)
    ),
    arq AS (
      UPDATE public.qa_processo_documentos pd
         SET status = 'nao_aplicavel',
             observacoes = COALESCE(pd.observacoes,'') ||
                           CASE WHEN COALESCE(pd.observacoes,'')='' THEN '' ELSE E'\n' END ||
                           '[' || v_now_txt || '] Exigência removida do catálogo do serviço — dispensada automaticamente.',
             campos_complementares_json = COALESCE(pd.campos_complementares_json,'{}'::jsonb)
               || jsonb_build_object(
                    'removido_do_catalogo', true,
                    'removido_em', now(),
                    'motivo', 'Exigência removida do catálogo do serviço',
                    'status_anterior', pd.status
                  ),
             updated_at = now()
       WHERE pd.processo_id = v_proc.id
         AND NOT EXISTS (SELECT 1 FROM cat c WHERE c.tipo_documento = pd.tipo_documento)
         AND pd.arquivo_storage_key IS NULL
         AND pd.status NOT IN ('aprovado','validado','dispensado','dispensado_grupo','dispensado_por_reaproveitamento','nao_aplicavel','concluido','concluído')
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_arq_proc FROM arq;

    SELECT COUNT(*) INTO v_pres_proc
      FROM public.qa_processo_documentos pd
     WHERE pd.processo_id = v_proc.id
       AND NOT EXISTS (
         SELECT 1 FROM public.qa_servicos_documentos sd
          WHERE sd.servico_id = p_servico_id
            AND sd.ativo = true
            AND sd.tipo_documento = pd.tipo_documento
            AND (sd.condicao_profissional IS NULL OR sd.condicao_profissional = v_proc.condicao)
       )
       AND (pd.arquivo_storage_key IS NOT NULL
            OR pd.status IN ('aprovado','validado','dispensado','dispensado_grupo','dispensado_por_reaproveitamento','concluido','concluído'));

    v_ins_total  := v_ins_total  + COALESCE(v_ins_proc,0);
    v_upd_total  := v_upd_total  + COALESCE(v_upd_proc,0);
    v_arq_total  := v_arq_total  + COALESCE(v_arq_proc,0);
    v_pres_total := v_pres_total + COALESCE(v_pres_proc,0);

    IF COALESCE(v_ins_proc,0) + COALESCE(v_upd_proc,0) + COALESCE(v_arq_proc,0) > 0 THEN
      INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, ator)
      VALUES (
        v_proc.id, 'checklist_sincronizado_com_catalogo',
        format('Sincronizado com catálogo do serviço %s: %s adicionadas, %s atualizadas, %s arquivadas, %s preservadas com arquivo.',
               p_servico_id, COALESCE(v_ins_proc,0), COALESCE(v_upd_proc,0),
               COALESCE(v_arq_proc,0), COALESCE(v_pres_proc,0)),
        'equipe'
      );
    END IF;
  END LOOP;

  processos_processados   := v_procs_total;
  exigencias_adicionadas  := v_ins_total;
  exigencias_atualizadas  := v_upd_total;
  exigencias_arquivadas   := v_arq_total;
  documentos_preservados  := v_pres_total;
  RETURN NEXT;
END $function$;