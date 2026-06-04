CREATE OR REPLACE FUNCTION public.qa_vendas_sync_id_legado_seq()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id_legado IS NOT NULL THEN
    PERFORM setval(
      'public.qa_vendas_id_legado_seq',
      GREATEST(NEW.id_legado, (SELECT last_value FROM public.qa_vendas_id_legado_seq))
    );
  END IF;
  RETURN NEW;
END;
$$;