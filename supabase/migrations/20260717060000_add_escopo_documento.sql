-- Adiciona campo `escopo` em qa_servicos_documentos e qa_processo_documentos
-- para classificação correta nas 3 caixas do assistente de documentação.
--
-- Valores: 'permanente' | 'arma' | 'processo'
--
-- Regra:
--   permanente → documento pessoal reutilizável em qualquer processo do mesmo cliente
--   arma       → documento vinculado a uma arma específica do acervo
--   processo   → exigência específica deste processo (default)
--
-- O classificador TypeScript (documentosCaixaClassifier.ts) usa este campo
-- como fonte primária, mantendo arma_id IS NOT NULL como override final.

ALTER TABLE public.qa_servicos_documentos
  ADD COLUMN IF NOT EXISTS escopo text NOT NULL DEFAULT 'processo'
  CONSTRAINT qa_servicos_documentos_escopo_check CHECK (escopo IN ('permanente', 'arma', 'processo'));

ALTER TABLE public.qa_processo_documentos
  ADD COLUMN IF NOT EXISTS escopo text NOT NULL DEFAULT 'processo'
  CONSTRAINT qa_processo_documentos_escopo_check CHECK (escopo IN ('permanente', 'arma', 'processo'));

-- ─── Populate qa_servicos_documentos ─────────────────────────────────────────

-- 1. Slugs canônicos do Hub (hub_tipo) que são permanentes
UPDATE public.qa_servicos_documentos SET escopo = 'permanente'
WHERE tipo_documento IN (
  -- identificação civil
  'rg_com_cpf', 'cin', 'cnh', 'cpf',
  -- residência
  'comprovante_residencia', 'declaracao_responsavel_imovel',
  -- renda / ocupação
  'ctps', 'renda_holerite_mes_atual', 'renda_holerite_funcionario_publico',
  'renda_cartao_cnpj', 'renda_contrato_social', 'renda_cnpj_autonomo',
  'renda_nf_recente', 'renda_comprovante_beneficio', 'renda_extrato_inss',
  'renda_nf_empresa', 'renda_qsa',
  -- antecedentes
  'antecedentes_criminais', 'antecedentes_federal', 'antecedentes_estadual',
  'antecedentes_militar', 'antecedentes_eleitoral',
  -- certidões (slugs específicos de SP/Federal)
  'certidao_antecedentes_policia_civil_sp', 'certidao_crimes_eleitorais_tse',
  'certidao_crimes_militares_stm', 'certidao_criminal_tjmsp',
  'certidao_federal_trf3_regional', 'certidao_federal_trf3_sjsp_jef',
  'certidao_tjsp_distribuicao_criminal', 'certidao_tjsp_execucoes_criminais',
  -- declarações pessoais
  'declaracao_sem_inquerito_processo_criminal', 'declaracao_guarda_responsavel',
  'declaracao_correlata', 'declaracao_homonimia',
  'declaracao_guarda_acervo_1endereco', 'declaracao_guarda_acervo_2enderecos',
  -- CAC / habitualidade (pessoal, reutilizável)
  'comprovante_habitualidade', 'comprovante_clube_tiro', 'comprovante_competicao',
  'comprovante_filiacao_entidade_tiro', 'declaracao_habitualidade_clube',
  'declaracao_compromisso_habitualidade', 'declaracao_compromisso_treino',
  -- laudos e exames
  'laudo_psicologico', 'laudo_capacidade_tecnica',
  -- CR é credencial pessoal (sem arma_id)
  'cr'
);

-- 2. Padrões por prefixo — cobre slugs dinâmicos (comprovante_endereco_ano_2024, etc.)
UPDATE public.qa_servicos_documentos SET escopo = 'permanente'
WHERE escopo = 'processo'
  AND (
    tipo_documento ILIKE 'renda_%'
    OR tipo_documento ILIKE 'antecedentes_%'
    OR tipo_documento ILIKE 'certidao_%'
    OR tipo_documento ILIKE 'laudo_%'
    OR tipo_documento ILIKE 'declaracao_%'
    OR tipo_documento ILIKE 'comprovante_endereco_ano_%'
    OR tipo_documento ILIKE 'comprovante_filiacao_%'
    OR tipo_documento ILIKE 'comprovante_habitualidade%'
    OR tipo_documento ILIKE 'comprovante_clube%'
    OR tipo_documento ILIKE 'declaracao_habitualidade_%'
    OR tipo_documento ILIKE 'declaracao_compromisso_%'
  );

-- 3. Documentos de arma (craf, gte, etc. com arma_id no processo)
UPDATE public.qa_servicos_documentos SET escopo = 'arma'
WHERE tipo_documento IN (
  'craf', 'sinarm', 'gt', 'gte', 'autorizacao_compra', 'nota_fiscal_arma'
);

-- ─── Backfill qa_processo_documentos ─────────────────────────────────────────

-- Propagação direta por tipo_documento (cobre a maioria dos itens)
UPDATE public.qa_processo_documentos pd
   SET escopo = sd.escopo
  FROM (
    SELECT DISTINCT ON (tipo_documento) tipo_documento, escopo
      FROM public.qa_servicos_documentos
     WHERE escopo <> 'processo'
     ORDER BY tipo_documento, escopo
  ) sd
 WHERE pd.tipo_documento = sd.tipo_documento
   AND pd.escopo = 'processo';

-- Propagação por padrão para os que ainda ficaram como 'processo'
UPDATE public.qa_processo_documentos SET escopo = 'permanente'
WHERE escopo = 'processo'
  AND (
    tipo_documento ILIKE 'renda_%'
    OR tipo_documento ILIKE 'antecedentes_%'
    OR tipo_documento ILIKE 'certidao_%'
    OR tipo_documento ILIKE 'laudo_%'
    OR tipo_documento ILIKE 'declaracao_%'
    OR tipo_documento ILIKE 'comprovante_endereco_ano_%'
    OR tipo_documento ILIKE 'comprovante_filiacao_%'
    OR tipo_documento ILIKE 'comprovante_habitualidade%'
    OR tipo_documento ILIKE 'comprovante_clube%'
    OR tipo_documento ILIKE 'declaracao_habitualidade_%'
    OR tipo_documento ILIKE 'declaracao_compromisso_%'
  );

-- ─── Atualiza qa_explodir_checklist_processo para copiar escopo ────────────

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

  -- Reaproveitamento do cofre com suporte a aliases de tipo_documento.
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
       AND (
         pd.tipo_documento = cv.tipo_documento
         OR pd.tipo_documento IN (
           SELECT processo_tipo
           FROM public.qa_tipo_documento_aliases
           WHERE hub_tipo = cv.tipo_documento
         )
       )
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

  inseridos := v_ins; ja_existentes := v_exi;
  reaproveitados_cofre := v_reaprov; pre_validados := v_prevalid;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.qa_explodir_checklist_processo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_explodir_checklist_processo(uuid) TO authenticated, service_role;
