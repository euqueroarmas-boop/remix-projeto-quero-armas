BEGIN;

-- 1) Corrigir registros existentes sem chave canônica de venda.
WITH pendentes AS (
  SELECT
    id,
    CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM public.qa_clientes existente
        WHERE existente.id_legado = c.id
      ) THEN id
      ELSE (SELECT COALESCE(MAX(id_legado), 0) FROM public.qa_clientes) + ROW_NUMBER() OVER (ORDER BY id)
    END AS novo_id_legado
  FROM public.qa_clientes c
  WHERE id_legado IS NULL
)
UPDATE public.qa_clientes c
SET id_legado = p.novo_id_legado
FROM pendentes p
WHERE c.id = p.id;

-- 2) Garantir que próximos clientes também tenham chave válida para vendas.
CREATE OR REPLACE FUNCTION public.qa_clientes_ensure_id_legado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id_legado IS NULL THEN
    IF NEW.id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.qa_clientes c WHERE c.id_legado = NEW.id
    ) THEN
      NEW.id_legado := NEW.id;
    ELSE
      SELECT COALESCE(MAX(id_legado), 0) + 1
      INTO NEW.id_legado
      FROM public.qa_clientes;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_clientes_ensure_id_legado ON public.qa_clientes;
CREATE TRIGGER trg_qa_clientes_ensure_id_legado
BEFORE INSERT OR UPDATE OF id_legado ON public.qa_clientes
FOR EACH ROW
EXECUTE FUNCTION public.qa_clientes_ensure_id_legado();

COMMIT;