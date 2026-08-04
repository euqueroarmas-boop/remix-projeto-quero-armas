UPDATE public.qa_servicos_documentos
SET regra_validacao = (regra_validacao - 'exige_quando')
  || jsonb_build_object('dispensa_quando', jsonb_build_object('exames_instituicao','sim'))
WHERE tipo_documento IN ('laudo_psicologico','laudo_capacidade_tecnica')
  AND regra_validacao->'exige_quando'->>'exames_instituicao' = 'nao';