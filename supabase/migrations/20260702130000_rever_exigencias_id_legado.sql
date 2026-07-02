-- =============================================================================
-- FIX — qa_processo_rever_exigencias: chaves id/id_legado + endurecimento
-- -----------------------------------------------------------------------------
-- A versão de 20260702031843 casava dc.qa_cliente_id (ID REAL do Hub) direto
-- com pd2.cliente_id, que nos processos criados pelo pipeline de contrato
-- validado guarda o ID_LEGADO (convenção clientFK.ts). Resultado: o
-- reaproveitamento nunca disparava para processos vindos do checkout.
-- Agora o cliente é resolvido via qa_clientes pelas DUAS chaves.
--
-- Endurecimento: cliente autenticado (não-staff) só processa o PRÓPRIO
-- cadastro — p_cliente_id é ignorado e derivado da sessão. Staff e
-- service_role podem passar qualquer cliente (por id real ou legado) ou
-- NULL para varrer todos.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.qa_processo_rever_exigencias(p_cliente_id integer DEFAULT NULL::integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_updated integer := 0;
  v_id_real integer := NULL;
  r record;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.qa_is_active_staff(auth.uid()) THEN
    -- Cliente logado: sempre o próprio cadastro, ignora o parâmetro.
    v_id_real := public.qa_current_cliente_id(auth.uid());
    IF v_id_real IS NULL THEN
      RETURN 0;
    END IF;
  ELSIF p_cliente_id IS NOT NULL THEN
    -- Staff/service_role: aceita qualquer uma das chaves.
    SELECT c.id INTO v_id_real
    FROM public.qa_clientes c
    WHERE c.id = p_cliente_id OR c.id_legado = p_cliente_id
    ORDER BY (c.id = p_cliente_id) DESC
    LIMIT 1;
    IF v_id_real IS NULL THEN
      RETURN 0;
    END IF;
  END IF;

  FOR r IN
    SELECT DISTINCT ON (pd2.id)
      pd2.id             AS slot_id,
      pd2.processo_id    AS processo_id,
      pd2.tipo_documento AS slot_tipo,
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
    -- Resolve o cliente do slot pelas duas chaves (id real OU id_legado).
    -- Colisão entre id real e id_legado de clientes distintos é impedida na
    -- prática pela faixa dos legados (9M+); DISTINCT ON limita a 1 match.
    JOIN public.qa_clientes qc
      ON qc.id = pd2.cliente_id OR qc.id_legado = pd2.cliente_id
    JOIN public.qa_documentos_cliente dc
      ON dc.status = 'aprovado'
     AND (dc.data_validade IS NULL OR dc.data_validade >= CURRENT_DATE)
     AND (
           dc.qa_cliente_id = qc.id
        OR (qc.customer_id IS NOT NULL AND dc.customer_id = qc.customer_id)
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
      AND (v_id_real IS NULL OR qc.id = v_id_real)
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

REVOKE ALL ON FUNCTION public.qa_processo_rever_exigencias(integer) FROM public;
REVOKE ALL ON FUNCTION public.qa_processo_rever_exigencias(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.qa_processo_rever_exigencias(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qa_processo_rever_exigencias(integer) TO service_role;
