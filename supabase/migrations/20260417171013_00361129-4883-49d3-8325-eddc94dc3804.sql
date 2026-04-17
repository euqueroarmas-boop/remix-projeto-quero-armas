-- Auto-fill id_legado on qa_vendas if not provided
CREATE OR REPLACE FUNCTION public.qa_vendas_set_id_legado()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id_legado IS NULL THEN
    SELECT COALESCE(MAX(id_legado), 0) + 1 INTO NEW.id_legado FROM public.qa_vendas;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS qa_vendas_set_id_legado_trg ON public.qa_vendas;
CREATE TRIGGER qa_vendas_set_id_legado_trg
BEFORE INSERT ON public.qa_vendas
FOR EACH ROW
EXECUTE FUNCTION public.qa_vendas_set_id_legado();