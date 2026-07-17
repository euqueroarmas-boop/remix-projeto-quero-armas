CREATE OR REPLACE FUNCTION public.qa_recalcular_status_servico(_solicitacao_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sol record;
  v_prog record;
  v_sem boolean;
  v_novo text;
  v_atual text;
BEGIN
  SELECT id, servico_id, status_servico, sem_checklist_configurado
    INTO v_sol
    FROM public.qa_solicitacoes_servico
   WHERE id = _solicitacao_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_atual := v_sol.status_servico;

  IF v_atual IN ('enviado_ao_orgao','em_analise_orgao','notificado','restituido',
                 'recurso_administrativo','deferido','indeferido','finalizado') THEN
    RETURN;
  END IF;

  v_sem := COALESCE(v_sol.sem_checklist_configurado, false);

  IF v_sem THEN
    v_novo := 'aguardando_documentacao';
  ELSE
    SELECT * INTO v_prog FROM public.qa_calcular_progresso(_solicitacao_id);
    IF COALESCE(v_prog.y, 0) = 0 OR COALESCE(v_prog.sem_checklist, true) THEN
      v_novo := 'aguardando_documentacao';
    ELSIF v_prog.x_valido >= v_prog.y THEN
      v_novo := 'pronto_para_protocolo';
    ELSIF v_prog.x_progresso >= v_prog.y THEN
      v_novo := 'em_verificacao';
    ELSE
      v_novo := 'aguardando_documentacao';
    END IF;
  END IF;

  IF v_novo IS DISTINCT FROM v_atual THEN
    PERFORM set_config('qa.bypass_transicao', 'on', true);
    UPDATE public.qa_solicitacoes_servico
       SET status_servico = v_novo,
           updated_at = now()
     WHERE id = _solicitacao_id;
    PERFORM set_config('qa.bypass_transicao', 'off', true);
  END IF;
END;
$$;