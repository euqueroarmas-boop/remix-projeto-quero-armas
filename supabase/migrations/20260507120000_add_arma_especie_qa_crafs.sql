-- Adiciona arma_especie em qa_crafs para preservar a espécie/tipo da arma
-- conforme extraída fielmente do documento (CRAF/SINARM/SIGMA). A espécie
-- do documento é PROVA e prevalece sobre inferência por nome do modelo.
ALTER TABLE public.qa_crafs ADD COLUMN IF NOT EXISTS arma_especie text;

-- Backfill a partir do documento de origem (qa_documentos_cliente).
UPDATE public.qa_crafs c
SET arma_especie = d.arma_especie
FROM public.qa_documentos_cliente d
WHERE c.documento_origem_id = d.id
  AND d.arma_especie IS NOT NULL
  AND (c.arma_especie IS NULL OR c.arma_especie = '');
