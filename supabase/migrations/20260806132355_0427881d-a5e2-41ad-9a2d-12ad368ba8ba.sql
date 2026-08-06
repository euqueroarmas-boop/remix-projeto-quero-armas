UPDATE public.qa_documentos_cliente
   SET data_validade = (data_emissao + INTERVAL '90 days')::date
 WHERE data_emissao IS NOT NULL
   AND (
     tipo_documento ILIKE '%sjsp%'
     OR tipo_documento ILIKE '%secao_judiciar%'
     OR tipo_documento ILIKE '%jef%'
     OR tipo_documento ILIKE '%trf%'
   )
   AND (data_validade IS NULL OR data_validade < (data_emissao + INTERVAL '90 days')::date);

UPDATE public.qa_documentos_biblioteca
   SET validade_dias = 90
 WHERE (codigo ILIKE '%sjsp%' OR codigo ILIKE '%secao_judiciar%' OR codigo ILIKE '%jef%' OR codigo ILIKE '%trf%'
        OR nome ILIKE '%Seção Judiciária%' OR nome ILIKE '%Juizado Especial Federal%' OR nome ILIKE '%Tribunal Regional Federal%')
   AND COALESCE(validade_dias, 0) < 90;