CREATE OR REPLACE FUNCTION public.qa_validar_transicao_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_old text := OLD.status_servico;
  v_new text := NEW.status_servico;
  v_allowed text[];
BEGIN
  IF v_old IS NOT DISTINCT FROM v_new THEN RETURN NEW; END IF;

  IF current_setting('qa.bypass_transicao', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF v_new = 'finalizado' THEN RETURN NEW; END IF;
  IF v_old IS NULL THEN RETURN NEW; END IF;

  v_allowed := CASE v_old
    WHEN 'montando_pasta'           THEN ARRAY['aguardando_documentacao']
    WHEN 'aguardando_documentacao'  THEN ARRAY['em_verificacao']
    WHEN 'em_verificacao'           THEN ARRAY['pronto_para_protocolo','aguardando_documentacao']
    WHEN 'pronto_para_protocolo'    THEN ARRAY['enviado_ao_orgao','em_verificacao']
    WHEN 'enviado_ao_orgao'         THEN ARRAY['em_analise_orgao','notificado','restituido','recurso_administrativo','deferido','indeferido']
    WHEN 'em_analise_orgao'         THEN ARRAY['notificado','restituido','recurso_administrativo','deferido','indeferido']
    WHEN 'notificado'               THEN ARRAY['em_analise_orgao','restituido','recurso_administrativo','deferido','indeferido']
    WHEN 'restituido'               THEN ARRAY['em_analise_orgao','recurso_administrativo','deferido','indeferido']
    WHEN 'recurso_administrativo'   THEN ARRAY['em_analise_orgao','deferido','indeferido']
    WHEN 'deferido'                 THEN ARRAY['finalizado']
    WHEN 'indeferido'               THEN ARRAY['recurso_administrativo','finalizado']
    WHEN 'finalizado'               THEN ARRAY[]::text[]
    ELSE ARRAY[]::text[]
  END;

  IF NOT (v_new = ANY(v_allowed)) THEN
    RAISE EXCEPTION
      'Transição de status inválida: % → %. Permitidas a partir de "%": %',
      v_old, v_new, v_old,
      COALESCE(array_to_string(v_allowed, ', '), '(nenhuma)')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_validar_transicao_status ON public.qa_solicitacoes_servico;
CREATE TRIGGER trg_qa_validar_transicao_status
BEFORE UPDATE OF status_servico ON public.qa_solicitacoes_servico
FOR EACH ROW
EXECUTE FUNCTION public.qa_validar_transicao_status();

-- Recria a recalculadora com bypass do trigger
DROP FUNCTION IF EXISTS public.qa_recalcular_status_servico(uuid);

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
    IF v_prog.documentos_total = 0 THEN
      v_novo := 'aguardando_documentacao';
    ELSIF v_prog.documentos_validos >= v_prog.documentos_total THEN
      v_novo := 'pronto_para_protocolo';
    ELSIF v_prog.documentos_recebidos >= v_prog.documentos_total THEN
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