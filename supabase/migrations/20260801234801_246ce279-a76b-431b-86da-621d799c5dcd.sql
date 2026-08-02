-- 1) Regra canônica: comprovante de endereço de terceiro pendente de declaração assinada
CREATE OR REPLACE FUNCTION public.qa_comprovante_terceiro_pendente(p_documento_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.qa_documentos_cliente dc
     WHERE dc.id = p_documento_id
       AND (
         COALESCE(dc.ia_dados_extraidos->>'aguardando_declaracao_responsavel', 'false') = 'true'
         OR COALESCE(dc.endereco_em_nome_de_terceiro, false) = true
       )
       AND NOT EXISTS (
         SELECT 1
           FROM public.qa_declaracoes_residencia d
          WHERE d.documento_comprovante_id = dc.id
            AND d.status = 'assinada_validada'
       )
  );
$$;

GRANT EXECUTE ON FUNCTION public.qa_comprovante_terceiro_pendente(uuid) TO authenticated, service_role;

-- 2) Reaproveitamento da Central passa a ignorar comprovantes de terceiro sem declaração validada
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
           upper(unaccent(coalesce(dc.arquivo_nome, '') || ' ' || coalesce(dc.ia_dados_extraidos::text, ''))) AS origem_txt
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
       AND (
         cv.tipo_documento <> 'antecedentes_militar'
         OR pd.tipo_documento NOT IN ('certidao_criminal_tjmsp', 'certidao_crimes_militares_stm')
         OR (pd.tipo_documento = 'certidao_criminal_tjmsp' AND (cv.origem_txt LIKE '%TJM%' OR cv.origem_txt LIKE '%JUSTICA MILITAR/SP%' OR cv.origem_txt LIKE '%JUSTICA MILITAR DO ESTADO DE SAO PAULO%'))
         OR (pd.tipo_documento = 'certidao_crimes_militares_stm' AND (cv.origem_txt LIKE '%STM%' OR cv.origem_txt LIKE '%JUSTICA MILITAR DA UNIAO%' OR cv.origem_txt LIKE '%SUPERIOR TRIBUNAL MILITAR%'))
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

-- 3) Correção do caso atual: comprovante de terceiro volta a aguardar a declaração
UPDATE public.qa_documentos_cliente
   SET status = 'pendente_aprovacao',
       validado_admin = false,
       aprovado_em = NULL,
       endereco_em_nome_de_terceiro = true,
       ia_dados_extraidos = COALESCE(ia_dados_extraidos, '{}'::jsonb)
         || jsonb_build_object('aguardando_declaracao_responsavel', true, 'recomendacao', 'revisar'),
       motivo_reprovacao = 'Aguardando a declaração do responsável pelo imóvel assinada no GOV.BR.'
 WHERE id = 'f12a6a14-b28e-4adf-ba11-1b3ae05b886f';

UPDATE public.qa_processo_documentos
   SET status = 'pendente',
       arquivo_storage_key = NULL,
       arquivo_url = NULL,
       data_validacao = NULL,
       metadados_documento_json = (COALESCE(metadados_documento_json, '{}'::jsonb) - 'reutilizado_do_hub' - 'reaproveitado_da_central' - 'hub_documento_id' - 'hub_tipo_documento' - 'arquivo_nome_origem' - 'motivo_match' - 'origem_reaproveitamento' - 'reutilizado_em'),
       updated_at = now()
 WHERE id = 'f68f7472-e219-4c09-b055-c093ae3ac0e5';