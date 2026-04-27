ALTER TABLE public.qa_armamentos_catalogo
ADD COLUMN IF NOT EXISTS imagens text[] NOT NULL DEFAULT '{}'::text[];