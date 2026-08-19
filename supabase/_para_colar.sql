-- ============================================================================
-- DIAGNÓSTICO — Concessão de CR (serviço 20 / slug 'concessao-cr')
-- ----------------------------------------------------------------------------
-- SOMENTE LEITURA. Nada aqui altera o banco.
-- Rode TUDO de uma vez no SQL Editor e me mande os 17 resultados.
-- Sem eles não dá para montar o checklist sem chutar.
-- ============================================================================

-- 1) O serviço existe e está ligado? (comercial + operacional)
SELECT 'Q1 catalogo' AS q, c.slug, c.nome, c.ativo, c.gera_processo, c.exige_cadastro,
       c.exige_pagamento, c.preco, c.categoria, c.categoria_servico_slug, c.tipo,
       c.tipo_processo, c.checklist_type, c.contrato_type, c.sigla_protocolo,
       c.servico_id, c.exige_cr, c.exige_acervo, c.display_order, c.standalone_permitido
  FROM public.qa_servicos_catalogo c
 WHERE c.slug ILIKE '%cr%' OR c.nome ILIKE '%certificado de registro%' OR c.servico_id = 20
 ORDER BY c.slug;

-- 2) Linha do serviço na tabela operacional
SELECT 'Q2 qa_servicos' AS q, id, nome_servico, valor_servico, is_combo
  FROM public.qa_servicos
 WHERE id IN (2, 3, 20, 60)
 ORDER BY id;

-- 3) Checklist que HOJE existe para o CR (esperado: vazio ou incompleto)
SELECT 'Q3 checklist CR' AS q, tipo_documento, nome_documento, etapa, ordem, obrigatorio,
       obrigatorio_etapa02, ativo, emissor, escopo, orgao_emissor, formato_aceito,
       validade_dias, condicao_modalidade, condicao_profissional, grupo_id,
       regra_validacao
  FROM public.qa_servicos_documentos
 WHERE servico_id = 20
 ORDER BY ordem, tipo_documento;

-- 4) Checklist da POSSE (2 e 60) — é a base que vamos reaproveitar
SELECT 'Q4 checklist posse' AS q, servico_id, tipo_documento, nome_documento, etapa, ordem,
       obrigatorio, ativo, emissor, escopo, orgao_emissor, validade_dias,
       condicao_modalidade, condicao_profissional,
       regra_validacao ->> 'grupo_checklist'       AS grupo_checklist,
       regra_validacao ->> 'ordem_grupo_checklist' AS ordem_no_grupo
  FROM public.qa_servicos_documentos
 WHERE servico_id IN (2, 60) AND ativo
 ORDER BY servico_id, ordem, tipo_documento;

-- 5) Vocabulário fechado de tipos de documento (o que já existe para reusar)
SELECT 'Q5 catalogo tipos' AS q, tipo_documento, label_publico, categoria_hub, subcategoria_hub,
       escopo_documental, regime, exige_validade, reaproveitavel_global,
       revisao_humana_obrigatoria, aceita_ia, aceita_vinculo_arma, ativo, ordem
  FROM public.qa_tipos_documento_catalogo
 WHERE ativo
 ORDER BY categoria_hub, ordem, tipo_documento;

-- 6) Travas de CHECK em tipo_documento (para saber se tipo novo precisa de ALTER)
SELECT 'Q6 checks' AS q, rel.relname AS tabela, con.conname AS constraint_name,
       pg_get_constraintdef(con.oid) AS definicao
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace ns ON ns.oid = rel.relnamespace
 WHERE ns.nspname = 'public'
   AND con.contype = 'c'
   AND pg_get_constraintdef(con.oid) ILIKE '%tipo_documento%'
 ORDER BY rel.relname, con.conname;

-- 7) Biblioteca de documentos (códigos que já têm instrução/modelo prontos)
SELECT 'Q7 biblioteca' AS q, codigo, nome, categoria, emissor_padrao, validade_dias,
       link_emissao, link_modelo, ativo
  FROM public.qa_documentos_biblioteca
 WHERE ativo
 ORDER BY categoria, codigo;

-- 8) Modalidades CAC cadastradas
SELECT 'Q8 modalidades' AS q, codigo, nome, base_legal, ativo
  FROM public.qa_modalidades
 ORDER BY codigo;

