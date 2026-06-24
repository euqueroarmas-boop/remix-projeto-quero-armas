
CREATE INDEX IF NOT EXISTS qa_iat_credenciados_geocode_pendentes_idx
  ON public.qa_iat_credenciados (uf, id)
  WHERE lat IS NULL AND geocode_falhou IS NOT TRUE AND endereco IS NOT NULL AND endereco <> '';

DELETE FROM public.qa_endereco_geocache
 WHERE latitude IS NULL
   AND provider IN ('nominatim_cascade_failed', 'nominatim_structured')
   AND (raw->>'reason' IS NULL OR raw->>'reason' <> 'unparseable');
