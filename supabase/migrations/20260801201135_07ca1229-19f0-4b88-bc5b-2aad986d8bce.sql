-- 1) Regras: documentos constitutivos não têm prazo
UPDATE public.qa_validade_documentos
   SET validade_dias = NULL
 WHERE tipo_documento IN ('renda_ccmei','ccmei','renda_contrato_social','contrato_social','renda_requerimento_empresario','requerimento_empresario');

-- 2) Limpa validades já gravadas
UPDATE public.qa_processo_documentos
   SET data_validade = NULL, data_validade_efetiva = NULL, validade_dias = NULL
 WHERE tipo_documento IN ('renda_ccmei','ccmei','renda_contrato_social','contrato_social','renda_requerimento_empresario','requerimento_empresario');

UPDATE public.qa_documentos_cliente
   SET data_validade = NULL
 WHERE tipo_documento IN ('renda_ccmei','ccmei','renda_contrato_social','contrato_social','renda_requerimento_empresario','requerimento_empresario');

-- 3) Recalculo de prazos ignora documentos constitutivos
CREATE OR REPLACE FUNCTION public.qa_recalcular_prazos_processo(p_processo_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec_doc              record;
  v_validade_efet      date;
  v_validade_dias_efet integer;
  v_min_data           date;
  v_min_doc_id         uuid;
  v_min_doc_nome       text;
  v_primeiro_end       timestamptz;
  v_etapa_atual        smallint;
  v_etapa_nova         smallint;
  v_pendentes_etapa    integer;
  v_respostas          jsonb;
BEGIN
  SELECT coalesce(respostas_questionario_json, '{}'::jsonb)
    INTO v_respostas
    FROM public.qa_processos
   WHERE id = p_processo_id;

  FOR rec_doc IN
    SELECT id, tipo_documento, data_emissao, proxima_leitura,
           validade_dias, status
      FROM public.qa_processo_documentos
     WHERE processo_id = p_processo_id
  LOOP
    IF rec_doc.tipo_documento IN (
         'renda_ccmei','ccmei','renda_contrato_social','contrato_social',
         'renda_requerimento_empresario','requerimento_empresario'
       ) THEN
      UPDATE public.qa_processo_documentos
         SET data_validade_efetiva = NULL, data_validade = NULL
       WHERE id = rec_doc.id;
      CONTINUE;
    END IF;

    v_validade_dias_efet := rec_doc.validade_dias;
    IF v_validade_dias_efet IS NULL THEN
      SELECT validade_dias INTO v_validade_dias_efet
        FROM public.qa_validade_documentos
       WHERE tipo_documento = rec_doc.tipo_documento;
    END IF;

    v_validade_efet := NULL;
    IF rec_doc.data_emissao IS NOT NULL AND v_validade_dias_efet IS NOT NULL AND v_validade_dias_efet > 0 THEN
      v_validade_efet := rec_doc.data_emissao + (v_validade_dias_efet || ' days')::interval;
    END IF;
    IF rec_doc.proxima_leitura IS NOT NULL THEN
      v_validade_efet := LEAST(coalesce(v_validade_efet, rec_doc.proxima_leitura), rec_doc.proxima_leitura);
    END IF;

    UPDATE public.qa_processo_documentos
       SET data_validade_efetiva = v_validade_efet
     WHERE id = rec_doc.id;
  END LOOP;

  WITH docs_ativos AS (
    SELECT d.*
      FROM public.qa_processo_documentos d
     WHERE d.processo_id = p_processo_id
       AND d.data_validade_efetiva IS NOT NULL
       AND d.status IN (
             'enviado','em_analise','aprovado','validado',
             'divergente','revisao_humana','em_revisao_humana','pendente_aprovacao'
           )
       AND d.tipo_documento NOT IN (
             'certidao_nascimento','certidao_casamento','certidao_alteracao_nome'
           )
  ),
  serie_endereco_max AS (
    SELECT MAX(NULLIF(regexp_replace(tipo_documento, '^comprovante_endereco_ano_', ''), '')::int) AS ano_max
      FROM public.qa_processo_documentos
     WHERE processo_id = p_processo_id
       AND tipo_documento ~ '^comprovante_endereco_ano_\d{4}$'
       AND status IN ('aprovado','validado')
  )
  SELECT d.data_validade_efetiva, d.id, d.nome_documento
    INTO v_min_data, v_min_doc_id, v_min_doc_nome
    FROM docs_ativos d
   WHERE NOT (
           d.tipo_documento ~ '^comprovante_endereco_ano_\d{4}$'
           AND (SELECT ano_max FROM serie_endereco_max) IS NOT NULL
           AND regexp_replace(d.tipo_documento, '^comprovante_endereco_ano_', '')::int
               < (SELECT ano_max FROM serie_endereco_max)
         )
   ORDER BY d.data_validade_efetiva ASC
   LIMIT 1;

  SELECT MIN(data_validacao) INTO v_primeiro_end
    FROM public.qa_processo_documentos
   WHERE processo_id = p_processo_id
     AND status = 'aprovado'
     AND public.qa_categoria_documento(tipo_documento) = 'endereco';

  SELECT etapa_liberada_ate INTO v_etapa_atual
    FROM public.qa_processos
   WHERE id = p_processo_id;
  v_etapa_atual := coalesce(v_etapa_atual, 1);
  v_etapa_nova  := v_etapa_atual;

  SELECT count(*) INTO v_pendentes_etapa
    FROM public.qa_processo_documentos
   WHERE processo_id = p_processo_id
     AND status IN ('pendente','divergente','rejeitado');

  IF v_pendentes_etapa = 0 AND v_etapa_atual < 5 THEN
    v_etapa_nova := v_etapa_atual + 1;
  END IF;

  UPDATE public.qa_processos
     SET prazo_critico_data = v_min_data,
         prazo_critico_doc_id = v_min_doc_id,
         prazo_critico_doc_nome = v_min_doc_nome,
         primeiro_endereco_validado_em = coalesce(primeiro_endereco_validado_em, v_primeiro_end),
         etapa_liberada_ate = v_etapa_nova,
         updated_at = now()
   WHERE id = p_processo_id;
END;
$function$;