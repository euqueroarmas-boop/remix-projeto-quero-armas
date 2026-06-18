-- Trigger que promove automaticamente um documento para 'aprovado'
-- quando a IA classificou com alta confiança (recomendacao = 'aceitar').
-- Isso contorna a restrição RLS (cliente não pode inserir como aprovado),
-- pois a promoção ocorre dentro de uma função SECURITY DEFINER no servidor.

CREATE OR REPLACE FUNCTION public.qa_doc_auto_aprovar_por_ia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recomendacao text;
  v_confianca    numeric;
BEGIN
  -- Só atua em inserts de documentos pendentes vindos do cliente
  IF NEW.status <> 'pendente_aprovacao' OR NEW.origem <> 'cliente' THEN
    RETURN NEW;
  END IF;

  -- Lê a recomendação e confiança que a IA gravou em ia_dados_extraidos
  v_recomendacao := NEW.ia_dados_extraidos->>'recomendacao';
  v_confianca    := (NEW.ia_dados_extraidos->>'confianca')::numeric;

  -- Promove para aprovado se a IA confia plenamente
  IF v_recomendacao = 'aceitar' OR v_confianca >= 0.85 THEN
    NEW.status       := 'aprovado';
    NEW.aprovado_em  := now();
    -- validado_admin permanece false — foi a IA, não um humano
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qa_doc_auto_aprovar_por_ia_trigger ON public.qa_documentos_cliente;

CREATE TRIGGER qa_doc_auto_aprovar_por_ia_trigger
  BEFORE INSERT ON public.qa_documentos_cliente
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_doc_auto_aprovar_por_ia();
