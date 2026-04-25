ALTER TABLE public.qa_crafs ADD COLUMN IF NOT EXISTS catalogo_id uuid REFERENCES public.qa_armamentos_catalogo(id) ON DELETE SET NULL;
ALTER TABLE public.qa_gtes  ADD COLUMN IF NOT EXISTS catalogo_id uuid REFERENCES public.qa_armamentos_catalogo(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_qa_crafs_catalogo_id ON public.qa_crafs(catalogo_id);
CREATE INDEX IF NOT EXISTS idx_qa_gtes_catalogo_id  ON public.qa_gtes(catalogo_id);

ALTER TABLE public.qa_armamentos_catalogo
  ADD COLUMN IF NOT EXISTS manual_url text,
  ADD COLUMN IF NOT EXISTS imagem_fonte text,
  ADD COLUMN IF NOT EXISTS tem_fundo_transparente boolean NOT NULL DEFAULT false;