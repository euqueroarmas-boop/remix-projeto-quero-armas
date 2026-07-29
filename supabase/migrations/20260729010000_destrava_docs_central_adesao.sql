-- Destrava clientes cujos documentos da Central de Adesão nunca cumpriram
-- exigência do checklist.
--
-- Causa: Etapa4Salvar gravava os documentos com status 'pendente_aprovacao',
-- mas a trigger qa_doc_hub_satisfaz_exigencias_processo() só age sobre
-- status = 'aprovado'. Resultado: o slot em qa_processo_documentos ficava
-- 'pendente' para sempre, o checklist cobrava o documento de novo, e a trava
-- de duplicidade impedia o reenvio — cliente travado sem saída.
--
-- Escopo deliberadamente estreito: só documentos marcados como vindos da
-- Central de Adesão (ia_dados_extraidos->>'origem' = 'central_adesao'), que
-- foram conferidos e classificados pela equipe no momento do cadastro.
-- Documentos enviados pelo próprio cliente continuam exigindo aprovação
-- humana — esta migration não os toca.

BEGIN;

-- 1) Aprova os documentos da Central de Adesão que ficaram presos em
--    'pendente_aprovacao'. O UPDATE dispara a trigger por linha, que já
--    casa cada documento com os slots do processo (inclusive por apelido).
UPDATE public.qa_documentos_cliente
SET status = 'aprovado',
    validado_admin = true,
    aprovado_em = COALESCE(aprovado_em, now())
WHERE status = 'pendente_aprovacao'
  AND origem = 'admin'
  AND ia_dados_extraidos->>'origem' = 'central_adesao'
  AND status <> 'excluido';

-- 2) Varredura de segurança: reavalia TODAS as exigências pendentes contra os
--    documentos válidos do Hub. Cobre casos que a trigger não pegou — por
--    exemplo processos abertos DEPOIS de o documento já estar aprovado, em que
--    a trigger nunca teve chance de rodar para aquele slot.
SELECT public.qa_processo_rever_exigencias(NULL);

COMMIT;
