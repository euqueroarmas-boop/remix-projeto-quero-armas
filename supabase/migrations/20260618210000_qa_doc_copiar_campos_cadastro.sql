-- Trigger SECURITY DEFINER que copia campos do documento para qa_clientes.
-- Roda no servidor, contornando RLS — padrão de todos os outros triggers do projeto.
--
-- Regras:
--   • antecedentes_eleitoral → numero_documento → qa_clientes.titulo_eleitor
--     (somente se titulo_eleitor estiver nulo ou vazio no cadastro)

CREATE OR REPLACE FUNCTION public.qa_doc_copiar_campos_cadastro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id integer;
BEGIN
  -- Resolve qa_cliente_id (pode vir direto ou pelo customer_id)
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

  -- Certidão eleitoral: numero_documento = número do título de eleitor
  IF NEW.tipo_documento = 'antecedentes_eleitoral'
     AND NEW.numero_documento IS NOT NULL
     AND NEW.numero_documento <> ''
  THEN
    UPDATE public.qa_clientes
    SET titulo_eleitor = NEW.numero_documento
    WHERE id = v_cliente_id
      AND (titulo_eleitor IS NULL OR titulo_eleitor = '');
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.qa_doc_copiar_campos_cadastro() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_doc_copiar_campos_cadastro() TO authenticated, service_role;

DROP TRIGGER IF EXISTS qa_doc_copiar_campos_cadastro_trigger ON public.qa_documentos_cliente;

CREATE TRIGGER qa_doc_copiar_campos_cadastro_trigger
  AFTER INSERT ON public.qa_documentos_cliente
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_doc_copiar_campos_cadastro();
