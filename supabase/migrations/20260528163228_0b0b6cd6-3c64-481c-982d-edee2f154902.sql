-- ============================================================
-- Sincronização de checklist de processos com catálogo de exigências.
-- Camada aditiva: não altera qa_explodir_checklist_processo nem schema.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Diagnóstico: quantos processos ativos do serviço estão
--    divergentes do catálogo atual?
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_servico_divergencia_catalogo(p_servico_id integer)
RETURNS TABLE(
  processos_ativos integer,
  processos_divergentes integer,
  exigencias_faltando integer,
  exigencias_removidas_pendentes integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total int := 0;
  v_div   int := 0;
  v_falt  int := 0;
  v_rem   int := 0;
BEGIN
  WITH procs AS (
    SELECT p.id, p.condicao_profissional
      FROM public.qa_processos p
     WHERE p.servico_id = p_servico_id
       AND p.status NOT IN ('concluido','cancelado')
  ),
  cat AS (
    SELECT sd.tipo_documento, sd.condicao_profissional
      FROM public.qa_servicos_documentos sd
     WHERE sd.servico_id = p_servico_id
       AND sd.ativo = true
  ),
  -- Para cada processo, exigências do catálogo aplicáveis à sua condição
  cat_por_proc AS (
    SELECT p.id AS processo_id, c.tipo_documento
      FROM procs p
      JOIN cat c
        ON (c.condicao_profissional IS NULL
            OR c.condicao_profissional = COALESCE(p.condicao_profissional,'indefinido'))
  ),
  doc_por_proc AS (
    SELECT pd.processo_id, pd.tipo_documento, pd.status, pd.arquivo_storage_key
      FROM public.qa_processo_documentos pd
      JOIN procs p ON p.id = pd.processo_id
  ),
  faltando AS (
    SELECT cp.processo_id, cp.tipo_documento
      FROM cat_por_proc cp
     WHERE NOT EXISTS (
       SELECT 1 FROM doc_por_proc dp
        WHERE dp.processo_id = cp.processo_id
          AND dp.tipo_documento = cp.tipo_documento
     )
  ),
  removidos_pendentes AS (
    SELECT dp.processo_id, dp.tipo_documento
      FROM doc_por_proc dp
     WHERE NOT EXISTS (
       SELECT 1 FROM cat_por_proc cp
        WHERE cp.processo_id = dp.processo_id
          AND cp.tipo_documento = dp.tipo_documento
     )
       AND dp.status NOT IN ('aprovado','validado','dispensado','dispensado_grupo','dispensado_por_reaproveitamento','nao_aplicavel','concluido','concluído')
       AND dp.arquivo_storage_key IS NULL
  ),
  divergentes AS (
    SELECT DISTINCT processo_id FROM faltando
    UNION
    SELECT DISTINCT processo_id FROM removidos_pendentes
  )
  SELECT
    (SELECT COUNT(*) FROM procs),
    (SELECT COUNT(*) FROM divergentes),
    (SELECT COUNT(*) FROM faltando),
    (SELECT COUNT(*) FROM removidos_pendentes)
  INTO v_total, v_div, v_falt, v_rem;

  processos_ativos := v_total;
  processos_divergentes := v_div;
  exigencias_faltando := v_falt;
  exigencias_removidas_pendentes := v_rem;
  RETURN NEXT;
END $$;

REVOKE ALL ON FUNCTION public.qa_servico_divergencia_catalogo(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_servico_divergencia_catalogo(integer) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 2) Sincronização: aplica o catálogo atual a todos os
--    processos ativos do serviço.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_sincronizar_checklist_processos_servico(p_servico_id integer)
RETURNS TABLE(
  processos_processados integer,
  exigencias_adicionadas integer,
  exigencias_atualizadas integer,
  exigencias_arquivadas integer,
  documentos_preservados integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

    -- (a) INSERIR exigências novas (que não existem no processo)
    WITH desejados AS (
      SELECT sd.tipo_documento, sd.nome_documento, sd.etapa, sd.validade_dias,
             sd.formato_aceito, sd.regra_validacao, sd.link_emissao,
             sd.instrucoes, sd.observacoes_cliente, sd.modelo_url, sd.exemplo_url,
             sd.orgao_emissor, sd.prazo_recomendado_dias, sd.obrigatorio
        FROM public.qa_servicos_documentos sd
       WHERE sd.servico_id = p_servico_id
         AND sd.ativo = true
         AND (sd.condicao_profissional IS NULL OR sd.condicao_profissional = v_proc.condicao)
    ),
    inserted AS (
      INSERT INTO public.qa_processo_documentos (
        processo_id, cliente_id, tipo_documento, nome_documento, etapa,
        status, obrigatorio, validade_dias, formato_aceito, regra_validacao, link_emissao,
        instrucoes, observacoes_cliente, modelo_url, exemplo_url, orgao_emissor, prazo_recomendado_dias
      )
      SELECT v_proc.id, v_proc.cliente_id, d.tipo_documento, d.nome_documento, d.etapa,
             'pendente', COALESCE(d.obrigatorio, true), d.validade_dias, d.formato_aceito,
             d.regra_validacao, d.link_emissao,
             d.instrucoes, d.observacoes_cliente, d.modelo_url, d.exemplo_url,
             d.orgao_emissor, d.prazo_recomendado_dias
        FROM desejados d
       WHERE NOT EXISTS (
         SELECT 1 FROM public.qa_processo_documentos pd
          WHERE pd.processo_id = v_proc.id
            AND pd.tipo_documento = d.tipo_documento
       )
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_ins_proc FROM inserted;

    -- (b) ATUALIZAR metadados das exigências que continuam no catálogo
    WITH desejados AS (
      SELECT sd.tipo_documento, sd.nome_documento, sd.etapa, sd.validade_dias,
             sd.formato_aceito, sd.regra_validacao, sd.link_emissao,
             sd.instrucoes, sd.observacoes_cliente, sd.modelo_url, sd.exemplo_url,
             sd.orgao_emissor, sd.prazo_recomendado_dias, sd.obrigatorio
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
             obrigatorio     = COALESCE(d.obrigatorio, pd.obrigatorio),
             updated_at      = now()
        FROM desejados d
       WHERE pd.processo_id = v_proc.id
         AND pd.tipo_documento = d.tipo_documento
         -- só recalibra metadados; não toca em arquivo/status
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_upd_proc FROM upd;

    -- (c) ARQUIVAR (nao_aplicavel) exigências removidas do catálogo
    --     SOMENTE quando o cliente ainda não enviou nada e não foram aprovadas.
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

    -- (d) Contar documentos PRESERVADOS (removidos do catálogo mas com arquivo
    --     enviado/aprovado) — não apagamos, apenas reportamos.
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

    -- evento por processo
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
END $$;

REVOKE ALL ON FUNCTION public.qa_sincronizar_checklist_processos_servico(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qa_sincronizar_checklist_processos_servico(integer) TO service_role;