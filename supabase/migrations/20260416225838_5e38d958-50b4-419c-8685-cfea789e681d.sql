-- Desabilitar somente o trigger de cálculo (não os de sistema)
ALTER TABLE public.qa_exames_cliente DISABLE TRIGGER USER;

-- PSICOLÓGICO: data_realizacao = validade_laudo_psicologico, vencimento = +1 ano
UPDATE public.qa_exames_cliente ec
SET 
  data_realizacao = cr.validade_laudo_psicologico,
  data_vencimento = (cr.validade_laudo_psicologico + INTERVAL '1 year')::date,
  observacoes = 'Importado do cadastro legado (qa_cadastro_cr.validade_laudo_psicologico = data de realização). Vencimento = realização + 1 ano.',
  updated_at = now()
FROM public.qa_cadastro_cr cr
JOIN public.qa_clientes cl ON cl.id_legado = cr.cliente_id OR cl.id = cr.cliente_id
WHERE ec.cliente_id = cl.id
  AND ec.tipo = 'psicologico'
  AND ec.cadastrado_por_nome = 'MIGRAÇÃO LEGADO'
  AND cr.validade_laudo_psicologico IS NOT NULL;

-- TIRO: data_realizacao = validade_exame_tiro, vencimento = +1 ano
UPDATE public.qa_exames_cliente ec
SET 
  data_realizacao = cr.validade_exame_tiro,
  data_vencimento = (cr.validade_exame_tiro + INTERVAL '1 year')::date,
  observacoes = 'Importado do cadastro legado (qa_cadastro_cr.validade_exame_tiro = data de realização). Vencimento = realização + 1 ano.',
  updated_at = now()
FROM public.qa_cadastro_cr cr
JOIN public.qa_clientes cl ON cl.id_legado = cr.cliente_id OR cl.id = cr.cliente_id
WHERE ec.cliente_id = cl.id
  AND ec.tipo = 'tiro'
  AND ec.cadastrado_por_nome = 'MIGRAÇÃO LEGADO'
  AND cr.validade_exame_tiro IS NOT NULL;

ALTER TABLE public.qa_exames_cliente ENABLE TRIGGER USER;