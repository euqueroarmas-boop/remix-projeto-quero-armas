-- =============================================================================
-- Corrige dois buracos no reaproveitamento automático da Central de Documentos
--
-- PROBLEMA 1 — TRF3 não dispensa o slot do processo
--   A migration 20260731131500 reclassificou docs do Hub de tipos antigos para
--   'antecedentes_federal_trf3_regional'. O catálogo de aliases só tinha entradas
--   para 'antecedentes_federal' e 'antecedentes_federal_regional_trf3' (dois slugs
--   diferentes!). Resultado: Hub tem a certidão TRF3 aprovada, o slot
--   'certidao_federal_trf3_regional' continua pendente para sempre.
--
-- PROBLEMA 2 — TJM não dispensa o slot do processo
--   A migration 20260731120000 fez a separação TJM × STM criando o tipo
--   'antecedentes_militar_estadual'. O alias 'certidao_antecedentes_criminais_militar'
--   passou a apontar só para 'antecedentes_militar_estadual'. Mas docs do Hub
--   enviados ANTES dessa data continuam com tipo 'antecedentes_militar' (antigo).
--   Resultado: Hub tem a certidão TJM aprovada, o slot
--   'certidao_antecedentes_criminais_militar' continua pendente para sempre.
--
-- PROBLEMA 3 — TJSP: aliases só cobrem o tipo genérico 'antecedentes_estadual'
--   Se algum doc do Hub foi classificado como 'antecedentes_estadual_distribuicao'
--   ou 'antecedentes_estadual_execucoes', o slot específico não era satisfeito.
--
-- Idempotente.
-- =============================================================================

BEGIN;

-- ─── 1) Alias faltando: TRF3 tipo antigo do Hub ──────────────────────────────
INSERT INTO public.qa_tipo_documento_aliases (processo_tipo, hub_tipo) VALUES
  ('certidao_federal_trf3_regional',    'antecedentes_federal_trf3_regional'),
  ('certidao_federal_trf3_sjsp_jef',    'antecedentes_federal_trf3_regional')
ON CONFLICT DO NOTHING;

-- ─── 2) Aliases TJSP: tipos específicos de distribuição e execuções ───────────
INSERT INTO public.qa_tipo_documento_aliases (processo_tipo, hub_tipo) VALUES
  ('certidao_tjsp_distribuicao_criminal', 'antecedentes_estadual_distribuicao'),
  ('certidao_tjsp_execucoes_criminais',   'antecedentes_estadual_execucoes'),
  -- Certidões estaduais genéricas também devem satisfazer slots TJSP específicos
  ('certidao_tjsp_distribuicao_criminal', 'antecedentes_estadual'),
  ('certidao_tjsp_execucoes_criminais',   'antecedentes_estadual'),
  -- Alias de compatibilidade retroativa: TJM com tipo legado no Hub.
  -- O RPC filtra por texto para evitar que STM satisfaça o slot TJM.
  ('certidao_antecedentes_criminais_militar', 'antecedentes_militar')
ON CONFLICT DO NOTHING;

-- ─── 3) Reclassifica certidões militares ESTADUAIS (TJM) no Hub ──────────────
-- Docs enviados antes de 20260731 têm tipo 'antecedentes_militar' (indiferenciado).
-- Onde o conteúdo identifica TJM (Tribunal de Justiça Militar estadual), altera
-- para 'antecedentes_militar_estadual' para que o alias correto seja acionado.
-- Docs de STM sem marcadores TJM não são tocados.
UPDATE public.qa_documentos_cliente
   SET tipo_documento = 'antecedentes_militar_estadual',
       updated_at = now()
 WHERE tipo_documento = 'antecedentes_militar'
   AND COALESCE(status, '') NOT IN ('excluido', 'arquivado')
   AND (
     -- Detecta TJM pelo conteúdo do arquivo ou dados extraídos pela IA
     upper(unaccent(
       COALESCE(arquivo_nome,         '') || ' ' ||
       COALESCE(nome_documento,       '') || ' ' ||
       COALESCE(ia_dados_extraidos::text, '')
     )) ~ '(TJM|TRIBUNAL DE JUSTICA MILITAR|JUSTICA MILITAR DO ESTADO|JUSTICA MILITAR ESTADUAL)'
     -- Garante que não é STM / Militar da União
     AND upper(unaccent(
       COALESCE(arquivo_nome,         '') || ' ' ||
       COALESCE(nome_documento,       '') || ' ' ||
       COALESCE(ia_dados_extraidos::text, '')
     )) !~ '(STM|SUPERIOR TRIBUNAL MILITAR|JUSTICA MILITAR DA UNIAO|JUSTICA MILITAR FEDERAL)'
   );

