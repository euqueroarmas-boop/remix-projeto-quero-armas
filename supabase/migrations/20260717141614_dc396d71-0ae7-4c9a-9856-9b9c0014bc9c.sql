CREATE OR REPLACE FUNCTION public.qa_doc_hub_satisfaz_exigencias_processo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id integer;
  v_ano_doc    integer;
  v_ano_atual  integer;
BEGIN
  IF NEW.status <> 'aprovado' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'aprovado' THEN
    RETURN NEW;
  END IF;

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

  v_ano_atual := EXTRACT(YEAR FROM CURRENT_DATE)::integer;

  IF NEW.tipo_documento = 'comprovante_residencia' THEN

    IF NEW.data_emissao IS NOT NULL THEN
      v_ano_doc := EXTRACT(YEAR FROM NEW.data_emissao)::integer;

      IF v_ano_doc >= v_ano_atual THEN
        IF NEW.data_validade IS NOT NULL AND NEW.data_validade < CURRENT_DATE THEN
          RETURN NEW;
        END IF;
      END IF;

      UPDATE public.qa_processo_documentos
      SET
        status              = 'aprovado',
        arquivo_url         = NEW.arquivo_storage_path,
        arquivo_storage_key = NEW.arquivo_storage_path,
        data_envio          = COALESCE(NEW.created_at, now()),
        data_validacao      = now(),
        dados_extraidos_json = NEW.ia_dados_extraidos
      WHERE
        cliente_id = v_cliente_id
        AND status IN ('pendente', 'enviado', 'em_analise', 'revisao_humana')
        AND tipo_documento = 'comprovante_endereco_ano_' || v_ano_doc::text;

    END IF;

    IF NEW.data_validade IS NULL OR NEW.data_validade >= CURRENT_DATE THEN
      UPDATE public.qa_processo_documentos
      SET
        status              = 'aprovado',
        arquivo_url         = NEW.arquivo_storage_path,
        arquivo_storage_key = NEW.arquivo_storage_path,
        data_envio          = COALESCE(NEW.created_at, now()),
        data_validacao      = now(),
        dados_extraidos_json = NEW.ia_dados_extraidos
      WHERE
        cliente_id = v_cliente_id
        AND status IN ('pendente', 'enviado', 'em_analise', 'revisao_humana')
        AND tipo_documento = 'comprovante_residencia';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.data_validade IS NOT NULL AND NEW.data_validade < CURRENT_DATE THEN
    RETURN NEW;
  END IF;

  UPDATE public.qa_processo_documentos
  SET
    status              = 'aprovado',
    arquivo_url         = NEW.arquivo_storage_path,
    arquivo_storage_key = NEW.arquivo_storage_path,
    data_envio          = COALESCE(NEW.created_at, now()),
    data_validacao      = now(),
    dados_extraidos_json = NEW.ia_dados_extraidos
  WHERE
    cliente_id = v_cliente_id
    AND status IN ('pendente', 'enviado', 'em_analise', 'revisao_humana')
    AND (
      tipo_documento = NEW.tipo_documento
      OR tipo_documento IN (
        SELECT processo_tipo
        FROM public.qa_tipo_documento_aliases
        WHERE hub_tipo = NEW.tipo_documento
          AND processo_tipo NOT LIKE 'comprovante_endereco_ano_%'
      )
    );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.qa_doc_hub_satisfaz_exigencias_processo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_doc_hub_satisfaz_exigencias_processo() TO authenticated, service_role;