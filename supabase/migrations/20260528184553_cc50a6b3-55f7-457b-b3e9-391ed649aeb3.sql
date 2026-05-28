-- Permite que etapa_liberada_ate chegue à etapa 5 (Exames Técnicos)
ALTER TABLE public.qa_processos
  DROP CONSTRAINT IF EXISTS qa_processos_etapa_liberada_chk;
ALTER TABLE public.qa_processos
  ADD CONSTRAINT qa_processos_etapa_liberada_chk
  CHECK (etapa_liberada_ate >= 1 AND etapa_liberada_ate <= 5);

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

  WHILE v_etapa_nova < 5 LOOP
    SELECT COUNT(*) INTO v_pendentes_etapa
      FROM public.qa_processo_documentos d
     WHERE d.processo_id = p_processo_id
       AND d.obrigatorio = true
       AND public.qa_etapa_documento(d.tipo_documento) = v_etapa_nova
       AND d.status NOT IN (
             'aprovado','validado','concluido','concluído',
             'dispensado','dispensado_grupo','dispensado_por_reaproveitamento',
             'nao_aplicavel','hub_reaproveitado'
           )
       AND NOT (
         (
           lower(coalesce(d.tipo_documento,'')) LIKE 'pergunta\_%' ESCAPE '\'
           OR (d.regra_validacao ->> 'tipo') = 'pergunta'
         )
         AND (d.regra_validacao ->> 'chave') IS NOT NULL
         AND v_respostas ? (d.regra_validacao ->> 'chave')
       );
    EXIT WHEN v_pendentes_etapa > 0;
    v_etapa_nova := v_etapa_nova + 1;
  END LOOP;

  UPDATE public.qa_processos
     SET prazo_critico_data       = v_min_data,
         prazo_critico_doc_id     = v_min_doc_id,
         primeiro_doc_aprovado_em = COALESCE(primeiro_doc_aprovado_em, v_primeiro_end),
         etapa_liberada_ate       = GREATEST(coalesce(etapa_liberada_ate,1), v_etapa_nova)
   WHERE id = p_processo_id;
END;
$function$;

-- Backfill: recalcula todos os processos com prazo crítico ou etapa <5.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.qa_processos
     WHERE prazo_critico_data IS NOT NULL
        OR coalesce(etapa_liberada_ate, 1) < 5
  LOOP
    PERFORM public.qa_recalcular_prazos_processo(r.id);
  END LOOP;
END $$;