CREATE OR REPLACE FUNCTION public.qa_itens_venda_auto_deferido()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.data_deferimento IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.data_deferimento IS DISTINCT FROM OLD.data_deferimento)
     AND COALESCE(UPPER(NEW.status), '') NOT IN ('INDEFERIDO', 'DESISTIU', 'RESTITUÍDO', 'RESTITUIDO', 'CANCELADO')
  THEN
    NEW.status := 'DEFERIDO';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_itens_venda_auto_deferido ON public.qa_itens_venda;
CREATE TRIGGER trg_qa_itens_venda_auto_deferido
BEFORE INSERT OR UPDATE OF data_deferimento, status ON public.qa_itens_venda
FOR EACH ROW
EXECUTE FUNCTION public.qa_itens_venda_auto_deferido();