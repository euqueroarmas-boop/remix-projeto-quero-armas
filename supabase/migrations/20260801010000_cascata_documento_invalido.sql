-- =============================================================================
-- Cascata: documento que deixa de valer reabre a exigência do processo
--
-- Complementa a trigger de remoção (20260801000000). Três causas, mesma
-- consequência — o cliente precisa entregar de novo:
--
--   1. REMOVIDO   → trigger AFTER DELETE (já existe)
--   2. REPROVADO  → trigger desta migration, reage na hora
--   3. VENCIDO    → função desta migration, varredura diária
--
-- Regra do usuário (31/07/2026): "Se vencer, deve ser atualizado. Se for
-- indeferido, deve ser atualizado."
--
-- ── A armadilha evitada ──────────────────────────────────────────────────
--
-- A forma óbvia seria varrer slots 'aprovado' sem documento correspondente no
-- acervo. Não serve: documento enviado DIRETO no processo (pelo checklist
-- guiado) grava um caminho do bucket do processo, e nunca teve linha em
-- `qa_documentos_cliente`. Uma varredura assim reabriria todos eles.
--
-- Por isso aqui só se reabre quando a linha do acervo EXISTE e está inválida —
-- reprovada ou vencida. O caso "sumiu" continua sendo tratado pela trigger de
-- DELETE, que sabe exatamente qual arquivo foi apagado.
-- =============================================================================

BEGIN;

-- Estados em que o processo ainda depende do cliente. Depois de protocolado o
-- documento já foi ao órgão, e reabrir no checklist sugeriria ao cliente que
-- ele ainda pode resolver algo que saiu das nossas mãos.
CREATE OR REPLACE FUNCTION public.qa_processo_em_aberto(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(p_status, '') IN (
    'aguardando_pagamento',
    'pagamento_confirmado',
    'aguardando_documentos',
    'em_analise_interna',
    'aguardando_assinatura',
    'pronto_para_protocolar'
  );
$$;

-- ─── Varredura: reabre o que está sustentado por documento inválido ──────
-- Devolve quantas exigências foram reabertas. Idempotente: rodar duas vezes
-- seguidas não muda nada na segunda.
CREATE OR REPLACE FUNCTION public.qa_reabrir_exigencias_documento_invalido()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_total integer := 0;
BEGIN
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
      FROM public.qa_processos p,
           public.qa_documentos_cliente dc
     WHERE p.id = pd.processo_id
       AND dc.arquivo_storage_path = pd.arquivo_storage_key
       AND pd.status <> 'pendente'
       AND public.qa_processo_em_aberto(p.status)
       AND (
         dc.status <> 'aprovado'
         OR (dc.data_validade IS NOT NULL AND dc.data_validade < CURRENT_DATE)
       )
    RETURNING pd.processo_id, pd.id AS slot_id, pd.nome_documento,
              dc.status AS doc_status, dc.data_validade AS doc_validade
  )
  INSERT INTO public.qa_processo_eventos (processo_id, documento_id, tipo_evento, descricao, dados_json, ator)
  SELECT r.processo_id,
         r.slot_id,
         'exigencia_reaberta_documento_invalido',
         CASE
           WHEN r.doc_validade IS NOT NULL AND r.doc_validade < CURRENT_DATE
             THEN 'O documento que cumpria "' || coalesce(r.nome_documento, 'esta exigência') ||
                  '" venceu em ' || to_char(r.doc_validade, 'DD/MM/YYYY') || '. A exigência voltou a ser cobrada.'
           ELSE 'O documento que cumpria "' || coalesce(r.nome_documento, 'esta exigência') ||
                '" deixou de ser válido. A exigência voltou a ser cobrada.'
         END,
         jsonb_build_object('doc_status', r.doc_status, 'doc_validade', r.doc_validade),
         'sistema'
    FROM reabertas r;

  GET DIAGNOSTICS v_total = ROW_COUNT;
  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.qa_reabrir_exigencias_documento_invalido() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qa_reabrir_exigencias_documento_invalido() TO service_role;

-- ─── Reação imediata: documento sai de 'aprovado' ────────────────────────
-- Sem isto, a exigência só reabriria na varredura seguinte, e nesse meio-tempo
-- o processo aparece completo com um documento reprovado por trás.
CREATE OR REPLACE FUNCTION public.qa_doc_invalidado_reabre_exigencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'aprovado' AND NEW.status <> 'aprovado' THEN
    PERFORM public.qa_reabrir_exigencias_documento_invalido();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_doc_invalidado_reabre ON public.qa_documentos_cliente;
CREATE TRIGGER trg_qa_doc_invalidado_reabre
  AFTER UPDATE OF status ON public.qa_documentos_cliente
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_doc_invalidado_reabre_exigencia();

-- Passada inicial: pega o que já está vencido ou reprovado hoje.
SELECT public.qa_reabrir_exigencias_documento_invalido();

COMMIT;