-- 9) Pré-requisitos configurados para o CR
SELECT 'Q9 prerequisitos' AS q, servico_slug, prerequisito_slug, tipo, ativo, observacao
  FROM public.qa_servicos_prerequisitos
 WHERE servico_slug ILIKE '%cr%' OR prerequisito_slug ILIKE '%cr%'
 ORDER BY servico_slug;

-- 10) Vínculo tipo x serviço e reaproveitamento entre processos
SELECT 'Q10 tipos_servicos' AS q, servico_id, tipo_documento, obrigatorio, ordem,
       modo_reaproveitamento, validade_dias, observacao_regra
  FROM public.qa_tipos_documento_servicos
 WHERE servico_id IN (2, 20, 60)
 ORDER BY servico_id, ordem;

-- 11) Grupos de checklist (globais e do serviço 20)
SELECT 'Q11 grupos' AS q, id, slug, nome, ordem, cor, servico_id, ativo
  FROM public.qa_checklist_grupos
 WHERE servico_id IS NULL OR servico_id IN (2, 20, 60)
 ORDER BY servico_id NULLS FIRST, ordem;

-- 12) Exames exigidos por serviço (psicológico / tiro)
SELECT 'Q12 exames' AS q, servico_id, nome_servico, exige_psicologico, exige_tiro, ativo, observacoes
  FROM public.qa_servicos_com_exame
 ORDER BY servico_id;

-- 13) Já existe movimento real de CR? (venda, solicitação, processo)
SELECT 'Q13 movimento' AS q,
       (SELECT count(*) FROM public.qa_solicitacoes_servico WHERE servico_id = 20 OR service_slug = 'concessao-cr') AS solicitacoes,
       (SELECT count(*) FROM public.qa_processos          WHERE servico_id = 20)                                    AS processos,
       (SELECT count(*) FROM public.qa_processos          WHERE servico_id = 20 AND deferimento_data IS NOT NULL)   AS processos_deferidos,
       (SELECT count(*) FROM public.qa_itens_venda        WHERE servico_id = 20)                                    AS itens_venda;

-- 14) Modelos de parser já treinados nos tipos que o CR vai usar
SELECT 'Q14 modelos parser' AS q, tipo_documento, count(*) AS modelos,
       count(*) FILTER (WHERE texto_ocr_normalizado IS NOT NULL) AS com_deterministico,
       count(*) FILTER (WHERE embedding_texto IS NOT NULL)       AS com_ia
  FROM public.qa_documentos_modelos_aprovados
 WHERE ativo
 GROUP BY tipo_documento
 ORDER BY tipo_documento;

-- 15) A IN 311/2025 está na base de conhecimento? Com texto integral?
SELECT 'Q15 norma' AS q, id, tipo_norma, numero_norma, ano_norma, titulo_norma, orgao_emissor,
       ativa, revisada_humanamente, data_vigencia,
       length(coalesce(texto_integral, '')) AS tamanho_texto,
       (SELECT count(*) FROM public.qa_chunks_conhecimento ck WHERE ck.fonte_normativa_id = f.id) AS chunks
  FROM public.qa_fontes_normativas f
 WHERE numero_norma ILIKE '%311%' OR titulo_norma ILIKE '%311%'
 ORDER BY ano_norma DESC;

-- 16) Trechos da IN 311 que tratam do registro/CR do CAC (é daqui que sai a exigência)
SELECT 'Q16 IN311 trechos' AS q, ck.ordem_chunk, ck.texto_chunk
  FROM public.qa_chunks_conhecimento ck
  JOIN public.qa_fontes_normativas f ON f.id = ck.fonte_normativa_id
 WHERE (f.numero_norma ILIKE '%311%' OR f.titulo_norma ILIKE '%311%')
   AND ck.texto_chunk ~* '(certificado de registro|requisito|inscri[çc][ãa]o|colecionador|atirador|ca[çc]ador|idoneidade|aptid[ãa]o|capacidade t[ée]cnica|ocupa[çc][ãa]o l[íi]cita|guarda|entidade de tiro)'
 ORDER BY ck.ordem_chunk
 LIMIT 60;

-- 17) Validade e prazos já configurados para os documentos do mundo CAC
SELECT 'Q17 validade' AS q, tipo_documento, validade_dias, unidade, perpetuo, alerta_dias,
       base_legal, rotulo, ativo
  FROM public.qa_validade_documentos
 WHERE ativo
 ORDER BY tipo_documento;
