-- ============================================================================
-- PRÉVIA: o que a varredura diária reabriria, hoje e nos próximos 30 dias
--
-- Rode ANTES de agendar (20260819070000). Mostra exatamente as exigências que
-- a varredura devolveria para "pendente" — usando o MESMO critério do conserto
-- (mesmos joins, mesmos filtros), inclusive a guarda de `nao_aplicavel`.
--
-- `reabre_em`: 'HOJE' = já vencido/reprovado, entra no primeiro ciclo.
--              data   = entra no ciclo do dia seguinte ao vencimento.
-- ============================================================================

SELECT c.nome_completo,
       p.servico_nome,
       pd.nome_documento,
       pd.tipo_documento,
       pd.status                AS status_hoje,
       dc.status                AS status_no_acervo,
       dc.data_validade,
       CASE
         WHEN dc.status <> 'aprovado'
           OR (dc.data_validade IS NOT NULL AND dc.data_validade < CURRENT_DATE)
           THEN 'HOJE'
         ELSE to_char(dc.data_validade + 1, 'DD/MM/YYYY')
       END                      AS reabre_em,
       dc.data_validade - CURRENT_DATE AS dias_ate_vencer
  FROM public.qa_processo_documentos pd
  JOIN public.qa_processos p ON p.id = pd.processo_id
  JOIN public.qa_clientes   c ON c.id = p.cliente_id
  JOIN public.qa_documentos_cliente dc
    ON dc.arquivo_storage_path = pd.arquivo_storage_key
 WHERE pd.status NOT IN ('pendente', 'nao_aplicavel')
   AND public.qa_processo_em_aberto(p.status)
   AND (
     dc.status <> 'aprovado'
     OR (dc.data_validade IS NOT NULL AND dc.data_validade < CURRENT_DATE + 30)
   )
 ORDER BY dc.data_validade NULLS LAST, c.nome_completo;
