CREATE OR REPLACE FUNCTION public.qa_contract_templates_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.qa_contract_aceites_log_block_mutations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'qa_contract_aceites_log é imutável (log probatório). Operações UPDATE/DELETE são proibidas.';
  RETURN NULL;
END;
$$;