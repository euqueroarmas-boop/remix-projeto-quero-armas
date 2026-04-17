ALTER TABLE public.qa_servicos
  ADD COLUMN IF NOT EXISTS is_combo boolean NOT NULL DEFAULT false;

UPDATE public.qa_servicos
   SET is_combo = true
 WHERE upper(trim(nome_servico)) LIKE 'COMBO -%'
   AND is_combo = false;

CREATE INDEX IF NOT EXISTS idx_qa_servicos_is_combo
  ON public.qa_servicos (is_combo)
  WHERE is_combo = true;