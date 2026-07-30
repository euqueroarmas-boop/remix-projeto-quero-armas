-- Elimina — e impede — a duplicação de procuração e contrato assinados no Hub.
--
-- Causa: qa-upload-signed-procuracao e qa-upload-signed-contract permitem
-- reenvio de propósito (o status customer_signature_uploaded está na lista de
-- `allowed`, para o cliente poder corrigir um PDF errado). O storage usa
-- upsert e a linha de qa_procuracoes/qa_contracts é sempre a mesma — mas o
-- espelho no Hub fazia INSERT cego. Cada reenvio criava um documento novo.
-- Um cliente que reenviou três vezes ficou com três "Procuração assinada"
-- em análise, todas apontando para o mesmo arquivo.
--
-- As edge functions passaram a atualizar o documento existente. Esta migration
-- limpa o que já duplicou e cria a trava no banco, para que um fluxo novo que
-- esqueça a verificação não consiga reintroduzir o problema.

BEGIN;

-- 1) Marca as duplicatas antigas como 'substituido', preservando a mais
--    recente de cada procuração/contrato. Nada é apagado: o histórico
--    continua auditável e o documento vigente é o último enviado.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY tipo_documento, metadados_documento_json->>'procuracao_id'
           ORDER BY created_at DESC
         ) AS rn
  FROM public.qa_documentos_cliente
  WHERE tipo_documento = 'procuracao_assinada'
    AND metadados_documento_json->>'procuracao_id' IS NOT NULL
    AND status NOT IN ('excluido', 'substituido')
)
UPDATE public.qa_documentos_cliente d
SET status = 'substituido'
FROM ranked r
WHERE d.id = r.id AND r.rn > 1;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY tipo_documento, metadados_documento_json->>'contract_id'
           ORDER BY created_at DESC
         ) AS rn
  FROM public.qa_documentos_cliente
  WHERE tipo_documento = 'contrato_assinado'
    AND metadados_documento_json->>'contract_id' IS NOT NULL
    AND status NOT IN ('excluido', 'substituido')
)
UPDATE public.qa_documentos_cliente d
SET status = 'substituido'
FROM ranked r
WHERE d.id = r.id AND r.rn > 1;

-- 2) Trava estrutural: no máximo um documento VIGENTE por procuração e por
--    contrato. Índice parcial — versões substituídas e excluídas ficam de
--    fora, então o histórico continua permitido.
CREATE UNIQUE INDEX IF NOT EXISTS qa_doc_procuracao_assinada_unica
  ON public.qa_documentos_cliente ((metadados_documento_json->>'procuracao_id'))
  WHERE tipo_documento = 'procuracao_assinada'
    AND metadados_documento_json->>'procuracao_id' IS NOT NULL
    AND status NOT IN ('excluido', 'substituido');

CREATE UNIQUE INDEX IF NOT EXISTS qa_doc_contrato_assinado_unico
  ON public.qa_documentos_cliente ((metadados_documento_json->>'contract_id'))
  WHERE tipo_documento = 'contrato_assinado'
    AND metadados_documento_json->>'contract_id' IS NOT NULL
    AND status NOT IN ('excluido', 'substituido');

COMMIT;
