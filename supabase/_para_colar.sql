-- =============================================================================
-- O QUE FALTA PARA FECHAR O CASO DO IGOR (cliente 235)
-- Processo 3c40ff08-5377-4090-9be2-894a8b04bb43 — serviço 60 (Autorização de
-- Compra / Posse de Arma de Fogo).
--
-- Responde: (a) de onde veio o extrato do INSS duplicado, (b) se isso vai
-- repetir em todo cliente CLT, (c) por que o card do painel aponta a certidão
-- do TRF3 como próximo passo.
-- Somente leitura. Um SELECT só — rodar tudo de uma vez e exportar o resultado.
-- =============================================================================

SELECT '01_itens_de_renda_do_igor' AS bloco, to_jsonb(x) AS dado FROM (
  SELECT pd.tipo_documento, pd.nome_documento, pd.status, pd.etapa, pd.ordem,
         pd.obrigatorio, pd.created_at, pd.updated_at,
         pd.regra_validacao ->> 'grupo_checklist' AS grupo_no_item,
         pd.id
    FROM public.qa_processo_documentos pd
   WHERE pd.processo_id = '3c40ff08-5377-4090-9be2-894a8b04bb43'
     AND (lower(pd.tipo_documento) LIKE 'renda%'
          OR lower(pd.tipo_documento) = 'ctps'
          OR lower(pd.tipo_documento) LIKE '%ocupacao%'
          OR lower(pd.tipo_documento) LIKE '%condicao%')
) x

UNION ALL
SELECT '02_catalogo_servico_60_condicionais', to_jsonb(y) FROM (
  SELECT sd.tipo_documento, sd.nome_documento, sd.etapa, sd.ordem,
         sd.obrigatorio, sd.ativo, sd.condicao_profissional, sd.grupo_id,
         sd.regra_validacao ->> 'grupo_checklist' AS grupo_regra
    FROM public.qa_servicos_documentos sd
   WHERE sd.servico_id = 60
     AND (sd.condicao_profissional IS NOT NULL
          OR lower(sd.tipo_documento) LIKE 'renda%'
          OR lower(sd.tipo_documento) = 'ctps'
          OR lower(sd.tipo_documento) LIKE '%ocupacao%')
) y

UNION ALL
SELECT '03_duplicados_no_processo_do_igor', to_jsonb(w) FROM (
  SELECT pd.tipo_documento,
         count(*)                                   AS vezes,
         array_agg(pd.ordem  ORDER BY pd.ordem)     AS ordens,
         array_agg(pd.status ORDER BY pd.ordem)     AS status_das_linhas,
         array_agg(pd.created_at ORDER BY pd.ordem) AS criados_em
    FROM public.qa_processo_documentos pd
   WHERE pd.processo_id = '3c40ff08-5377-4090-9be2-894a8b04bb43'
   GROUP BY pd.tipo_documento
  HAVING count(*) > 1
) w

UNION ALL
SELECT '04_duplicados_em_todos_os_processos', to_jsonb(v) FROM (
  -- Se aparecer muita linha aqui, a duplicidade é da regra e vai repetir.
  SELECT p.cliente_id, cl.nome_completo, p.servico_id, p.servico_nome,
         pd.tipo_documento, count(*) AS vezes, p.id AS processo_id
    FROM public.qa_processo_documentos pd
    JOIN public.qa_processos p  ON p.id = pd.processo_id
    JOIN public.qa_clientes  cl ON cl.id = p.cliente_id
   GROUP BY p.cliente_id, cl.nome_completo, p.servico_id, p.servico_nome,
            pd.tipo_documento, p.id
  HAVING count(*) > 1
) v

UNION ALL
SELECT '05_painel_do_cliente', to_jsonb(pc) FROM (
  SELECT * FROM public.qa_painel_progresso_clientes()
   WHERE cliente_id = 235
) pc

UNION ALL
SELECT '06_eventos_recentes_do_processo', to_jsonb(e) FROM (
  SELECT pe.created_at, pe.tipo_evento, pe.descricao, pe.dados_json
    FROM public.qa_processo_eventos pe
   WHERE pe.processo_id = '3c40ff08-5377-4090-9be2-894a8b04bb43'
     AND pe.created_at >= now() - interval '2 days'
   ORDER BY pe.created_at DESC
   LIMIT 60
) e

ORDER BY 1;
