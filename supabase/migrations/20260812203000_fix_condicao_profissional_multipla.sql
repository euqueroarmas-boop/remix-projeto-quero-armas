-- =============================================================================
-- FIX: condicao_profissional com virgula era invisivel para o checklist
--
-- `qa_servicos_documentos.condicao_profissional` aceita VARIAS condicoes
-- separadas por virgula ("autonomo,empresario"), mas
-- `qa_explodir_checklist_processo` comparava por IGUALDADE EXATA. So casava com
-- o valor unico.
--
-- Efeito em producao: o autonomo recebia apenas o CCMEI (unico com valor unico)
-- e nunca o Cartao CNPJ (ordem 170), o QSA (180) e a Nota Fiscal (190). O mesmo
-- valia para empresario, funcionario_publico e seguranca_publica -- ou seja,
-- toda condicao cujas exigencias estao marcadas com mais de um valor.
--
-- A edge function qa-processo-set-condicao ja quebrava a string por virgula.
-- As duas implementacoes da mesma regra discordavam; o SQL estava errado.
--
-- Detectado no processo do cliente FABIO CORREIA DE MELO (autonomo, criado em
-- 06/08/2026): checklist ia do CCMEI direto para Idoneidade, pulando o grupo
-- Ocupacao Licita por nao ter o que exigir.
--
-- Reexecutavel: a funcao e ADITIVA (so insere tipo que ainda nao existe no
-- processo, nunca apaga nem reseta status) e o backfill so toca em processo com
-- exigencia comprovadamente faltando.
-- =============================================================================

BEGIN;

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
  v_respostas           jsonb;
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

  v_condicao := lower(btrim(COALESCE(NULLIF(v_proc.condicao_profissional, ''), 'indefinido')));
  v_profissao_upper := NULLIF(TRIM(UPPER(COALESCE(v_cli.profissao, ''))), '');
  v_modalidade := NULLIF(TRIM(LOWER(COALESCE(v_proc.modalidade, ''))), '');

  -- Respostas ja conhecidas: questionario do processo + colunas dedicadas.
  v_respostas := COALESCE(v_proc.respostas_questionario_json, '{}'::jsonb)
    || jsonb_strip_nulls(jsonb_build_object(
         'condicao_profissional', NULLIF(v_proc.condicao_profissional, '')
       ));

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
       -- CORRIGIDO: `condicao_profissional` aceita VARIAS condicoes separadas por
       -- virgula ("autonomo,empresario"). A igualdade exata so casava com o valor
       -- unico, entao Cartao CNPJ, QSA e Nota Fiscal nunca entravam no checklist
       -- de autonomo/empresario (e Identidade Funcional/contracheque nunca
       -- entravam no de funcionario_publico/seguranca_publica). Mesma regra que a
       -- edge function qa-processo-set-condicao ja usava.
       AND (sd.condicao_profissional IS NULL
            OR v_condicao = ANY (
                 SELECT btrim(lower(x))
                   FROM unnest(string_to_array(sd.condicao_profissional, ',')) AS x
               ))
       AND (sd.condicao_modalidade IS NULL
            OR v_modalidade IS NULL
            OR v_modalidade = ANY(sd.condicao_modalidade))
       -- Placeholder da condicao profissional: nunca renasce depois de respondido.
       AND NOT (sd.tipo_documento = 'renda_definir_condicao' AND v_condicao <> 'indefinido')
       -- Qualquer pergunta ja respondida nao volta como pendencia.
       AND NOT (
         COALESCE(sd.regra_validacao ->> 'tipo', '') = 'pergunta'
         AND COALESCE(sd.regra_validacao ->> 'chave', '') <> ''
         AND COALESCE(v_respostas ->> (sd.regra_validacao ->> 'chave'), '') <> ''
       )
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

-- =============================================================================
-- BACKFILL — recria as exigencias perdidas, apenas onde faltam de fato.
-- A deteccao usa a regra CORRETA (quebra por virgula), entao o laco so alcanca
-- processo realmente afetado pelo bug.
-- =============================================================================
DO $backfill$
DECLARE
  r record;
BEGIN
  FOR r IN
    WITH proc AS (
      SELECT p.id, p.servico_id,
             lower(btrim(COALESCE(NULLIF(p.condicao_profissional, ''), 'indefinido'))) AS condicao,
             NULLIF(btrim(lower(COALESCE(p.modalidade, ''))), '') AS modalidade
        FROM public.qa_processos p
       WHERE COALESCE(p.status, 'ativo') NOT IN
             ('finalizado','deferido','indeferido','cancelado','arquivado')
         AND p.servico_id IS NOT NULL
    )
    SELECT DISTINCT pr.id
      FROM proc pr
      JOIN public.qa_servicos_documentos sd
        ON sd.servico_id = pr.servico_id
       AND sd.ativo = true
       AND sd.condicao_profissional LIKE '%,%'
       AND pr.condicao = ANY (
             SELECT btrim(lower(x))
               FROM unnest(string_to_array(sd.condicao_profissional, ',')) AS x
           )
       AND (sd.condicao_modalidade IS NULL
            OR pr.modalidade IS NULL
            OR pr.modalidade = ANY (sd.condicao_modalidade))
     WHERE NOT EXISTS (
       SELECT 1 FROM public.qa_processo_documentos pd
        WHERE pd.processo_id = pr.id
          AND pd.tipo_documento = sd.tipo_documento
     )
  LOOP
    PERFORM public.qa_explodir_checklist_processo(r.id);
  END LOOP;
END
$backfill$;

COMMIT;
