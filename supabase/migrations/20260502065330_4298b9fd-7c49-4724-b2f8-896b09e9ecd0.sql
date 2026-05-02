-- ============================================================
-- FIX: Perguntas condicionais não podem ser aprovadas sem resposta explícita
-- ============================================================

-- 1) BACKFILL — limpar status incorretos
-- Perguntas-pivot SEM resposta registrada no processo: voltar para 'pendente'
UPDATE public.qa_processo_documentos pd
SET status = 'pendente',
    observacoes = NULL,
    data_validacao = NULL
FROM public.qa_processos p
WHERE pd.processo_id = p.id
  AND pd.tipo_documento IN (
    'pergunta_comprovante_em_nome',
    'pergunta_ainda_reside_imovel',
    'pergunta_responde_inquerito_criminal'
  )
  AND pd.status IN ('aprovado','validado','dispensado_grupo')
  AND (
    p.respostas_questionario_json IS NULL
    OR NOT (
      p.respostas_questionario_json ? CASE pd.tipo_documento
        WHEN 'pergunta_comprovante_em_nome'         THEN 'comprovante_em_nome_titular'
        WHEN 'pergunta_ainda_reside_imovel'         THEN 'ainda_reside_imovel'
        WHEN 'pergunta_responde_inquerito_criminal' THEN 'responde_inquerito_criminal'
      END
    )
  );

-- Perguntas-pivot COM resposta real: usar 'dispensado_grupo' (cumprida sem ser doc aprovado)
UPDATE public.qa_processo_documentos pd
SET status = 'dispensado_grupo'
FROM public.qa_processos p
WHERE pd.processo_id = p.id
  AND pd.tipo_documento IN (
    'pergunta_comprovante_em_nome',
    'pergunta_ainda_reside_imovel',
    'pergunta_responde_inquerito_criminal'
  )
  AND pd.status = 'aprovado'
  AND p.respostas_questionario_json IS NOT NULL
  AND (p.respostas_questionario_json ? CASE pd.tipo_documento
        WHEN 'pergunta_comprovante_em_nome'         THEN 'comprovante_em_nome_titular'
        WHEN 'pergunta_ainda_reside_imovel'         THEN 'ainda_reside_imovel'
        WHEN 'pergunta_responde_inquerito_criminal' THEN 'responde_inquerito_criminal'
      END);

-- 2) TRIGGER GUARD — impede marcar pergunta como aprovada sem resposta real
CREATE OR REPLACE FUNCTION public.qa_guard_pergunta_sem_resposta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chave text;
  v_respostas jsonb;
BEGIN
  -- Só age em perguntas-pivot
  IF NEW.tipo_documento NOT IN (
    'pergunta_comprovante_em_nome',
    'pergunta_ainda_reside_imovel',
    'pergunta_responde_inquerito_criminal'
  ) THEN
    RETURN NEW;
  END IF;

  -- Status que não exigem prova de resposta
  IF NEW.status NOT IN ('aprovado','validado','dispensado_grupo') THEN
    RETURN NEW;
  END IF;

  v_chave := CASE NEW.tipo_documento
    WHEN 'pergunta_comprovante_em_nome'         THEN 'comprovante_em_nome_titular'
    WHEN 'pergunta_ainda_reside_imovel'         THEN 'ainda_reside_imovel'
    WHEN 'pergunta_responde_inquerito_criminal' THEN 'responde_inquerito_criminal'
  END;

  SELECT respostas_questionario_json INTO v_respostas
    FROM public.qa_processos
   WHERE id = NEW.processo_id;

  IF v_respostas IS NULL OR NOT (v_respostas ? v_chave) THEN
    RAISE EXCEPTION 'PERGUNTA_SEM_RESPOSTA: a pergunta % não pode ser marcada como cumprida sem resposta explícita do cliente em respostas_questionario_json[%]',
      NEW.tipo_documento, v_chave
      USING ERRCODE = 'check_violation';
  END IF;

  -- Nunca usar 'aprovado' / 'validado' para pergunta — força o estado correto
  IF NEW.status IN ('aprovado','validado') THEN
    NEW.status := 'dispensado_grupo';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qa_trg_guard_pergunta_resposta ON public.qa_processo_documentos;
CREATE TRIGGER qa_trg_guard_pergunta_resposta
BEFORE INSERT OR UPDATE OF status ON public.qa_processo_documentos
FOR EACH ROW
EXECUTE FUNCTION public.qa_guard_pergunta_sem_resposta();

-- 3) Recalcular processos afetados
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT processo_id
      FROM public.qa_processo_documentos
     WHERE tipo_documento IN (
       'pergunta_comprovante_em_nome',
       'pergunta_ainda_reside_imovel',
       'pergunta_responde_inquerito_criminal'
     )
  LOOP
    PERFORM public.qa_recalcular_prazos_processo(r.processo_id);
  END LOOP;
END$$;