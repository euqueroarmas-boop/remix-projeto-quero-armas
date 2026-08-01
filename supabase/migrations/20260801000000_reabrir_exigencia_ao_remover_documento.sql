-- =============================================================================
-- Documento removido do acervo reabre a exigência do processo
--
-- Sintoma relatado (usuário, 31/07/2026): removeu 6 certidões do acervo e o
-- checklist NÃO voltou a pedi-las. Pior: o contador de concluídos AUMENTOU,
-- porque as exigências continuaram marcadas como cumpridas.
--
-- Causa: o casamento documento × exigência é de mão única. Quando
-- `qa_processo_rever_exigencias` fecha um slot, ela grava
-- `arquivo_storage_key = documento.arquivo_storage_path`. Apagar a linha em
-- `qa_documentos_cliente` não toca em `qa_processo_documentos` — o slot fica
-- 'aprovado' apontando para um arquivo que não existe mais.
--
-- Na prática o processo seguiria para a PF com uma exigência dada por cumprida
-- e nenhum arquivo por trás dela.
--
-- O vínculo usado aqui é o `arquivo_storage_key`, e não o tipo do documento.
-- Por tipo, remover uma certidão reabriria exigências que outro documento do
-- mesmo tipo ainda cumpre. Pelo caminho do arquivo, reabre-se exatamente o que
-- aquele arquivo sustentava.
--
-- Só processos EM ABERTO são reabertos. Depois de protocolado, o documento já
-- foi ao órgão; reabrir a exigência no checklist do cliente sugeriria que ele
-- ainda pode resolver algo que já saiu das nossas mãos.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.qa_reabrir_exigencia_ao_remover_documento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.arquivo_storage_path IS NULL OR btrim(OLD.arquivo_storage_path) = '' THEN
    RETURN OLD;
  END IF;

  -- CTE com RETURNING: preciso saber EXATAMENTE quais slots foram reabertos
  -- para auditar só eles. Consultar depois por "pendente sem arquivo" pegaria
  -- todas as exigências pendentes do sistema.
  WITH reabertas AS (
    UPDATE public.qa_processo_documentos pd
       SET status               = 'pendente',
           arquivo_url          = NULL,
           arquivo_storage_key  = NULL,
           data_envio           = NULL,
           data_validacao       = NULL,
           dados_extraidos_json = NULL,
           motivo_rejeicao      = NULL,
           validacao_ia_status  = NULL,
           validacao_ia_erro    = NULL
      FROM public.qa_processos p
     WHERE p.id = pd.processo_id
       AND pd.arquivo_storage_key = OLD.arquivo_storage_path
       AND pd.status <> 'pendente'
       -- Só enquanto o processo está em aberto. Depois de protocolado o
       -- documento já foi ao órgão, e reabrir sugeriria ao cliente que ele
       -- ainda pode resolver algo que saiu das nossas mãos.
       AND p.status IN (
         'aguardando_pagamento',
         'pagamento_confirmado',
         'aguardando_documentos',
         'em_analise_interna',
         'aguardando_assinatura',
         'pronto_para_protocolar'
       )
    RETURNING pd.processo_id, pd.id AS documento_processo_id, pd.nome_documento
  )
  INSERT INTO public.qa_processo_eventos (processo_id, documento_id, tipo_evento, descricao, dados_json, ator)
  SELECT r.processo_id,
         r.documento_processo_id,
         'exigencia_reaberta_por_remocao',
         'Documento removido do acervo. A exigência "' || coalesce(r.nome_documento, 'documento') ||
           '" voltou a ser cobrada no checklist.',
         jsonb_build_object(
           'documento_cliente_id', OLD.id,
           'tipo_documento',       OLD.tipo_documento,
           'arquivo',              OLD.arquivo_nome,
           'storage_path',         OLD.arquivo_storage_path
         ),
         'sistema'
    FROM reabertas r;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_doc_removido_reabre_exigencia ON public.qa_documentos_cliente;
CREATE TRIGGER trg_qa_doc_removido_reabre_exigencia
  AFTER DELETE ON public.qa_documentos_cliente
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_reabrir_exigencia_ao_remover_documento();

COMMIT;
