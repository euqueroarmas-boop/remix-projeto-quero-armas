-- Cria sequência para qa_vendas.id_legado (chave canônica para itens/processos)
CREATE SEQUENCE IF NOT EXISTS public.qa_vendas_id_legado_seq;

-- Sincroniza com o maior valor existente
SELECT setval(
  'public.qa_vendas_id_legado_seq',
  COALESCE((SELECT MAX(id_legado) FROM public.qa_vendas), 0) + 1,
  false
);

-- Aplica como default (nunca sobrescreve valores explícitos vindos do legado)
ALTER TABLE public.qa_vendas
  ALTER COLUMN id_legado SET DEFAULT nextval('public.qa_vendas_id_legado_seq');

-- Garante que a sequência avance se alguém inserir id_legado manualmente (legado)
CREATE OR REPLACE FUNCTION public.qa_vendas_sync_id_legado_seq()
RETURNS trigger
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS trg_qa_vendas_sync_id_legado_seq ON public.qa_vendas;
CREATE TRIGGER trg_qa_vendas_sync_id_legado_seq
BEFORE INSERT ON public.qa_vendas
FOR EACH ROW
EXECUTE FUNCTION public.qa_vendas_sync_id_legado_seq();