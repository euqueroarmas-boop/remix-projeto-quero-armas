CREATE OR REPLACE FUNCTION public.qa_pf_credenciados_proximos(
  p_tipo qa_pf_credenciado_tipo,
  p_lat double precision,
  p_lng double precision,
  p_raio_km double precision DEFAULT 50,
  p_limit integer DEFAULT 20,
  p_uf character DEFAULT NULL::bpchar,
  p_incluir_vencidos boolean DEFAULT false
)
RETURNS TABLE(
  id uuid, tipo qa_pf_credenciado_tipo, uf character, cidade text, bairro text,
  nome text, registro text, endereco text, telefones text[], emails text[],
  validade date, validade_label text, latitude double precision,
  longitude double precision, source_url text, distancia_km double precision
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT c.id, c.tipo, c.uf, c.cidade, c.bairro, c.nome, c.registro, c.endereco,
         c.telefones, c.emails, c.validade, c.validade_label, c.latitude, c.longitude,
         c.source_url,
         earth_distance(ll_to_earth(p_lat, p_lng), ll_to_earth(c.latitude, c.longitude)) / 1000.0 AS distancia_km
  FROM public.qa_pf_credenciados c
  WHERE c.tipo = p_tipo
    AND c.ativo = true
    AND (p_uf IS NULL OR c.uf = p_uf)
    AND (p_incluir_vencidos OR c.validade IS NULL OR c.validade >= CURRENT_DATE)
    AND c.latitude IS NOT NULL
    AND c.longitude IS NOT NULL
    AND earth_box(ll_to_earth(p_lat, p_lng), p_raio_km * 1000) @> ll_to_earth(c.latitude, c.longitude)
    AND earth_distance(ll_to_earth(p_lat, p_lng), ll_to_earth(c.latitude, c.longitude)) <= p_raio_km * 1000
  ORDER BY distancia_km ASC
  LIMIT p_limit;
$function$;