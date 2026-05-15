-- FIX: trg_qa_log_status_change estava em BEFORE INSERT, o que fazia o
-- INSERT em qa_solicitacao_eventos (FK -> qa_solicitacoes_servico.id) falhar
-- porque a linha ainda não existia. Reposicionar como AFTER.
DROP TRIGGER IF EXISTS trg_qa_log_status_change ON public.qa_solicitacoes_servico;

CREATE OR REPLACE FUNCTION public.qa_log_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.qa_solicitacao_eventos
      (solicitacao_id, cliente_id, evento, status_novo, descricao, ator)
    VALUES
      (NEW.id, NEW.cliente_id, 'solicitacao_criada', NEW.status_servico,
       'Solicitação criada com status ' || NEW.status_servico, 'sistema');
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status_servico IS DISTINCT FROM OLD.status_servico THEN
    INSERT INTO public.qa_solicitacao_eventos
      (solicitacao_id, cliente_id, evento, status_anterior, status_novo, descricao, ator)
    VALUES
      (NEW.id, NEW.cliente_id, 'status_alterado',
       OLD.status_servico, NEW.status_servico,
       'Status alterado de ' || OLD.status_servico || ' para ' || NEW.status_servico,
       'sistema');
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_qa_log_status_change
AFTER INSERT OR UPDATE ON public.qa_solicitacoes_servico
FOR EACH ROW EXECUTE FUNCTION public.qa_log_status_change();