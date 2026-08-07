ALTER TABLE public.qa_solicitacoes_servico RENAME COLUMN processo_id TO processo_id_legacy_int;

ALTER TABLE public.qa_solicitacoes_servico
  ADD COLUMN processo_id uuid REFERENCES public.qa_processos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_qa_solicitacoes_servico_processo_id
  ON public.qa_solicitacoes_servico(processo_id);

UPDATE public.qa_solicitacoes_servico s
SET processo_id = p.id
FROM public.qa_processos p
WHERE p.solicitacao_id = s.id
  AND s.processo_id IS DISTINCT FROM p.id;

CREATE OR REPLACE FUNCTION public.qa_solicitacao_vincula_processo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.solicitacao_id IS NOT NULL THEN
    UPDATE public.qa_solicitacoes_servico
    SET processo_id = NEW.id
    WHERE id = NEW.solicitacao_id
      AND processo_id IS DISTINCT FROM NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_solicitacao_vincula_processo ON public.qa_processos;
CREATE TRIGGER trg_qa_solicitacao_vincula_processo
AFTER INSERT OR UPDATE OF solicitacao_id ON public.qa_processos
FOR EACH ROW
EXECUTE FUNCTION public.qa_solicitacao_vincula_processo();