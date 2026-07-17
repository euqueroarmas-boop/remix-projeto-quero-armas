-- Atualiza qa_doc_hub_satisfaz_exigencias_processo para tratar
-- comprovante_residencia com lógica de ano específico.
--
-- Problema anterior: um Hub doc tipo 'comprovante_residencia' disparava
-- o trigger com aliases e satisfazia TODOS os slots comprovante_endereco_ano_*
-- do cliente de uma vez — errado, pois o CR exige um documento distinto
-- por ano para provar residência contínua.
--
-- Solução: quando o Hub doc é 'comprovante_residencia' e tem data_emissao,
-- satisfaz APENAS o slot comprovante_endereco_ano_YYYY correspondente.
-- Docs históricos (ano anterior ao corrente) não têm checagem de validade,
-- pois são aceitos como prova de residência do período.
-- Se data_emissao estiver ausente, cai no comportamento genérico (evita
-- over-satisfaction: aliases de comprovante_endereco_ano_* são excluídos).

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
  -- Só actua quando o documento passa para aprovado
  IF NEW.status <> 'aprovado' THEN
    RETURN NEW;
  END IF;
  -- Evita re-processar se já estava aprovado
  IF TG_OP = 'UPDATE' AND OLD.status = 'aprovado' THEN
    RETURN NEW;
  END IF;

  -- Resolve qa_cliente_id
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

  -- ── Caso especial: comprovante_residencia ─────────────────────────────────
  -- Cada comprovante_endereco_ano_YYYY precisa de um documento distinto
  -- (prova de residência contínua para CR/Atirador/Caçador).
  -- Um único Hub doc NÃO pode satisfazer todos os anos de uma vez.
  IF NEW.tipo_documento = 'comprovante_residencia' THEN

    IF NEW.data_emissao IS NOT NULL THEN
      v_ano_doc := EXTRACT(YEAR FROM NEW.data_emissao)::integer;

      -- Docs do ano corrente exigem validade ok (comprovante recente)
      IF v_ano_doc >= v_ano_atual THEN
        IF NEW.data_validade IS NOT NULL AND NEW.data_validade < CURRENT_DATE THEN
          RETURN NEW; -- vencido para o ano atual → não satisfaz
        END IF;
      END IF;
      -- Docs históricos (anos anteriores): sem checagem de validade —
      -- um comprovante de 2022 é aceito como prova de residência em 2022
      -- mesmo que já tenha "vencido" como documento corrente.

      -- Satisfaz APENAS o slot do ano correspondente
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

    -- Também satisfaz slots genéricos comprovante_residencia (se existirem)
    -- e o slot do ano atual quando o doc é recente
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

  -- ── Comportamento padrão para todos os outros tipos ───────────────────────
  -- Documento expirado não cumpre exigência (regra genérica)
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
        -- Exclui comprovante_endereco_ano_* das aliases genéricas:
        -- esses slots só são satisfeitos pelo bloco acima (com ano correto)
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
