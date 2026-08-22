-- =============================================================================
-- CONFERÊNCIA — Igor (cliente 235) trocou para ASSALARIADO (CLT):
-- os documentos de renda entraram? O grupo Ocupação Lícita existe e vem antes
-- da Idoneidade? Somente leitura, um bloco só.
-- Processo: 3c40ff08-5377-4090-9be2-894a8b04bb43 (serviço 60 — Autorização de
-- Compra / Posse de Arma de Fogo).
-- =============================================================================

-- 1) Condição gravada no processo e respostas do questionário.
SELECT 'condicao_no_processo' AS bloco,
       p.condicao_profissional,
       p.respostas_questionario_json,
       p.etapa_liberada_ate,
       p.updated_at
  FROM public.qa_processos p
 WHERE p.id = '3c40ff08-5377-4090-9be2-894a8b04bb43';

-- 2) O que a troca de condição fez (criados / removidos / preservados).
SELECT 'eventos_condicao' AS bloco,
       pe.created_at, pe.descricao, pe.dados_json
  FROM public.qa_processo_eventos pe
 WHERE pe.processo_id = '3c40ff08-5377-4090-9be2-894a8b04bb43'
   AND pe.tipo_evento IN ('condicao_profissional_definida','checklist_explodido','documento_criado')
 ORDER BY pe.created_at DESC
 LIMIT 30;

-- 3) TODO o checklist do processo hoje, na ordem, com o grupo de cada item.
--    Procurar aqui as linhas renda_* (holerite, CTPS, INSS).
SELECT 'checklist_hoje' AS bloco,
       pd.etapa, pd.ordem, pd.tipo_documento, pd.nome_documento,
       pd.status, pd.obrigatorio,
       pd.regra_validacao ->> 'grupo_checklist' AS grupo_no_item
  FROM public.qa_processo_documentos pd
 WHERE pd.processo_id = '3c40ff08-5377-4090-9be2-894a8b04bb43'
 ORDER BY pd.ordem NULLS LAST, pd.tipo_documento;

-- 4) Só as linhas de renda/ocupação — se vier vazio, os documentos de CLT
--    não foram criados.
SELECT 'itens_de_renda' AS bloco,
       pd.tipo_documento, pd.nome_documento, pd.status, pd.ordem, pd.created_at
  FROM public.qa_processo_documentos pd
 WHERE pd.processo_id = '3c40ff08-5377-4090-9be2-894a8b04bb43'
   AND (lower(pd.tipo_documento) LIKE 'renda%'
        OR lower(pd.tipo_documento) LIKE '%ocupacao%'
        OR lower(pd.tipo_documento) LIKE '%condicao%')
 ORDER BY pd.ordem NULLS LAST;

-- 5) O catálogo do serviço 60 tem exigências marcadas para CLT?
SELECT 'catalogo_servico_60_renda' AS bloco,
       sd.tipo_documento, sd.nome_documento, sd.etapa, sd.ordem,
       sd.obrigatorio, sd.ativo, sd.condicao_profissional
  FROM public.qa_servicos_documentos sd
 WHERE sd.servico_id = 60
   AND (sd.condicao_profissional IS NOT NULL
        OR lower(sd.tipo_documento) LIKE 'renda%'
        OR lower(sd.tipo_documento) LIKE '%ocupacao%')
 ORDER BY sd.ordem NULLS LAST;

-- 6) O que o catálogo entende que vale para ESTE processo agora
--    (já filtrado por condição, modalidade e UF).
SELECT 'catalogo_do_processo' AS bloco,
       cat.tipo_documento, cat.nome_documento, cat.etapa, cat.ordem, cat.obrigatorio
  FROM public.qa_catalogo_do_processo('3c40ff08-5377-4090-9be2-894a8b04bb43') cat
 ORDER BY cat.ordem NULLS LAST;

-- 7) Como o painel está lendo o processo (grupo atual e próximo passo do card).
SELECT 'painel_do_cliente' AS bloco, pc.*
  FROM public.qa_painel_progresso_clientes() pc
 WHERE pc.cliente_id = 235;

-- 8) Item a item por trás dos chips do card (grupo, ordem e bandeiras).
SELECT 'painel_itens' AS bloco,
       i.grupo_ordem, i.grupo_nome, i.item_ordem, i.tipo_documento,
       i.nome_documento, i.status, i.familia, i.aplicavel,
       i.conta_pendente, i.conta_cadastro, i.conta_entregue, i.conta_nao_se_aplica
  FROM public.qa_painel_progresso_itens('3c40ff08-5377-4090-9be2-894a8b04bb43') i
 ORDER BY i.grupo_ordem, i.item_ordem;
