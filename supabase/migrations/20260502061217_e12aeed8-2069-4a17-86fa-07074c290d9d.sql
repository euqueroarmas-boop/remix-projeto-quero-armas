ALTER TABLE public.qa_processo_documentos
  ADD COLUMN IF NOT EXISTS ano_competencia smallint;

CREATE INDEX IF NOT EXISTS idx_qa_proc_docs_ano_competencia
  ON public.qa_processo_documentos(processo_id, ano_competencia)
  WHERE ano_competencia IS NOT NULL;

COMMENT ON COLUMN public.qa_processo_documentos.ano_competencia IS
  'Ano de referência do documento (ex.: comprovante de endereço de 2024).';

CREATE OR REPLACE FUNCTION public.qa_categoria_documento(tipo text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(coalesce(tipo,'')) LIKE 'certidao%' OR lower(coalesce(tipo,'')) LIKE '%antecedentes%' THEN 'antecedentes'
    WHEN lower(coalesce(tipo,'')) LIKE '%laudo%' OR lower(coalesce(tipo,'')) LIKE '%psicologic%' OR lower(coalesce(tipo,'')) LIKE '%capacidade_tecnica%' OR lower(coalesce(tipo,'')) LIKE '%tiro%' OR lower(coalesce(tipo,'')) LIKE '%aptidao%' THEN 'exames'
    WHEN lower(coalesce(tipo,'')) LIKE '%endereco%' OR lower(coalesce(tipo,'')) LIKE '%residenc%' THEN 'endereco'
    WHEN lower(coalesce(tipo,'')) LIKE 'declaracao%' OR lower(coalesce(tipo,'')) LIKE 'dsa_%' OR lower(coalesce(tipo,'')) LIKE '%compromisso%' THEN 'declaracoes'
    ELSE 'outros'
  END;
$$;

CREATE OR REPLACE FUNCTION public.qa_seed_endereco_5_anos(p_processo_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proc      public.qa_processos%ROWTYPE;
  v_ano_atual smallint := EXTRACT(YEAR FROM CURRENT_DATE)::smallint;
  v_ano       smallint;
  v_tipo      text;
  v_nome      text;
  v_rows      integer := 0;
  v_total     integer := 0;
BEGIN
  SELECT * INTO v_proc FROM public.qa_processos WHERE id = p_processo_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF v_proc.servico_id NOT IN (31, 44) THEN RETURN 0; END IF;

  FOR i IN 0..4 LOOP
    v_ano  := v_ano_atual - i;
    v_tipo := 'comprovante_endereco_ano_' || v_ano::text;
    v_nome := CASE WHEN i = 0
                   THEN 'Comprovante de Endereço Atual — Ano ' || v_ano::text
                   ELSE 'Comprovante de Endereço — Ano ' || v_ano::text
              END;

    INSERT INTO public.qa_processo_documentos (
      processo_id, cliente_id, tipo_documento, nome_documento,
      etapa, status, obrigatorio, validade_dias, ano_competencia
    )
    SELECT p_processo_id, v_proc.cliente_id, v_tipo, v_nome,
           'base', 'pendente', true, 90, v_ano
    WHERE NOT EXISTS (
      SELECT 1 FROM public.qa_processo_documentos
       WHERE processo_id = p_processo_id
         AND tipo_documento = v_tipo
    );
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_total := v_total + v_rows;
  END LOOP;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.qa_seed_endereco_5_anos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_seed_endereco_5_anos(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.qa_aproveitar_endereco_cadastro_publico(p_processo_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proc        public.qa_processos%ROWTYPE;
  v_path        text;
  v_ano_atual   smallint := EXTRACT(YEAR FROM CURRENT_DATE)::smallint;
  v_slot_id     uuid;
  v_atualizados integer := 0;
BEGIN
  SELECT * INTO v_proc FROM public.qa_processos WHERE id = p_processo_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF v_proc.cliente_id IS NULL THEN RETURN 0; END IF;

  SELECT comprovante_endereco_path
    INTO v_path
    FROM public.qa_clientes_cadastro_publico
   WHERE qa_cliente_id = v_proc.cliente_id
     AND comprovante_endereco_path IS NOT NULL
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_path IS NULL THEN RETURN 0; END IF;

  SELECT id INTO v_slot_id
    FROM public.qa_processo_documentos
   WHERE processo_id = p_processo_id
     AND tipo_documento = 'comprovante_endereco_ano_' || v_ano_atual::text
     AND status = 'pendente'
     AND arquivo_storage_key IS NULL
   LIMIT 1;

  IF v_slot_id IS NULL THEN RETURN 0; END IF;

  UPDATE public.qa_processo_documentos
     SET arquivo_storage_key = v_path,
         arquivo_url         = v_path,
         status              = 'em_analise',
         data_envio          = COALESCE(data_envio, now()),
         observacoes         = COALESCE(observacoes,'') ||
           CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
           '[' || to_char(now(),'YYYY-MM-DD HH24:MI') ||
           '] Aproveitado automaticamente do comprovante enviado no cadastro público.',
         updated_at = now()
   WHERE id = v_slot_id;
  GET DIAGNOSTICS v_atualizados = ROW_COUNT;

  IF v_atualizados > 0 THEN
    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
    VALUES (
      p_processo_id,
      'endereco_cadastro_publico_aproveitado',
      'Comprovante de endereço do cadastro público vinculado ao slot do ano ' || v_ano_atual::text,
      jsonb_build_object('ano_competencia', v_ano_atual, 'doc_id', v_slot_id, 'storage_path', v_path),
      'sistema'
    );
  END IF;

  RETURN v_atualizados;
END;
$$;

REVOKE ALL ON FUNCTION public.qa_aproveitar_endereco_cadastro_publico(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_aproveitar_endereco_cadastro_publico(uuid) TO authenticated, service_role;

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

  -- SLICE 2.1: 5 slots de endereço + auto-aproveitamento (apenas Concessão CR).
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

REVOKE ALL ON FUNCTION public.qa_explodir_checklist_processo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_explodir_checklist_processo(uuid) TO authenticated, service_role;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.qa_processos WHERE servico_id IN (31, 44) LOOP
    BEGIN
      PERFORM public.qa_seed_endereco_5_anos(r.id);
      PERFORM public.qa_aproveitar_endereco_cadastro_publico(r.id);
      PERFORM public.qa_recalcular_prazos_processo(r.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'backfill 5anos falhou para %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;