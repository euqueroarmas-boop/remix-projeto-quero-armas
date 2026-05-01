CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.qa_catalogo_sync_servico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_servico_id integer;
  v_nome_norm  text;
BEGIN
  v_nome_norm := lower(unaccent(coalesce(NEW.nome, '')));

  IF v_nome_norm IS NULL OR length(trim(v_nome_norm)) = 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.servico_id IS NOT NULL THEN
    v_servico_id := NEW.servico_id;
  ELSE
    SELECT s.id INTO v_servico_id
    FROM qa_servicos s
    WHERE lower(unaccent(s.nome_servico)) = v_nome_norm
    LIMIT 1;

    IF v_servico_id IS NULL THEN
      INSERT INTO qa_servicos (nome_servico, valor_servico)
      VALUES (NEW.nome, coalesce(NEW.preco, 0))
      RETURNING id INTO v_servico_id;
    END IF;

    NEW.servico_id := v_servico_id;
  END IF;

  UPDATE qa_servicos
     SET nome_servico  = NEW.nome,
         valor_servico = coalesce(NEW.preco, 0)
   WHERE id = v_servico_id
     AND (nome_servico IS DISTINCT FROM NEW.nome
       OR valor_servico IS DISTINCT FROM coalesce(NEW.preco, 0));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_catalogo_sync_servico ON public.qa_servicos_catalogo;
CREATE TRIGGER trg_qa_catalogo_sync_servico
BEFORE INSERT OR UPDATE OF nome, preco, servico_id, ativo
ON public.qa_servicos_catalogo
FOR EACH ROW
EXECUTE FUNCTION public.qa_catalogo_sync_servico();

UPDATE public.qa_servicos_catalogo
   SET updated_at = now()
 WHERE ativo = true;