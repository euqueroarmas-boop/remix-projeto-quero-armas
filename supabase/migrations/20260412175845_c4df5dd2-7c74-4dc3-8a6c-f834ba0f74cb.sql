
CREATE OR REPLACE FUNCTION public.qa_listar_municipios_por_uf(p_uf text)
RETURNS TABLE(municipio text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT m.municipio
  FROM public.qa_circunscricoes_pf c,
       unnest(c.municipios_cobertos) AS m(municipio)
  WHERE c.uf = upper(trim(p_uf))
  ORDER BY m.municipio;
$$;
