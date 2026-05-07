ALTER TABLE public.qa_crafs ADD COLUMN IF NOT EXISTS arma_especie text;

UPDATE public.qa_crafs c
SET arma_especie = d.arma_especie
FROM public.qa_documentos_cliente d
WHERE c.documento_origem_id = d.id
  AND d.arma_especie IS NOT NULL
  AND (c.arma_especie IS NULL OR c.arma_especie = '');