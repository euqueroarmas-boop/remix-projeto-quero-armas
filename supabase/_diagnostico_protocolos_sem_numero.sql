-- ============================================================================
-- DIAGNÓSTICO — protocolos sem número (18/08/2026)
-- ----------------------------------------------------------------------------
-- O panorama pós-backfill mostrou 4 processos passados do protocolo sem número:
-- os 3 deferidos e 1 dos 3 protocolados. Estas duas consultas separam as duas
-- causas possíveis:
--   (1) o backfill deixou passar algo que estava no JSON; ou
--   (2) o número nunca foi capturado — o processo foi marcado pelo seletor
--       livre de status, que gravava direto e pulava o modal.
-- ============================================================================

-- (1) SOBRA DO BACKFILL: tem número no JSON e não tem na coluna?
--     Esperado: 0 linhas. Qualquer linha aqui é bug do backfill.
SELECT id,
       respostas_questionario_json #>> '{protocolo,numero_protocolo}' AS json_numero_protocolo,
       respostas_questionario_json #>> '{protocolo,numero}'           AS json_numero,
       protocolo_numero                                               AS coluna
  FROM public.qa_processos
 WHERE COALESCE(
         NULLIF(btrim(respostas_questionario_json #>> '{protocolo,numero_protocolo}'), ''),
         NULLIF(btrim(respostas_questionario_json #>> '{protocolo,numero}'), '')
       ) IS NOT NULL
   AND protocolo_numero IS NULL;

-- (2) QUEM SÃO OS 4, e o que existe de rastro deles.
--     `tem_chave_protocolo_no_json` = false significa que nunca passou pelo
--     modal "MARCAR COMO PROTOCOLADO": o status foi gravado pelo seletor livre.
SELECT p.id,
       c.nome_completo,
       c.cpf,
       p.servico_nome,
       p.status,
       p.protocolo_numero,
       p.protocolo_data,
       p.protocolo_orgao,
       (p.respostas_questionario_json ? 'protocolo') AS tem_chave_protocolo_no_json,
       p.respostas_questionario_json #> '{protocolo}' AS protocolo_json_bruto,
       p.data_criacao,
       p.updated_at,
       (SELECT max(e.created_at)
          FROM public.qa_processo_eventos e
         WHERE e.processo_id = p.id
           AND e.tipo_evento = 'processo_protocolado')  AS evento_protocolado_em
  FROM public.qa_processos p
  LEFT JOIN public.qa_clientes c ON c.id = p.cliente_id
 WHERE p.status IN ('protocolado','em_analise_orgao','notificado',
                    'recurso_administrativo','deferido','indeferido')
   AND p.protocolo_numero IS NULL
 ORDER BY p.updated_at DESC;
