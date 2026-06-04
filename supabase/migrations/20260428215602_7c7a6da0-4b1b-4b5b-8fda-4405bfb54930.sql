ALTER TABLE public.qa_senha_gov_acessos
  ALTER COLUMN cadastro_cr_id DROP NOT NULL;

ALTER TABLE public.qa_senha_gov_acessos
  DROP CONSTRAINT IF EXISTS qa_senha_gov_acessos_cadastro_cr_id_fkey;

ALTER TABLE public.qa_senha_gov_acessos
  ADD CONSTRAINT qa_senha_gov_acessos_cadastro_cr_id_fkey
  FOREIGN KEY (cadastro_cr_id)
  REFERENCES public.qa_cadastro_cr(id)
  ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.qa_senha_gov_acessos_imutavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    RAISE EXCEPTION 'Registros de auditoria de Senha Gov são imutáveis (acao=%).', TG_OP;
  END IF;

  RETURN NEW;
END;
$function$;