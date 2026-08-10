UPDATE public.qa_clientes
SET titulo_eleitor = regexp_replace(titulo_eleitor, '\D', '', 'g')
WHERE titulo_eleitor IS NOT NULL
  AND titulo_eleitor ~ '[^0-9]'
  AND length(regexp_replace(titulo_eleitor, '\D', '', 'g')) = 12;