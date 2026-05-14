-- FASE 2C-6 — Desativar liberação automática de processo/checklist após validação.
-- Phase 2C-6 deixa serviço apenas APTO; criação de qa_solicitacoes_servico fica para 2C-7.
DROP TRIGGER IF EXISTS qa_contracts_after_validated ON public.qa_contracts;

-- Mantém função existente (não destrutivo), mas adiciona stub seguro: registra evento e retorna.
CREATE OR REPLACE FUNCTION public.qa_contracts_after_validated_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'validated' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'validated') THEN
    INSERT INTO public.qa_contract_events (contract_id, event_type, event_payload)
    VALUES (NEW.id, 'contrato_assinado_apto_para_liberacao',
            jsonb_build_object('fase', '2C-6', 'observacao', 'liberacao_operacional_aguarda_fase_2C-7'));
  END IF;
  RETURN NEW;
END;
$function$;

-- Recria trigger (apenas registra evento, não cria processo).
CREATE TRIGGER qa_contracts_after_validated
AFTER UPDATE OF status ON public.qa_contracts
FOR EACH ROW
EXECUTE FUNCTION public.qa_contracts_after_validated_release();