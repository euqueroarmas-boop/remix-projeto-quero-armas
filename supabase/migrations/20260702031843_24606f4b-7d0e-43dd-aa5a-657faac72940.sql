
-- 1) Amplia a check constraint para aceitar 'dispensado_por_reaproveitamento'
ALTER TABLE public.qa_processo_documentos
  DROP CONSTRAINT IF EXISTS chk_qa_processo_documentos_status;

ALTER TABLE public.qa_processo_documentos
  ADD CONSTRAINT chk_qa_processo_documentos_status
  CHECK (status = ANY (ARRAY[
    'pendente','enviado','em_analise','aprovado','rejeitado','expirado',
    'invalido','divergente','dispensado_grupo','descartado_por_troca_servico',
    'pendente_reenvio','pre_validado','revisao_humana','nao_aplicavel',
    'dispensado_por_reaproveitamento'
  ]));

-- 2) Reescreve qa_processo_rever_exigencias
CREATE OR REPLACE FUNCTION public.qa_processo_rever_exigencias(p_cliente_id integer DEFAULT NULL::integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_updated integer := 0;
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (pd2.id)
      pd2.id             AS slot_id,
      pd2.processo_id    AS processo_id,
      pd2.tipo_documento AS slot_tipo,
      pd2.cliente_id     AS cliente_id,
      dc.id              AS hub_doc_id,
      dc.tipo_documento  AS hub_tipo,
      dc.arquivo_storage_path,
      dc.created_at      AS hub_created_at,
      dc.data_validade   AS hub_validade,
      dc.data_emissao    AS hub_emissao,
      dc.ia_dados_extraidos,
      pr.servico_id      AS servico_id
    FROM public.qa_processo_documentos pd2
    JOIN public.qa_processos pr ON pr.id = pd2.processo_id
    JOIN public.qa_documentos_cliente dc
      ON dc.status = 'aprovado'
     AND (dc.data_validade IS NULL OR dc.data_validade >= CURRENT_DATE)
     AND (
           dc.qa_cliente_id = pd2.cliente_id
        OR EXISTS (
             SELECT 1 FROM public.qa_clientes qc
             WHERE qc.id = pd2.cliente_id AND qc.customer_id = dc.customer_id
           )
     )
     AND (
           dc.tipo_documento = pd2.tipo_documento
        OR pd2.tipo_documento IN (
             SELECT processo_tipo FROM public.qa_tipo_documento_aliases
             WHERE hub_tipo = dc.tipo_documento
           )
     )
    LEFT JOIN public.qa_tipos_documento_servicos tds
      ON tds.servico_id = pr.servico_id
     AND tds.tipo_documento = pd2.tipo_documento
    WHERE pd2.status IN ('pendente','enviado','em_analise','revisao_humana')
      AND (p_cliente_id IS NULL OR pd2.cliente_id = p_cliente_id)
      AND (
        tds.validade_dias IS NULL
        OR tds.validade_dias <= 0
        OR (COALESCE(dc.data_emissao, dc.created_at::date) + tds.validade_dias) >= CURRENT_DATE
      )
    ORDER BY pd2.id, dc.data_validade DESC NULLS LAST, dc.created_at DESC
  LOOP
    UPDATE public.qa_processo_documentos pd
    SET status = 'dispensado_por_reaproveitamento',
        arquivo_url = r.arquivo_storage_path,
        arquivo_storage_key = r.arquivo_storage_path,
        data_envio = COALESCE(r.hub_created_at, now()),
        data_validacao = now(),
        data_emissao = COALESCE(pd.data_emissao, r.hub_emissao),
        data_validade = COALESCE(pd.data_validade, r.hub_validade),
        dados_extraidos_json = r.ia_dados_extraidos,
        nome_documento = COALESCE(pd.nome_documento, 'REUTILIZADO DO HUB DE DOCUMENTOS'),
        metadados_documento_json = COALESCE(pd.metadados_documento_json, '{}'::jsonb) || jsonb_build_object(
          'reutilizado_do_hub', true,
          'hub_documento_id', r.hub_doc_id,
          'hub_tipo_documento', r.hub_tipo,
          'reutilizado_em', now()
        )
    WHERE pd.id = r.slot_id;

    INSERT INTO public.qa_processo_eventos (processo_id, documento_id, tipo_evento, descricao, dados_json, ator)
    VALUES (
      r.processo_id, r.slot_id,
      'documento_reutilizado_hub',
      'Item cumprido por reaproveitamento do Hub de Documentos',
      jsonb_build_object(
        'hub_documento_id', r.hub_doc_id,
        'hub_tipo_documento', r.hub_tipo,
        'slot_tipo_documento', r.slot_tipo,
        'servico_id', r.servico_id
      ),
      'sistema'
    );

    v_updated := v_updated + 1;
  END LOOP;

  RETURN v_updated;
END;
$function$;

-- 3) Reset dos 2 slots marcados incorretamente como 'aprovado' pelo backfill antigo
UPDATE public.qa_processo_documentos
SET status = 'pendente',
    arquivo_url = NULL,
    arquivo_storage_key = NULL,
    data_envio = NULL,
    data_validacao = NULL,
    dados_extraidos_json = NULL
WHERE processo_id = '79d5ba9a-cba5-479e-b94f-adf82977f0df'
  AND status = 'aprovado'
  AND (metadados_documento_json IS NULL OR NOT (metadados_documento_json ? 'reutilizado_do_hub'));

-- 4) Backfill retroativo para o processo 79D5BA9A (cliente 189)
SELECT public.qa_processo_rever_exigencias(189);
