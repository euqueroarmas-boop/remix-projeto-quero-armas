-- Tabela de exemplos validados para few-shot learning da IA de classificação.
-- Alimentada automaticamente quando um documento é aprovado pelo admin
-- ou quando um processo é marcado como validado.

CREATE TABLE IF NOT EXISTS public.qa_exemplos_ia (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_documento  text NOT NULL,
  justificativa   text,
  campos_extraidos jsonb NOT NULL DEFAULT '{}',
  confianca       numeric NOT NULL DEFAULT 0 CHECK (confianca >= 0 AND confianca <= 1),
  fonte           text NOT NULL DEFAULT 'admin_validado',
  documento_id    uuid REFERENCES public.qa_documentos_cliente(id) ON DELETE SET NULL,
  processo_id     uuid REFERENCES public.qa_processos(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_exemplos_ia_tipo        ON public.qa_exemplos_ia(tipo_documento);
CREATE INDEX IF NOT EXISTS idx_qa_exemplos_ia_created_desc ON public.qa_exemplos_ia(created_at DESC);

-- Trigger: ao aprovar/validar um documento (validado_admin = true),
-- registra o par (tipo, campos) como exemplo para futuras classificações.
CREATE OR REPLACE FUNCTION public.qa_doc_registrar_exemplo_ia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo        text;
  v_confianca   numeric;
  v_justificativa text;
  v_campos      jsonb;
BEGIN
  -- Só actua quando validado_admin passa a true
  IF NOT (NEW.validado_admin = true AND (TG_OP = 'INSERT' OR OLD.validado_admin IS DISTINCT FROM true)) THEN
    RETURN NEW;
  END IF;

  IF NEW.ia_dados_extraidos IS NULL THEN
    RETURN NEW;
  END IF;

  v_tipo          := NEW.ia_dados_extraidos->>'tipoDetectado';
  v_confianca     := (NEW.ia_dados_extraidos->>'confianca')::numeric;
  v_justificativa := NEW.ia_dados_extraidos->>'justificativa';
  v_campos        := NEW.ia_dados_extraidos->'camposExtraidos';

  -- Não registrar tipo desconhecido ou ausente
  IF v_tipo IS NULL OR v_tipo = 'DESCONHECIDO' THEN
    RETURN NEW;
  END IF;

  -- Evitar duplicata do mesmo documento
  IF EXISTS (SELECT 1 FROM public.qa_exemplos_ia WHERE documento_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.qa_exemplos_ia
    (tipo_documento, justificativa, campos_extraidos, confianca, fonte, documento_id)
  VALUES
    (v_tipo, v_justificativa, COALESCE(v_campos, '{}'), COALESCE(v_confianca, 0), 'admin_validado', NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qa_doc_registrar_exemplo_ia_trigger ON public.qa_documentos_cliente;

CREATE TRIGGER qa_doc_registrar_exemplo_ia_trigger
  AFTER INSERT OR UPDATE ON public.qa_documentos_cliente
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_doc_registrar_exemplo_ia();

-- Trigger: ao marcar processo como 'validado', registra todos os documentos
-- aprovados daquele processo como exemplos (fonte = 'processo_validado').
CREATE OR REPLACE FUNCTION public.qa_processo_registrar_exemplos_ia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_tipo        text;
  v_confianca   numeric;
  v_justificativa text;
  v_campos      jsonb;
BEGIN
  -- Só quando status muda para 'validado'
  IF NOT (NEW.status = 'validado' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'validado')) THEN
    RETURN NEW;
  END IF;

  FOR rec IN
    SELECT d.id, d.ia_dados_extraidos
    FROM public.qa_documentos_cliente d
    WHERE d.qa_cliente_id = NEW.cliente_id
      AND d.status = 'aprovado'
      AND d.ia_dados_extraidos IS NOT NULL
  LOOP
    v_tipo          := rec.ia_dados_extraidos->>'tipoDetectado';
    v_confianca     := (rec.ia_dados_extraidos->>'confianca')::numeric;
    v_justificativa := rec.ia_dados_extraidos->>'justificativa';
    v_campos        := rec.ia_dados_extraidos->'camposExtraidos';

    IF v_tipo IS NULL OR v_tipo = 'DESCONHECIDO' THEN
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM public.qa_exemplos_ia WHERE documento_id = rec.id) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.qa_exemplos_ia
      (tipo_documento, justificativa, campos_extraidos, confianca, fonte, documento_id, processo_id)
    VALUES
      (v_tipo, v_justificativa, COALESCE(v_campos, '{}'), COALESCE(v_confianca, 0), 'processo_validado', rec.id, NEW.id);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qa_processo_registrar_exemplos_ia_trigger ON public.qa_processos;

CREATE TRIGGER qa_processo_registrar_exemplos_ia_trigger
  AFTER INSERT OR UPDATE ON public.qa_processos
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_processo_registrar_exemplos_ia();
