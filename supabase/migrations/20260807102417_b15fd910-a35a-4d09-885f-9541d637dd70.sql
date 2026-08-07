DO $$
DECLARE
  novos text[] := ARRAY[
    'antecedentes_estadual_ac','antecedentes_estadual_al','antecedentes_estadual_am','antecedentes_estadual_ap',
    'antecedentes_estadual_ba','antecedentes_estadual_ce','antecedentes_estadual_df','antecedentes_estadual_es',
    'antecedentes_estadual_go','antecedentes_estadual_ma','antecedentes_estadual_mg','antecedentes_estadual_ms',
    'antecedentes_estadual_mt','antecedentes_estadual_pa','antecedentes_estadual_pb','antecedentes_estadual_pe',
    'antecedentes_estadual_pi','antecedentes_estadual_pr','antecedentes_estadual_rj','antecedentes_estadual_rn',
    'antecedentes_estadual_ro','antecedentes_estadual_rr','antecedentes_estadual_rs','antecedentes_estadual_sc',
    'antecedentes_estadual_se','antecedentes_estadual_sp','antecedentes_estadual_to',
    'antecedentes_federal_trf1_regional','antecedentes_federal_trf2_regional','antecedentes_federal_trf4_regional',
    'antecedentes_federal_trf5_regional','antecedentes_federal_trf6_regional'
  ];
  atuais text[];
  def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO def
  FROM pg_constraint WHERE conname = 'qa_doc_cliente_tipo_check';

  SELECT array_agg(DISTINCT m[1]) INTO atuais
  FROM regexp_matches(def, '''([a-z0-9_]+)''::text', 'g') m;

  atuais := (SELECT array_agg(DISTINCT v ORDER BY v) FROM unnest(atuais || novos) v);

  EXECUTE format(
    'ALTER TABLE public.qa_documentos_cliente DROP CONSTRAINT qa_doc_cliente_tipo_check, '
    'ADD CONSTRAINT qa_doc_cliente_tipo_check CHECK (tipo_documento = ANY (%L::text[]))',
    atuais
  );
END $$;