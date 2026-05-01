-- Adiciona docs de "funcionario_publico" para todos os servicos que ja tem outros perfis de renda cadastrados.
-- Idempotente: ON CONFLICT DO NOTHING via NOT EXISTS.

WITH servicos_alvo AS (
  SELECT DISTINCT servico_id
  FROM public.qa_servicos_documentos
  WHERE condicao_profissional IN ('clt','autonomo','empresario','aposentado')
    AND ativo = true
)
INSERT INTO public.qa_servicos_documentos (
  servico_id, tipo_documento, nome_documento, etapa, ativo, obrigatorio,
  condicao_profissional, instrucoes, observacoes_cliente, prazo_recomendado_dias
)
SELECT s.servico_id, 'renda_carteira_funcional',
  'Carteira Funcional / Documento Funcional',
  'renda', true, true, 'funcionario_publico',
  E'1) Localize sua carteira funcional ou documento oficial emitido pelo órgão público em que trabalha.\n2) Fotografe frente e verso ou escaneie em PDF.\n3) Envie o arquivo aqui.',
  'A funcional comprova que você é servidor público ATIVO. Sem ela, não é possível validar seu vínculo.',
  NULL
FROM servicos_alvo s
WHERE NOT EXISTS (
  SELECT 1 FROM public.qa_servicos_documentos x
  WHERE x.servico_id = s.servico_id
    AND x.tipo_documento = 'renda_carteira_funcional'
    AND x.condicao_profissional = 'funcionario_publico'
);

WITH servicos_alvo AS (
  SELECT DISTINCT servico_id
  FROM public.qa_servicos_documentos
  WHERE condicao_profissional IN ('clt','autonomo','empresario','aposentado')
    AND ativo = true
)
INSERT INTO public.qa_servicos_documentos (
  servico_id, tipo_documento, nome_documento, etapa, ativo, obrigatorio,
  condicao_profissional, instrucoes, observacoes_cliente, prazo_recomendado_dias
)
SELECT s.servico_id, 'renda_holerite_funcionario_publico',
  'Holerite recente (servidor público)',
  'renda', true, true, 'funcionario_publico',
  E'1) Acesse o portal do servidor do seu órgão (ex.: SIGRH, SIAPE, SEI etc.).\n2) Baixe o contracheque/holerite mais recente (últimos 30 dias).\n3) Envie em PDF preferencialmente.',
  'ATENÇÃO: o holerite deve ter sido emitido nos últimos 30 dias. Documentos antigos serão recusados.',
  30
FROM servicos_alvo s
WHERE NOT EXISTS (
  SELECT 1 FROM public.qa_servicos_documentos x
  WHERE x.servico_id = s.servico_id
    AND x.tipo_documento = 'renda_holerite_funcionario_publico'
    AND x.condicao_profissional = 'funcionario_publico'
);