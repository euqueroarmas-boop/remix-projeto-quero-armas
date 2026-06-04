
UPDATE qa_processo_documentos
   SET status = 'aprovado'
 WHERE processo_id IN ('4f59cfc5-643c-432a-8235-fae85d27a686','f46095f8-196b-4e59-a4f9-a3f2513a1525')
   AND tipo_documento = 'pergunta_comprovante_em_nome';

-- Garante que o pergunta_anexar_habitualidade_cac seja contado via respostas
-- (sem dispensado_grupo artificial). Voltamos para 'aprovado' (status neutro)
-- — o checker olha respostas[chave].
UPDATE qa_processo_documentos
   SET status = 'aprovado'
 WHERE processo_id IN ('4f59cfc5-643c-432a-8235-fae85d27a686','f46095f8-196b-4e59-a4f9-a3f2513a1525')
   AND tipo_documento = 'pergunta_anexar_habitualidade_cac';
