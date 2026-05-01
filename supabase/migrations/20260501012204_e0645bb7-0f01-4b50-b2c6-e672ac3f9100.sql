ALTER TABLE public.qa_senha_gov_acessos
  DROP CONSTRAINT IF EXISTS fk_qa_senha_gov__cliente;
ALTER TABLE public.qa_senha_gov_acessos
  ADD CONSTRAINT fk_qa_senha_gov__cliente
  FOREIGN KEY (cliente_id) REFERENCES public.qa_clientes(id) ON DELETE CASCADE;

ALTER TABLE public.qa_senha_gov_acessos
  DROP CONSTRAINT IF EXISTS qa_senha_gov_acessos_cadastro_cr_id_fkey;
ALTER TABLE public.qa_senha_gov_acessos
  ADD CONSTRAINT qa_senha_gov_acessos_cadastro_cr_id_fkey
  FOREIGN KEY (cadastro_cr_id) REFERENCES public.qa_cadastro_cr(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.qa_senha_gov_acessos_imutavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allow_delete boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.cadastro_cr_id IS NOT NULL
       AND NEW.cadastro_cr_id IS NULL
       AND (to_jsonb(NEW) - 'cadastro_cr_id') = (to_jsonb(OLD) - 'cadastro_cr_id')
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Registros de auditoria de Senha Gov são imutáveis (acao=%).', TG_OP;
  END IF;

  IF TG_OP = 'DELETE' THEN
    BEGIN
      v_allow_delete := current_setting('app.allow_senha_gov_delete', true)::boolean;
    EXCEPTION WHEN OTHERS THEN
      v_allow_delete := false;
    END;
    IF v_allow_delete IS TRUE THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Registros de auditoria de Senha Gov são imutáveis (acao=%).', TG_OP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.qa_libera_delete_senha_gov()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.allow_senha_gov_delete', 'true', true);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_clientes_libera_senha_gov ON public.qa_clientes;
CREATE TRIGGER trg_qa_clientes_libera_senha_gov
  BEFORE DELETE ON public.qa_clientes
  FOR EACH ROW EXECUTE FUNCTION public.qa_libera_delete_senha_gov();

DROP TRIGGER IF EXISTS trg_qa_cadastro_cr_libera_senha_gov ON public.qa_cadastro_cr;
CREATE TRIGGER trg_qa_cadastro_cr_libera_senha_gov
  BEFORE DELETE ON public.qa_cadastro_cr
  FOR EACH ROW EXECUTE FUNCTION public.qa_libera_delete_senha_gov();