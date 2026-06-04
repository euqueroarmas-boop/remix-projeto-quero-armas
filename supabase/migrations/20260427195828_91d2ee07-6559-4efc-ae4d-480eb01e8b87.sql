-- Auto-preenche id_legado em qa_clientes quando não fornecido (mesma lógica de qa_vendas)
CREATE OR REPLACE FUNCTION public.qa_clientes_set_id_legado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.id_legado IS NULL THEN
    SELECT COALESCE(MAX(id_legado), 0) + 1 INTO NEW.id_legado FROM public.qa_clientes;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_qa_clientes_set_id_legado ON public.qa_clientes;
CREATE TRIGGER trg_qa_clientes_set_id_legado
  BEFORE INSERT ON public.qa_clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_clientes_set_id_legado();

-- Garante o mesmo trigger em qa_vendas (caso ainda não esteja anexado)
DROP TRIGGER IF EXISTS trg_qa_vendas_set_id_legado ON public.qa_vendas;
CREATE TRIGGER trg_qa_vendas_set_id_legado
  BEFORE INSERT ON public.qa_vendas
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_vendas_set_id_legado();