CREATE OR REPLACE FUNCTION public.qa_doc_normalizar_titularidade_comprovante()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titularidade text;
BEGIN
  IF NEW.tipo_documento IS DISTINCT FROM 'comprovante_residencia' THEN
    RETURN NEW;
  END IF;

  v_titularidade := NEW.ia_dados_extraidos->>'comprovante_residencia_titularidade';

  -- Fonte da verdade no servidor: a titularidade determinística grava a flag,
  -- para que um payload não consiga pular a regra pelo cliente.
  IF v_titularidade = 'terceiro' THEN
    NEW.endereco_em_nome_de_terceiro := true;
    NEW.ia_dados_extraidos :=
      COALESCE(NEW.ia_dados_extraidos, '{}'::jsonb)
      || jsonb_build_object('aguardando_declaracao_responsavel', true);
  ELSIF v_titularidade = 'propria' THEN
    NEW.endereco_em_nome_de_terceiro := false;
  ELSIF v_titularidade = 'indeterminada' THEN
    -- Titular ilegível não é terceiro: fica pendente, nunca aprovado sozinho.
    NEW.endereco_em_nome_de_terceiro := COALESCE(NEW.endereco_em_nome_de_terceiro, false);
    IF NEW.status = 'aprovado' THEN
      NEW.status := 'pendente_aprovacao';
    END IF;
  END IF;

  -- Trava de estado impossível: terceiro aprovado sem declaração validada.
  IF COALESCE(NEW.endereco_em_nome_de_terceiro, false) = true
     AND NEW.status = 'aprovado'
     AND NOT EXISTS (
       SELECT 1 FROM public.qa_declaracoes_residencia d
        WHERE d.documento_comprovante_id = NEW.id
          AND d.status = 'assinada_validada'
     ) THEN
    NEW.status := 'pendente_aprovacao';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_doc_normalizar_titularidade_comprovante ON public.qa_documentos_cliente;
CREATE TRIGGER trg_qa_doc_normalizar_titularidade_comprovante
BEFORE INSERT OR UPDATE ON public.qa_documentos_cliente
FOR EACH ROW EXECUTE FUNCTION public.qa_doc_normalizar_titularidade_comprovante();