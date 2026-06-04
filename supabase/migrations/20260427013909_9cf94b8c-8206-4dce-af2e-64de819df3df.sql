ALTER TABLE public.qa_armamentos_catalogo
  ADD COLUMN IF NOT EXISTS imagem_aprovada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS imagem_enviada_por uuid,
  ADD COLUMN IF NOT EXISTS imagem_enviada_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_qa_armamentos_catalogo_imagem_aprovada
  ON public.qa_armamentos_catalogo(imagem_aprovada);