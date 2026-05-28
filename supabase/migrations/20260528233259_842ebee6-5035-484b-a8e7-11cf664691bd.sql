
-- RECHECK SIMULACAO_QA_RECHECK_20260528: reset state to validate checker fix
-- without manual dispensado_grupo workaround on PIVOT_NAO.

-- PIVOT_NAO (4f59cfc5): reverter habitualidade para 'pendente' (estado natural,
-- sem workaround) e permitir re-promoção.
UPDATE qa_processo_documentos
   SET status = 'pendente'
 WHERE id = 'ec29d149-f2f1-4b5c-b556-06a4c88231ce';

UPDATE qa_processos
   SET status = 'aguardando_documentos',
       respostas_questionario_json = jsonb_set(
         COALESCE(respostas_questionario_json, '{}'::jsonb),
         '{notificacoes}',
         COALESCE(respostas_questionario_json->'notificacoes', '{}'::jsonb)
         - 'pronto_para_protocolar_enviado_em'
         - 'pronto_para_protocolar_origem'
       )
 WHERE id = '4f59cfc5-643c-432a-8235-fae85d27a686';

-- PIVOT_SIM (f46095f8): reverter status macro para re-promovível. Habitualidade
-- permanece 'aprovado' → deve promover normalmente.
UPDATE qa_processos
   SET status = 'aguardando_documentos',
       respostas_questionario_json = jsonb_set(
         COALESCE(respostas_questionario_json, '{}'::jsonb),
         '{notificacoes}',
         COALESCE(respostas_questionario_json->'notificacoes', '{}'::jsonb)
         - 'pronto_para_protocolar_enviado_em'
         - 'pronto_para_protocolar_origem'
       )
 WHERE id = 'f46095f8-196b-4e59-a4f9-a3f2513a1525';

INSERT INTO qa_processo_eventos (processo_id, tipo_evento, descricao, ator, dados_json)
VALUES
 ('4f59cfc5-643c-432a-8235-fae85d27a686','recheck_setup','RESET PARA RECHECK — HABITUALIDADE VOLTOU A PENDENTE','sistema_auto','{"tag":"SIMULACAO_QA_RECHECK_20260528","cenario":"PIVOT_NAO"}'),
 ('f46095f8-196b-4e59-a4f9-a3f2513a1525','recheck_setup','RESET PARA RECHECK — STATUS MACRO REVERTIDO','sistema_auto','{"tag":"SIMULACAO_QA_RECHECK_20260528","cenario":"PIVOT_SIM"}');
