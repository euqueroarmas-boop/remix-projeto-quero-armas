
UPDATE qa_processo_documentos
   SET status = 'pendente'
 WHERE id = 'ec29d149-f2f1-4b5c-b556-06a4c88231ce';

UPDATE qa_processos
   SET status = 'aguardando_documentos',
       respostas_questionario_json = jsonb_set(
         COALESCE(respostas_questionario_json, '{}'::jsonb),
         '{notificacoes}', '{}'::jsonb
       )
 WHERE id IN ('4f59cfc5-643c-432a-8235-fae85d27a686','f46095f8-196b-4e59-a4f9-a3f2513a1525');
