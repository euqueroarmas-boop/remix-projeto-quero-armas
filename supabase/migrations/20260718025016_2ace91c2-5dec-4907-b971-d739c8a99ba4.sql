
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
  v_ano_atual           integer := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
  v_ins                 integer := 0;
  v_exi                 integer := 0;
  v_dup                 integer := 0;
  v_invalid             integer := 0;
  v_reaprov             integer := 0;
  v_reaprov_ano         integer := 0;
  v_prevalid            integer := 0;
  v_endereco_seed       integer := 0;
  v_endereco_aproveit   integer := 0;
  v_inserted_tipos      text[] := ARRAY[]::text[];
  v_existing_tipos      text[] := ARRAY[]::text[];
  v_duplicate_tipos     text[] := ARRAY[]::text[];
  v_invalid_items       jsonb := '[]'::jsonb;
  v_reuso_detalhes      jsonb := '[]'::jsonb;
  r                     record;
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
      instrucoes, observacoes_cliente, modelo_url, exemplo_url, orgao_emissor,
      prazo_recomendado_dias, escopo
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
           COALESCE(d.escopo, 'processo')
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

  /* ============================================================
   * PASSO 1 — Reaproveitamento por tipo (exato ou via alias).
   * ============================================================ */
  WITH cofre_validos AS (
    SELECT dc.id, dc.tipo_documento, dc.arquivo_storage_path, dc.arquivo_nome,
           dc.ia_dados_extraidos, dc.data_emissao, dc.data_validade, dc.created_at,
           upper(unaccent(coalesce(dc.arquivo_nome, '') || ' ' || coalesce(dc.ia_dados_extraidos::text, ''))) AS origem_txt
      FROM public.qa_documentos_cliente dc
     WHERE dc.qa_cliente_id = v_proc.cliente_id
       AND (dc.validado_admin = true OR dc.status = 'aprovado')
       AND dc.arquivo_storage_path IS NOT NULL
       AND (dc.data_validade IS NULL OR dc.data_validade >= CURRENT_DATE)
  ),
  candidatos AS (
    SELECT DISTINCT ON (pd.id)
           pd.id AS processo_documento_id,
           pd.tipo_documento,
           cv.id AS hub_documento_id,
           cv.arquivo_storage_path,
           cv.arquivo_nome,
           cv.ia_dados_extraidos,
           cv.data_emissao,
           cv.data_validade
      FROM public.qa_processo_documentos pd
      JOIN cofre_validos cv
        ON (
          pd.tipo_documento = cv.tipo_documento
          OR pd.tipo_documento IN (
            SELECT processo_tipo
            FROM public.qa_tipo_documento_aliases
            WHERE hub_tipo = cv.tipo_documento
          )
        )
     WHERE pd.processo_id = p_processo_id
       AND pd.status IN ('pendente','rejeitado')
       AND pd.arquivo_storage_key IS NULL
       AND (
         cv.tipo_documento <> 'antecedentes_militar'
         OR pd.tipo_documento NOT IN ('certidao_criminal_tjmsp', 'certidao_crimes_militares_stm')
         OR (pd.tipo_documento = 'certidao_criminal_tjmsp' AND (cv.origem_txt LIKE '%TJM%' OR cv.origem_txt LIKE '%JUSTICA MILITAR/SP%' OR cv.origem_txt LIKE '%JUSTICA MILITAR DO ESTADO DE SAO PAULO%'))
         OR (pd.tipo_documento = 'certidao_crimes_militares_stm' AND (cv.origem_txt LIKE '%STM%' OR cv.origem_txt LIKE '%JUSTICA MILITAR DA UNIAO%' OR cv.origem_txt LIKE '%SUPERIOR TRIBUNAL MILITAR%'))
       )
     ORDER BY pd.id, cv.created_at DESC
  ),
  reaproveitados AS (
    UPDATE public.qa_processo_documentos pd
       SET arquivo_storage_key = c.arquivo_storage_path,
           arquivo_url = c.arquivo_storage_path,
           status = 'aprovado',
           data_envio = now(),
           data_validacao = now(),
           motivo_rejeicao = NULL,
           dados_extraidos_json = c.ia_dados_extraidos,
           observacoes = COALESCE(pd.observacoes, '') ||
             CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
             '[' || to_char(now(),'YYYY-MM-DD HH24:MI') || '] Reaproveitado automaticamente da Central de Documentos (doc #' || c.hub_documento_id::text || ')',
           updated_at = now()
      FROM candidatos c
     WHERE pd.id = c.processo_documento_id
     RETURNING pd.id AS processo_documento_id, pd.tipo_documento,
               c.hub_documento_id, c.arquivo_nome, c.data_emissao, c.data_validade
  )
  SELECT COUNT(*),
         COALESCE(jsonb_agg(jsonb_build_object(
           'exigencia_id', processo_documento_id,
           'tipo_documento', tipo_documento,
           'documento_id', hub_documento_id,
           'arquivo_nome', arquivo_nome,
           'data_emissao', data_emissao,
           'data_validade', data_validade,
           'motivo_match', 'tipo_ou_alias'
         )), '[]'::jsonb)
    INTO v_reaprov, v_reuso_detalhes
    FROM reaproveitados;

  /* ============================================================
   * PASSO 2 — Reaproveitamento por ANO (comprovante_endereco_ano_YYYY)
   *   Casa "comprovante_endereco_ano_YYYY" contra hub
   *   comprovante_residencia com EXTRACT(YEAR FROM data_emissao)=YYYY.
   *   Ano corrente/futuro exige data_validade >= hoje (ou NULL) — anos
   *   passados servem para prova histórica de residência.
   * ============================================================ */
  WITH slots_ano AS (
    SELECT pd.id AS processo_documento_id,
           pd.tipo_documento,
           substring(pd.tipo_documento FROM 'comprovante_endereco_ano_(\d{4})')::int AS ano_alvo
      FROM public.qa_processo_documentos pd
     WHERE pd.processo_id = p_processo_id
       AND pd.status IN ('pendente','rejeitado')
       AND pd.arquivo_storage_key IS NULL
       AND pd.tipo_documento ~ '^comprovante_endereco_ano_\d{4}$'
  ),
  hub_residencia AS (
    SELECT dc.id, dc.arquivo_storage_path, dc.arquivo_nome,
           dc.ia_dados_extraidos, dc.data_emissao, dc.data_validade, dc.created_at,
           EXTRACT(YEAR FROM dc.data_emissao)::int AS ano_emissao
      FROM public.qa_documentos_cliente dc
     WHERE dc.qa_cliente_id = v_proc.cliente_id
       AND dc.tipo_documento = 'comprovante_residencia'
       AND (dc.validado_admin = true OR dc.status = 'aprovado')
       AND dc.arquivo_storage_path IS NOT NULL
       AND dc.data_emissao IS NOT NULL
  ),
  candidatos_ano AS (
    SELECT DISTINCT ON (s.processo_documento_id)
           s.processo_documento_id, s.tipo_documento, s.ano_alvo,
           h.id AS hub_documento_id, h.arquivo_storage_path, h.arquivo_nome,
           h.ia_dados_extraidos, h.data_emissao, h.data_validade
      FROM slots_ano s
      JOIN hub_residencia h ON h.ano_emissao = s.ano_alvo
     WHERE (
       s.ano_alvo < v_ano_atual
       OR (h.data_validade IS NULL OR h.data_validade >= CURRENT_DATE)
     )
     ORDER BY s.processo_documento_id, h.data_emissao DESC, h.created_at DESC
  ),
  reaproveitados_ano AS (
    UPDATE public.qa_processo_documentos pd
       SET arquivo_storage_key = c.arquivo_storage_path,
           arquivo_url = c.arquivo_storage_path,
           status = 'aprovado',
           data_envio = now(),
           data_validacao = now(),
           motivo_rejeicao = NULL,
           dados_extraidos_json = c.ia_dados_extraidos,
           observacoes = COALESCE(pd.observacoes, '') ||
             CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
             '[' || to_char(now(),'YYYY-MM-DD HH24:MI') || '] Reaproveitado da Central de Documentos por ano de emissão '
             || c.ano_alvo::text || ' (doc #' || c.hub_documento_id::text || ')',
           updated_at = now()
      FROM candidatos_ano c
     WHERE pd.id = c.processo_documento_id
     RETURNING pd.id AS processo_documento_id, pd.tipo_documento,
               c.hub_documento_id, c.arquivo_nome, c.data_emissao, c.data_validade, c.ano_alvo
  )
  SELECT COUNT(*),
         v_reuso_detalhes || COALESCE(jsonb_agg(jsonb_build_object(
           'exigencia_id', processo_documento_id,
           'tipo_documento', tipo_documento,
           'documento_id', hub_documento_id,
           'arquivo_nome', arquivo_nome,
           'data_emissao', data_emissao,
           'data_validade', data_validade,
           'motivo_match', 'ano_emissao=' || ano_alvo::text
         )), '[]'::jsonb)
    INTO v_reaprov_ano, v_reuso_detalhes
    FROM reaproveitados_ano;

  v_reaprov := v_reaprov + COALESCE(v_reaprov_ano, 0);

  /* Auditoria por documento reaproveitado */
  IF jsonb_array_length(v_reuso_detalhes) > 0 THEN
    FOR r IN SELECT * FROM jsonb_array_elements(v_reuso_detalhes) AS x(item) LOOP
      INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
      VALUES (
        p_processo_id,
        'documento_reaproveitado_hub',
        format('Exigência %s atendida por documento #%s da Central de Documentos.',
               (r.item->>'tipo_documento'), (r.item->>'documento_id')),
        r.item,
        'sistema'
      );
    END LOOP;
  END IF;

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

  IF v_proc.servico_id IN (31, 44, 50, 51) THEN
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

  /* Resumo específico do reaproveitamento a partir da Central */
  INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
  VALUES (
    p_processo_id,
    'reaproveitamento_hub_resumo',
    format('Reaproveitamento da Central: %s exigência(s) atendida(s) automaticamente.', v_reaprov),
    jsonb_build_object(
      'total_reaproveitadas', v_reaprov,
      'total_pendentes', (
        SELECT COUNT(*) FROM public.qa_processo_documentos
         WHERE processo_id = p_processo_id AND status IN ('pendente','rejeitado')
      ),
      'total_exigencias', (
        SELECT COUNT(*) FROM public.qa_processo_documentos WHERE processo_id = p_processo_id
      ),
      'detalhes', v_reuso_detalhes
    ),
    'sistema'
  );

  inseridos := v_ins; ja_existentes := v_exi;
  reaproveitados_cofre := v_reaprov; pre_validados := v_prevalid;
  RETURN NEXT;
END;
$function$;
