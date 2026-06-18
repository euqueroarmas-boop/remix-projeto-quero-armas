-- Quando um documento do hub (qa_documentos_cliente) é aprovado,
-- verifica se algum slot de processo (qa_processo_documentos) do mesmo
-- cliente e tipo ainda está pendente. Se sim, marca o slot como cumprido,
-- vinculando o arquivo e os dados extraídos pela IA.
--
-- Também expõe a função qa_processo_rever_exigencias(cliente_id) para
-- backfill retroativo: chamada com o id do cliente, ela percorre todos
-- os slots pendentes daquele cliente e tenta cumpri-los com documentos
-- já aprovados no hub.

-- ─── 1. Trigger: dispara a cada aprovação de documento no hub ────────────────

CREATE OR REPLACE FUNCTION public.qa_doc_hub_satisfaz_exigencias_processo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id integer;
BEGIN
  -- Só actua quando o documento passa para aprovado
  IF NEW.status <> 'aprovado' THEN
    RETURN NEW;
  END IF;
  -- Evita re-processar se já estava aprovado
  IF TG_OP = 'UPDATE' AND OLD.status = 'aprovado' THEN
    RETURN NEW;
  END IF;
  -- Documento expirado não cumpre exigência
  IF NEW.data_validade IS NOT NULL AND NEW.data_validade < CURRENT_DATE THEN
    RETURN NEW;
  END IF;

  -- Resolve qa_cliente_id (pode vir direto ou precisar de lookup pelo customer_id)
  v_cliente_id := NEW.qa_cliente_id;
  IF v_cliente_id IS NULL AND NEW.customer_id IS NOT NULL THEN
    SELECT id INTO v_cliente_id
    FROM public.qa_clientes
    WHERE customer_id = NEW.customer_id
    LIMIT 1;
  END IF;

  IF v_cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Cumpre todos os slots pendentes do mesmo tipo para este cliente
  UPDATE public.qa_processo_documentos
  SET
    status              = 'aprovado',
    arquivo_url         = NEW.arquivo_storage_path,
    arquivo_storage_key = NEW.arquivo_storage_path,
    data_envio          = COALESCE(NEW.created_at, now()),
    data_validacao      = now(),
    dados_extraidos_json = NEW.ia_dados_extraidos
  WHERE
    cliente_id     = v_cliente_id
    AND tipo_documento = NEW.tipo_documento
    AND status     IN ('pendente', 'enviado', 'em_analise', 'revisao_humana');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qa_doc_hub_satisfaz_exigencias_trigger ON public.qa_documentos_cliente;

CREATE TRIGGER qa_doc_hub_satisfaz_exigencias_trigger
  AFTER INSERT OR UPDATE ON public.qa_documentos_cliente
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_doc_hub_satisfaz_exigencias_processo();


-- ─── 2. Função de backfill retroativo ────────────────────────────────────────
-- Uso: SELECT qa_processo_rever_exigencias(123);  -- 123 = qa_cliente_id
-- Ou para todos os clientes: SELECT qa_processo_rever_exigencias(NULL);

CREATE OR REPLACE FUNCTION public.qa_processo_rever_exigencias(p_cliente_id integer DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  UPDATE public.qa_processo_documentos pd
  SET
    status              = 'aprovado',
    arquivo_url         = doc.arquivo_storage_path,
    arquivo_storage_key = doc.arquivo_storage_path,
    data_envio          = COALESCE(doc.created_at, now()),
    data_validacao      = now(),
    dados_extraidos_json = doc.ia_dados_extraidos
  FROM (
    -- Para cada slot pendente, pega o documento mais recente aprovado e válido do hub
    SELECT DISTINCT ON (pd2.id)
      pd2.id          AS slot_id,
      dc.arquivo_storage_path,
      dc.created_at,
      dc.ia_dados_extraidos
    FROM public.qa_processo_documentos pd2
    JOIN public.qa_documentos_cliente dc
      ON  dc.tipo_documento = pd2.tipo_documento
      AND dc.status         = 'aprovado'
      AND (dc.data_validade IS NULL OR dc.data_validade >= CURRENT_DATE)
      AND (
        dc.qa_cliente_id = pd2.cliente_id
        OR EXISTS (
          SELECT 1 FROM public.qa_clientes qc
          WHERE qc.id = pd2.cliente_id
            AND qc.customer_id = dc.customer_id
        )
      )
    WHERE pd2.status IN ('pendente', 'enviado', 'em_analise', 'revisao_humana')
      AND (p_cliente_id IS NULL OR pd2.cliente_id = p_cliente_id)
    ORDER BY pd2.id, dc.created_at DESC
  ) doc
  WHERE pd.id = doc.slot_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;
