CREATE OR REPLACE FUNCTION public.qa_validar_transicao_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_old text := OLD.status_servico;
  v_new text := NEW.status_servico;
  v_allowed text[];
BEGIN
  IF v_old IS NOT DISTINCT FROM v_new THEN RETURN NEW; END IF;

  -- Bypass para transições orquestradas pelo sistema
  IF current_setting('qa.bypass_transicao', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- Bloqueio absoluto: sem checklist configurado, status só pode ser
  -- 'aguardando_documentacao' (ou 'finalizado' administrativo).
  IF COALESCE(NEW.sem_checklist_configurado, false) = true
     AND v_new NOT IN ('aguardando_documentacao','finalizado') THEN
    RAISE EXCEPTION
      'Status bloqueado: configure o checklist de documentos do serviço antes de avançar (atual: %, tentado: %).',
      v_old, v_new
      USING ERRCODE = 'check_violation';
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