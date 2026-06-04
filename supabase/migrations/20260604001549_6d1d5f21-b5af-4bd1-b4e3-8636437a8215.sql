DO $$
DECLARE
  v_litoral_norte text[] := ARRAY[
    'CARAGUATATUBA',
    'ILHABELA',
    'SAO SEBASTIAO',
    'UBATUBA'
  ];
BEGIN
  UPDATE public.qa_circunscricoes_pf c
     SET municipios_cobertos = COALESCE((
       SELECT array_agg(m ORDER BY m)
       FROM unnest(c.municipios_cobertos) AS m
       WHERE public.unaccent(upper(trim(m))) <> ALL (v_litoral_norte)
     ), '{}'::text[]),
         updated_at = now()
   WHERE c.uf = 'SP'
     AND COALESCE(c.sigla_unidade, '') <> 'DPF/SSB/SP'
     AND EXISTS (
       SELECT 1
       FROM unnest(c.municipios_cobertos) AS m
       WHERE public.unaccent(upper(trim(m))) = ANY (v_litoral_norte)
     );

  IF EXISTS (
    SELECT 1
    FROM public.qa_circunscricoes_pf
    WHERE uf = 'SP'
      AND (
        sigla_unidade = 'DPF/SSB/SP'
        OR public.unaccent(upper(trim(municipio_sede))) = 'SAO SEBASTIAO'
      )
  ) THEN
    UPDATE public.qa_circunscricoes_pf
       SET unidade_pf = 'Delegacia de Polícia Federal em São Sebastião',
           sigla_unidade = 'DPF/SSB/SP',
           tipo_unidade = 'delegacia',
           municipio_sede = 'São Sebastião',
           uf = 'SP',
           municipios_cobertos = ARRAY['Caraguatatuba', 'Ilhabela', 'São Sebastião', 'Ubatuba'],
           base_legal = 'Portaria DG/PF nº 16.145/2022, item 25.11',
           ato_normativo = 'Portaria DG/PF nº 16.145, de 26 de abril de 2022, alterada pela Portaria DG/PF nº 16.797, de 10 de novembro de 2022',
           updated_at = now()
     WHERE uf = 'SP'
       AND (
         sigla_unidade = 'DPF/SSB/SP'
         OR public.unaccent(upper(trim(municipio_sede))) = 'SAO SEBASTIAO'
       );
  ELSE
    INSERT INTO public.qa_circunscricoes_pf (
      unidade_pf,
      sigla_unidade,
      tipo_unidade,
      municipio_sede,
      uf,
      municipios_cobertos,
      base_legal,
      ato_normativo
    )
    VALUES (
      'Delegacia de Polícia Federal em São Sebastião',
      'DPF/SSB/SP',
      'delegacia',
      'São Sebastião',
      'SP',
      ARRAY['Caraguatatuba', 'Ilhabela', 'São Sebastião', 'Ubatuba'],
      'Portaria DG/PF nº 16.145/2022, item 25.11',
      'Portaria DG/PF nº 16.145, de 26 de abril de 2022, alterada pela Portaria DG/PF nº 16.797, de 10 de novembro de 2022'
    );
  END IF;
END $$;