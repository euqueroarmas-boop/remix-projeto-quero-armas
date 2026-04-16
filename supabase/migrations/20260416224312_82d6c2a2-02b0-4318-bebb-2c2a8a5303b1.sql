
-- Migração: aproveitar exames legados de qa_cadastro_cr para qa_exames_cliente
-- Campos legados representam DATA DE VALIDADE (nome 'validade_*' confirma).
-- Regra: data_realizacao = validade - 1 ano; data_vencimento = validade legada.
-- Evita duplicidade via NOT EXISTS por (cliente_id, tipo, data_vencimento).

INSERT INTO public.qa_exames_cliente
  (cliente_id, tipo, data_realizacao, data_vencimento, observacoes, cadastrado_por_nome)
SELECT
  cr.cliente_id,
  'psicologico'::text,
  (cr.validade_laudo_psicologico - INTERVAL '1 year')::date,
  cr.validade_laudo_psicologico,
  'Importado do cadastro legado (qa_cadastro_cr.validade_laudo_psicologico). Data de realização inferida = validade - 1 ano.',
  'MIGRAÇÃO LEGADO'
FROM public.qa_cadastro_cr cr
WHERE cr.cliente_id IS NOT NULL
  AND cr.validade_laudo_psicologico IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.qa_exames_cliente e
    WHERE e.cliente_id = cr.cliente_id
      AND e.tipo = 'psicologico'
      AND e.data_vencimento = cr.validade_laudo_psicologico
  );

INSERT INTO public.qa_exames_cliente
  (cliente_id, tipo, data_realizacao, data_vencimento, observacoes, cadastrado_por_nome)
SELECT
  cr.cliente_id,
  'tiro'::text,
  (cr.validade_exame_tiro - INTERVAL '1 year')::date,
  cr.validade_exame_tiro,
  'Importado do cadastro legado (qa_cadastro_cr.validade_exame_tiro). Data de realização inferida = validade - 1 ano.',
  'MIGRAÇÃO LEGADO'
FROM public.qa_cadastro_cr cr
WHERE cr.cliente_id IS NOT NULL
  AND cr.validade_exame_tiro IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.qa_exames_cliente e
    WHERE e.cliente_id = cr.cliente_id
      AND e.tipo = 'tiro'
      AND e.data_vencimento = cr.validade_exame_tiro
  );
