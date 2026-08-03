
update public.qa_servicos_documentos
set regra_validacao = jsonb_set(
  regra_validacao,
  '{opcoes}',
  jsonb_build_array(
    jsonb_build_object('label','SIM — VOU USAR OS EXAMES DA MINHA INSTITUIÇÃO','valor','sim'),
    jsonb_build_object('label','NÃO — QUERO FAZER COM CREDENCIADOS DA PF (MOSTRAMOS OS MAIS PRÓXIMOS DE VOCÊ)','valor','nao')
  )
)
where tipo_documento = 'exames_instituicao_definir';
