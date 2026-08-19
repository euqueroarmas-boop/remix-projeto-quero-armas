-- ============================================================================
-- DIAGNÓSTICO — Concessão de CR (serviço 20 / slug 'concessao-cr')
-- ----------------------------------------------------------------------------
-- SOMENTE LEITURA. Nada aqui altera o banco.
-- Uma consulta só: devolve 16 linhas (bloco, dados) em JSON, para a exportação
-- do SQL Editor sair inteira. A Q17 (validade) já foi entregue.
-- ============================================================================

SELECT 'Q1 catalogo' AS bloco, (
  SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT c.slug, c.nome, c.ativo, c.gera_processo, c.exige_cadastro, c.exige_pagamento,
           c.preco, c.categoria, c.categoria_servico_slug, c.tipo, c.tipo_processo,
           c.checklist_type, c.contrato_type, c.sigla_protocolo, c.servico_id,
           c.exige_cr, c.exige_acervo, c.display_order, c.standalone_permitido
      FROM public.qa_servicos_catalogo c
     WHERE c.slug ILIKE '%cr%' OR c.nome ILIKE '%certificado de registro%' OR c.servico_id = 20
     ORDER BY c.slug
  ) t) AS dados

UNION ALL SELECT 'Q2 qa_servicos', (
  SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT id, nome_servico, valor_servico, is_combo
      FROM public.qa_servicos WHERE id IN (2, 3, 20, 60) ORDER BY id
  ) t)

UNION ALL SELECT 'Q3 checklist CR', (
  SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT tipo_documento, nome_documento, etapa, ordem, obrigatorio, obrigatorio_etapa02,
           ativo, emissor, escopo, orgao_emissor, formato_aceito, validade_dias,
           condicao_modalidade, condicao_profissional, grupo_id, regra_validacao
      FROM public.qa_servicos_documentos WHERE servico_id = 20 ORDER BY ordem, tipo_documento
  ) t)

UNION ALL SELECT 'Q4 checklist posse', (
  SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT servico_id, tipo_documento, nome_documento, etapa, ordem, obrigatorio, ativo,
           emissor, escopo, orgao_emissor, validade_dias, condicao_modalidade,
           condicao_profissional,
           regra_validacao ->> 'grupo_checklist'       AS grupo_checklist,
           regra_validacao ->> 'ordem_grupo_checklist' AS ordem_no_grupo
      FROM public.qa_servicos_documentos WHERE servico_id IN (2, 60) AND ativo
     ORDER BY servico_id, ordem, tipo_documento
  ) t)

UNION ALL SELECT 'Q5 catalogo tipos', (
  SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT tipo_documento, label_publico, categoria_hub, subcategoria_hub, escopo_documental,
           regime, exige_validade, reaproveitavel_global, revisao_humana_obrigatoria,
           aceita_ia, aceita_vinculo_arma, ordem
      FROM public.qa_tipos_documento_catalogo WHERE ativo
     ORDER BY categoria_hub, ordem, tipo_documento
  ) t)

UNION ALL SELECT 'Q6 checks', (
  SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT rel.relname AS tabela, con.conname AS constraint_name,
           pg_get_constraintdef(con.oid) AS definicao
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
     WHERE ns.nspname = 'public' AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) ILIKE '%tipo_documento%'
     ORDER BY rel.relname, con.conname
  ) t)

UNION ALL SELECT 'Q7 biblioteca', (
  SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT codigo, nome, categoria, emissor_padrao, validade_dias, link_emissao, link_modelo
      FROM public.qa_documentos_biblioteca WHERE ativo ORDER BY categoria, codigo
  ) t)

UNION ALL SELECT 'Q8 modalidades', (
  SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT codigo, nome, base_legal, ativo FROM public.qa_modalidades ORDER BY codigo
  ) t)

UNION ALL SELECT 'Q9 prerequisitos', (
  SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT servico_slug, prerequisito_slug, tipo, ativo, observacao
      FROM public.qa_servicos_prerequisitos
     WHERE servico_slug ILIKE '%cr%' OR prerequisito_slug ILIKE '%cr%'
     ORDER BY servico_slug
  ) t)

UNION ALL SELECT 'Q10 tipos_servicos', (
  SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT servico_id, tipo_documento, obrigatorio, ordem, modo_reaproveitamento,
           validade_dias, observacao_regra
      FROM public.qa_tipos_documento_servicos WHERE servico_id IN (2, 20, 60)
     ORDER BY servico_id, ordem
  ) t)

UNION ALL SELECT 'Q11 grupos', (
  SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT id, slug, nome, ordem, cor, servico_id, ativo
      FROM public.qa_checklist_grupos
     WHERE servico_id IS NULL OR servico_id IN (2, 20, 60)
     ORDER BY servico_id NULLS FIRST, ordem
  ) t)

UNION ALL SELECT 'Q12 exames', (
  SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT servico_id, nome_servico, exige_psicologico, exige_tiro, ativo, observacoes
      FROM public.qa_servicos_com_exame ORDER BY servico_id
  ) t)

UNION ALL SELECT 'Q13 movimento', to_jsonb(t) FROM (
    SELECT (SELECT count(*) FROM public.qa_solicitacoes_servico WHERE servico_id = 20 OR service_slug = 'concessao-cr') AS solicitacoes,
           (SELECT count(*) FROM public.qa_processos WHERE servico_id = 20)                                              AS processos,
           (SELECT count(*) FROM public.qa_processos WHERE servico_id = 20 AND deferimento_data IS NOT NULL)             AS processos_deferidos,
           (SELECT count(*) FROM public.qa_itens_venda WHERE servico_id = 20)                                            AS itens_venda
  ) t

UNION ALL SELECT 'Q14 modelos parser', (
  SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT tipo_documento, count(*) AS modelos,
           count(*) FILTER (WHERE texto_ocr_normalizado IS NOT NULL) AS com_deterministico,
           count(*) FILTER (WHERE embedding_texto IS NOT NULL)       AS com_ia
      FROM public.qa_documentos_modelos_aprovados WHERE ativo
     GROUP BY tipo_documento ORDER BY tipo_documento
  ) t)

UNION ALL SELECT 'Q15 norma', (
  SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT f.id, f.tipo_norma, f.numero_norma, f.ano_norma, f.titulo_norma, f.orgao_emissor,
           f.ativa, f.revisada_humanamente, f.data_vigencia,
           length(coalesce(f.texto_integral, '')) AS tamanho_texto,
           (SELECT count(*) FROM public.qa_chunks_conhecimento ck WHERE ck.fonte_normativa_id = f.id) AS chunks
      FROM public.qa_fontes_normativas f
     WHERE f.numero_norma ILIKE '%311%' OR f.titulo_norma ILIKE '%311%'
     ORDER BY f.ano_norma DESC
  ) t)

UNION ALL SELECT 'Q16 IN311 trechos', (
  SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT ck.ordem_chunk, ck.texto_chunk
      FROM public.qa_chunks_conhecimento ck
      JOIN public.qa_fontes_normativas f ON f.id = ck.fonte_normativa_id
     WHERE (f.numero_norma ILIKE '%311%' OR f.titulo_norma ILIKE '%311%')
       AND ck.texto_chunk ~* '(certificado de registro|requisito|inscri[çc][ãa]o|colecionador|atirador|ca[çc]ador|idoneidade|aptid[ãa]o|capacidade t[ée]cnica|ocupa[çc][ãa]o l[íi]cita|guarda|entidade de tiro)'
     ORDER BY ck.ordem_chunk LIMIT 60
  ) t);
