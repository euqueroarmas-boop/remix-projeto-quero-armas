CREATE UNIQUE INDEX IF NOT EXISTS qa_fontes_normativas_tipo_numero_ano_uniq
ON public.qa_fontes_normativas (tipo_norma, numero_norma, ano_norma)
WHERE numero_norma IS NOT NULL AND ano_norma IS NOT NULL;