
-- Enable unaccent extension
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA public;

-- Recreate the resolver function with accent-insensitive matching
CREATE OR REPLACE FUNCTION public.qa_resolver_circunscricao_pf(p_municipio text, p_uf text)
RETURNS TABLE(
  unidade_pf text,
  sigla_unidade text,
  tipo_unidade text,
  municipio_sede text,
  uf text,
  base_legal text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.unidade_pf, c.sigla_unidade, c.tipo_unidade, c.municipio_sede, c.uf, c.base_legal
  FROM public.qa_circunscricoes_pf c
  WHERE c.uf = upper(trim(p_uf))
    AND public.unaccent(upper(trim(p_municipio))) = ANY(
      SELECT public.unaccent(upper(trim(m))) FROM unnest(c.municipios_cobertos) AS m
    )
  LIMIT 1;
$$;
