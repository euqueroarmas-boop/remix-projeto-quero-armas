-- ============================================================================
-- DUAS PERGUNTAS EM UMA CONSULTA SÓ
--
-- A) A varredura diária realmente roda? A edge function `qa-vencimentos-alertas`
--    chama `qa_reabrir_exigencias_documento_invalido` antes de mandar os
--    alertas, mas NENHUMA migration deste repositório agenda essa function.
--    Se ela estiver agendada, está no painel do Supabase — e aparece aqui.
--
-- B) Quem seria ressuscitado indevidamente? Exigências marcadas
--    `nao_aplicavel` que a varredura ALCANÇA (o storage key bate com o acervo)
--    e cujo arquivo tem data de validade.
--
-- Bloco A vazio = a varredura NÃO roda sozinha hoje.
-- ============================================================================

SELECT 'A · AGENDAMENTOS ATIVOS' AS bloco,
       1 AS ord,
       coalesce(j.jobname, 'job ' || j.jobid::text) AS origem,
       jsonb_build_object(
         'schedule', j.schedule,
         'ativo',    j.active,
         'chama_vencimentos_alertas',
           (j.command ILIKE '%qa-vencimentos-alertas%'
            OR j.command ILIKE '%qa_reabrir_exigencias_documento_invalido%'),
         'comando',  left(j.command, 300)
       ) AS dados
  FROM cron.job j

UNION ALL

SELECT 'B · NAO_APLICAVEL AO ALCANCE DA VARREDURA' AS bloco,
       2 AS ord,
       c.nome_completo AS origem,
       jsonb_build_object(
         'servico',        p.servico_nome,
         'exigencia',      pd.tipo_documento,
         'status_slot',    pd.status,
         'condicao_prof',  p.condicao_profissional,
         'doc_status',     dc.status,
         'doc_validade',   dc.data_validade,
         'venceria_em',    dc.data_validade - CURRENT_DATE,
         'processo_aberto', public.qa_processo_em_aberto(p.status)
       ) AS dados
  FROM public.qa_processo_documentos pd
  JOIN public.qa_processos p  ON p.id = pd.processo_id
  JOIN public.qa_clientes   c ON c.id = p.cliente_id
  JOIN public.qa_documentos_cliente dc
    ON dc.arquivo_storage_path = pd.arquivo_storage_key
 WHERE pd.status = 'nao_aplicavel'
   AND pd.arquivo_storage_key IS NOT NULL

 ORDER BY ord, origem;
