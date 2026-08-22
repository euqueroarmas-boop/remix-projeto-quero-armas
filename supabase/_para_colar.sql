-- =============================================================================
-- (a) O extrato do INSS de CLT estava SEM GRUPO no catálogo do serviço 60.
-- Holerite e CTPS têm grupo_checklist='ocupacao'; só essa linha ficou vazia,
-- e por isso o item escorregava de grupo no checklist e no painel.
-- Correção pontual: preenche o grupo na linha do catálogo e na exigência já
-- criada no processo do Igor (cliente 235). Nada mais é tocado.
-- =============================================================================

UPDATE public.qa_servicos_documentos
   SET regra_validacao = jsonb_set(
         COALESCE(regra_validacao, '{}'::jsonb), '{grupo_checklist}', '"ocupacao"', true)
 WHERE servico_id = 60
   AND tipo_documento = 'renda_extrato_inss'
   AND condicao_profissional = 'clt'
   AND COALESCE(regra_validacao ->> 'grupo_checklist', '') <> 'ocupacao';

UPDATE public.qa_processo_documentos
   SET regra_validacao = jsonb_set(
         COALESCE(regra_validacao, '{}'::jsonb), '{grupo_checklist}', '"ocupacao"', true)
 WHERE processo_id = '3c40ff08-5377-4090-9be2-894a8b04bb43'
   AND tipo_documento = 'renda_extrato_inss'
   AND COALESCE(regra_validacao ->> 'grupo_checklist', '') <> 'ocupacao';

-- =============================================================================
-- (b) POR QUE O IGOR SUMIU DO PAINEL — somente leitura.
-- =============================================================================

SELECT '01_status_do_processo_e_do_cliente' AS bloco, to_jsonb(x) AS dado FROM (
  SELECT p.id AS processo_id, p.status AS status_processo, p.pagamento_status,
         cl.id AS cliente_id, cl.status AS status_cliente, cl.excluido, cl.arquivado
    FROM public.qa_processos p
    JOIN public.qa_clientes cl ON cl.id = p.cliente_id
   WHERE p.cliente_id = 235
) x

UNION ALL
SELECT '02_o_painel_lista_o_igor', to_jsonb(y) FROM (
  SELECT (SELECT count(*) FROM public.qa_painel_progresso_clientes() WHERE cliente_id = 235) AS linhas_do_igor,
         (SELECT count(*) FROM public.qa_painel_progresso_clientes())                        AS linhas_no_painel
) y

UNION ALL
SELECT '03_conferencia_do_grupo_corrigido', to_jsonb(z) FROM (
  SELECT pd.tipo_documento, pd.nome_documento,
         pd.regra_validacao ->> 'grupo_checklist' AS grupo
    FROM public.qa_processo_documentos pd
   WHERE pd.processo_id = '3c40ff08-5377-4090-9be2-894a8b04bb43'
     AND (lower(pd.tipo_documento) LIKE 'renda%' OR lower(pd.tipo_documento) = 'ctps')
) z

UNION ALL
SELECT '04_outras_linhas_de_catalogo_sem_grupo', to_jsonb(w) FROM (
  SELECT sd.servico_id, sd.tipo_documento, sd.nome_documento, sd.condicao_profissional
    FROM public.qa_servicos_documentos sd
   WHERE sd.ativo
     AND (sd.regra_validacao ->> 'grupo_checklist') IS NULL
   ORDER BY sd.servico_id, sd.ordem
) w

ORDER BY 1;
