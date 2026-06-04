UPDATE public.qa_clientes
SET celular = CASE
  WHEN length(regexp_replace(celular, '\D', '', 'g')) = 11 THEN
    '(' || substring(regexp_replace(celular, '\D', '', 'g'), 1, 2) || ') ' ||
    substring(regexp_replace(celular, '\D', '', 'g'), 3, 5) || '-' ||
    substring(regexp_replace(celular, '\D', '', 'g'), 8, 4)
  WHEN length(regexp_replace(celular, '\D', '', 'g')) = 10 THEN
    '(' || substring(regexp_replace(celular, '\D', '', 'g'), 1, 2) || ') ' ||
    substring(regexp_replace(celular, '\D', '', 'g'), 3, 4) || '-' ||
    substring(regexp_replace(celular, '\D', '', 'g'), 7, 4)
  ELSE celular
END
WHERE celular IS NOT NULL AND celular <> '' AND length(regexp_replace(celular, '\D', '', 'g')) IN (10, 11);