-- ─── 4) Atualiza o RPC para desambiguar 'antecedentes_militar' por texto ──────
-- Acrescenta 'certidao_antecedentes_criminais_militar' à lista de tipos que exigem
-- verificação textual quando o doc do Hub é 'antecedentes_militar' (tipo legado).
-- Assim um STM no Hub nunca satisfaz o slot TJM, e vice-versa.
CREATE OR REPLACE FUNCTION public.qa_reaproveitar_documentos_hub_processo(p_processo_id uuid, p_origem text DEFAULT 'automatico'::text)
RETURNS TABLE(reaproveitados integer, pendentes integer, total_exigencias integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_proc public.qa_processos%ROWTYPE;
  v_cli public.qa_clientes%ROWTYPE;
  v_ano_atual integer := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
  v_total integer := 0;
  v_pendentes integer := 0;
  v_reaproveitados integer := 0;
  v_reuso_detalhes jsonb := '[]'::jsonb;
  r record;
BEGIN
  SELECT * INTO v_proc FROM public.qa_processos WHERE id = p_processo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processo % nao encontrado', p_processo_id;
  END IF;

  SELECT * INTO v_cli FROM public.qa_clientes WHERE id = v_proc.cliente_id;

  /* PASSO 1 — tipo exato ou alias, exceto slots históricos de endereço */
  WITH cofre_validos AS (
    SELECT dc.id,
           dc.tipo_documento,
           dc.arquivo_storage_path,
           dc.arquivo_nome,
           dc.ia_dados_extraidos,
           dc.data_emissao,
           dc.data_validade,
           dc.created_at,
           upper(unaccent(coalesce(dc.arquivo_nome, '') || ' ' || coalesce(dc.nome_documento, '') || ' ' || coalesce(dc.ia_dados_extraidos::text, ''))) AS origem_txt
      FROM public.qa_documentos_cliente dc
     WHERE dc.qa_cliente_id = v_proc.cliente_id
       AND (dc.validado_admin = true OR dc.status = 'aprovado')
       AND dc.arquivo_storage_path IS NOT NULL
       AND (dc.data_validade IS NULL OR dc.data_validade >= CURRENT_DATE)
       AND NOT public.qa_comprovante_terceiro_pendente(dc.id)
  ),
  candidatos AS (
    SELECT DISTINCT ON (pd.id)
           pd.id AS processo_documento_id,
           pd.tipo_documento,
           cv.id AS hub_documento_id,
           cv.tipo_documento AS hub_tipo_documento,
           cv.arquivo_storage_path,
           cv.arquivo_nome,
           cv.ia_dados_extraidos,
           cv.data_emissao,
           cv.data_validade,
           cv.created_at
      FROM public.qa_processo_documentos pd
      JOIN cofre_validos cv
        ON (
          pd.tipo_documento = cv.tipo_documento
          OR pd.tipo_documento IN (
            SELECT processo_tipo
              FROM public.qa_tipo_documento_aliases
             WHERE hub_tipo = cv.tipo_documento
               AND processo_tipo NOT LIKE 'comprovante_endereco_ano_%'
          )
        )
     WHERE pd.processo_id = p_processo_id
       AND pd.status IN ('pendente','rejeitado','enviado','em_analise','revisao_humana')
       AND pd.arquivo_storage_key IS NULL
       AND pd.tipo_documento NOT LIKE 'comprovante_endereco_ano_%'
       -- Desambiguação do militar: 'antecedentes_militar' (tipo legado) só satisfaz
       -- o slot que o texto do documento identifica (TJM estadual ou STM federal).
       -- Sem marcador, o slot correspondente permanece pendente.
       AND (
         cv.tipo_documento <> 'antecedentes_militar'
         OR pd.tipo_documento NOT IN (
           'certidao_criminal_tjmsp',
           'certidao_crimes_militares_stm',
           'certidao_antecedentes_criminais_militar'
         )
         OR (pd.tipo_documento IN ('certidao_criminal_tjmsp','certidao_antecedentes_criminais_militar')
             AND (cv.origem_txt LIKE '%TJM%'
               OR cv.origem_txt LIKE '%TRIBUNAL DE JUSTICA MILITAR%'
               OR cv.origem_txt LIKE '%JUSTICA MILITAR/SP%'
               OR cv.origem_txt LIKE '%JUSTICA MILITAR DO ESTADO%'
               OR cv.origem_txt LIKE '%JUSTICA MILITAR ESTADUAL%'
               OR cv.origem_txt LIKE '%JUSTICA MILITAR DE SAO PAULO%'))
         OR (pd.tipo_documento = 'certidao_crimes_militares_stm'
             AND (cv.origem_txt LIKE '%STM%'
               OR cv.origem_txt LIKE '%JUSTICA MILITAR DA UNIAO%'
               OR cv.origem_txt LIKE '%SUPERIOR TRIBUNAL MILITAR%'))
       )
     ORDER BY pd.id, cv.data_validade DESC NULLS LAST, cv.created_at DESC
  ),
  reaproveitados_tipo AS (
    UPDATE public.qa_processo_documentos pd
       SET arquivo_storage_key = c.arquivo_storage_path,
           arquivo_url = c.arquivo_storage_path,
           status = 'dispensado_por_reaproveitamento',
           data_envio = COALESCE(c.created_at, now()),
           data_validacao = now(),
           data_emissao = COALESCE(pd.data_emissao, c.data_emissao),
           data_validade = COALESCE(pd.data_validade, c.data_validade),
           motivo_rejeicao = NULL,
           dados_extraidos_json = c.ia_dados_extraidos,
           metadados_documento_json = COALESCE(pd.metadados_documento_json, '{}'::jsonb) || jsonb_build_object(
             'reutilizado_do_hub', true,
             'reaproveitado_da_central', true,
             'hub_documento_id', c.hub_documento_id,
             'hub_tipo_documento', c.hub_tipo_documento,
             'arquivo_nome_origem', c.arquivo_nome,
             'motivo_match', 'tipo_ou_alias',
             'origem_reaproveitamento', p_origem,
             'reutilizado_em', now()
           ),
           observacoes = COALESCE(pd.observacoes, '') ||
             CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
             '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') || '] Reaproveitado automaticamente da Central de Documentos (doc #' || c.hub_documento_id::text || ')',
           updated_at = now()
      FROM candidatos c
     WHERE pd.id = c.processo_documento_id
     RETURNING pd.id AS processo_documento_id,
               pd.tipo_documento,
               c.hub_documento_id,
               c.hub_tipo_documento,
               c.arquivo_nome,
               c.data_emissao,
               c.data_validade,
               'tipo_ou_alias'::text AS motivo_match
  )
  SELECT COUNT(*),
         COALESCE(jsonb_agg(jsonb_build_object(
           'exigencia_id', processo_documento_id,
           'tipo_documento', tipo_documento,
           'documento_id', hub_documento_id,
           'hub_tipo_documento', hub_tipo_documento,
           'arquivo_nome', arquivo_nome,
           'data_emissao', data_emissao,
           'data_validade', data_validade,
           'motivo_match', motivo_match
         )), '[]'::jsonb)
    INTO v_reaproveitados, v_reuso_detalhes
    FROM reaproveitados_tipo;

  /* PASSO 2 — comprovante_endereco_ano_YYYY por ano de emissão */
  WITH slots_ano AS (
    SELECT pd.id AS processo_documento_id,
           pd.tipo_documento,
           substring(pd.tipo_documento FROM 'comprovante_endereco_ano_(\d{4})')::int AS ano_alvo
      FROM public.qa_processo_documentos pd
     WHERE pd.processo_id = p_processo_id
       AND pd.status IN ('pendente','rejeitado','enviado','em_analise','revisao_humana')
       AND pd.arquivo_storage_key IS NULL
       AND pd.tipo_documento ~ '^comprovante_endereco_ano_\d{4}$'
  ),
  hub_residencia AS (
    SELECT dc.id,
           dc.tipo_documento,
           dc.arquivo_storage_path,
           dc.arquivo_nome,
           dc.ia_dados_extraidos,
           dc.data_emissao,
           dc.data_validade,
           dc.created_at,
           EXTRACT(YEAR FROM dc.data_emissao)::int AS ano_emissao
      FROM public.qa_documentos_cliente dc
     WHERE dc.qa_cliente_id = v_proc.cliente_id
       AND dc.tipo_documento = 'comprovante_residencia'
       AND (dc.validado_admin = true OR dc.status = 'aprovado')
       AND dc.arquivo_storage_path IS NOT NULL
       AND dc.data_emissao IS NOT NULL
       AND NOT public.qa_comprovante_terceiro_pendente(dc.id)
  ),
  candidatos_ano AS (
    SELECT DISTINCT ON (s.processo_documento_id)
           s.processo_documento_id,
           s.tipo_documento,
           s.ano_alvo,
           h.id AS hub_documento_id,
           h.tipo_documento AS hub_tipo_documento,
           h.arquivo_storage_path,
           h.arquivo_nome,
           h.ia_dados_extraidos,
           h.data_emissao,
           h.data_validade,
           h.created_at
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
           status = 'dispensado_por_reaproveitamento',
           data_envio = COALESCE(c.created_at, now()),
           data_validacao = now(),
           data_emissao = COALESCE(pd.data_emissao, c.data_emissao),
           data_validade = COALESCE(pd.data_validade, c.data_validade),
           motivo_rejeicao = NULL,
           dados_extraidos_json = c.ia_dados_extraidos,
           metadados_documento_json = COALESCE(pd.metadados_documento_json, '{}'::jsonb) || jsonb_build_object(
             'reutilizado_do_hub', true,
             'reaproveitado_da_central', true,
             'hub_documento_id', c.hub_documento_id,
             'hub_tipo_documento', c.hub_tipo_documento,
             'arquivo_nome_origem', c.arquivo_nome,
             'motivo_match', 'ano_emissao=' || c.ano_alvo::text,
             'ano_exigido', c.ano_alvo,
             'origem_reaproveitamento', p_origem,
             'reutilizado_em', now()
           ),
           observacoes = COALESCE(pd.observacoes, '') ||
             CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
             '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') || '] Reaproveitado da Central de Documentos por ano de emissão ' || c.ano_alvo::text || ' (doc #' || c.hub_documento_id::text || ')',
           updated_at = now()
      FROM candidatos_ano c
     WHERE pd.id = c.processo_documento_id
     RETURNING pd.id AS processo_documento_id,
               pd.tipo_documento,
               c.hub_documento_id,
               c.hub_tipo_documento,
               c.arquivo_nome,
               c.data_emissao,
               c.data_validade,
               ('ano_emissao=' || c.ano_alvo::text)::text AS motivo_match
  )
  SELECT v_reaproveitados + COALESCE(COUNT(*), 0),
         v_reuso_detalhes || COALESCE(jsonb_agg(jsonb_build_object(
           'exigencia_id', processo_documento_id,
           'tipo_documento', tipo_documento,
           'documento_id', hub_documento_id,
           'hub_tipo_documento', hub_tipo_documento,
           'arquivo_nome', arquivo_nome,
           'data_emissao', data_emissao,
           'data_validade', data_validade,
           'motivo_match', motivo_match
         )), '[]'::jsonb)
    INTO v_reaproveitados, v_reuso_detalhes
    FROM reaproveitados_ano;

  IF jsonb_array_length(v_reuso_detalhes) > 0 THEN
    FOR r IN SELECT * FROM jsonb_array_elements(v_reuso_detalhes) AS x(item) LOOP
      IF NOT EXISTS (
        SELECT 1
          FROM public.qa_processo_eventos ev
         WHERE ev.processo_id = p_processo_id
           AND ev.documento_id = (r.item->>'exigencia_id')::uuid
           AND ev.tipo_evento = 'documento_reaproveitado_hub'
           AND ev.dados_json->>'documento_id' = r.item->>'documento_id'
      ) THEN
        INSERT INTO public.qa_processo_eventos (processo_id, documento_id, tipo_evento, descricao, dados_json, ator)
        VALUES (
          p_processo_id,
          (r.item->>'exigencia_id')::uuid,
          'documento_reaproveitado_hub',
          format('Exigência %s atendida por documento #%s da Central de Documentos.', (r.item->>'tipo_documento'), (r.item->>'documento_id')),
          (r.item || jsonb_build_object('origem_reprocessamento', p_origem)),
          'sistema'
        );
      END IF;
    END LOOP;
  END IF;

  SELECT COUNT(*) INTO v_total
    FROM public.qa_processo_documentos
   WHERE processo_id = p_processo_id;

  SELECT COUNT(*) INTO v_pendentes
    FROM public.qa_processo_documentos
   WHERE processo_id = p_processo_id
     AND status IN ('pendente','rejeitado','enviado','em_analise','revisao_humana')
     AND arquivo_storage_key IS NULL;

  INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
  VALUES (
    p_processo_id,
    'reaproveitamento_hub_resumo',
    format('Reaproveitamento da Central: %s exigência(s) atendida(s) automaticamente.', v_reaproveitados),
    jsonb_build_object(
      'total_reaproveitadas', v_reaproveitados,
      'total_pendentes', v_pendentes,
      'total_exigencias', v_total,
      'origem', p_origem,
      'detalhes', v_reuso_detalhes
    ),
    'sistema'
  );

  reaproveitados := v_reaproveitados;
  pendentes := v_pendentes;
  total_exigencias := v_total;
  RETURN NEXT;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.qa_reaproveitar_documentos_hub_processo(uuid, text) TO authenticated, service_role;

-- ─── 5) Reaproveitamento em todos os processos ativos ────────────────────────
SELECT public.qa_reaproveitar_documentos_hub_processo(p.id, 'fix_aliases_trf3_militar_20260807')
  FROM public.qa_processos p
 WHERE COALESCE(p.status, 'ativo') NOT IN ('finalizado','deferido','indeferido','cancelado','arquivado');

COMMIT;
