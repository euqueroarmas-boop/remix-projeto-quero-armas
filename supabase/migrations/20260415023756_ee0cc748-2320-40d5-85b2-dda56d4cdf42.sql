
ALTER TABLE public.qa_jurisprudencias
  ADD COLUMN IF NOT EXISTS arquivo_url TEXT,
  ADD COLUMN IF NOT EXISTS link_fonte TEXT,
  ADD COLUMN IF NOT EXISTS categoria_tematica TEXT;
