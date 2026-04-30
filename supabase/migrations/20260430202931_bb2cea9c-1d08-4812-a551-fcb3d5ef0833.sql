-- Endpoint REST do projeto para inserts autônomos via pg_net
-- (escapa da transação corrente para sobreviver ao RAISE EXCEPTION).
CREATE OR REPLACE FUNCTION public.qa_log_tentativa_bloqueada(
  _solicitacao_id uuid,
  _cliente_id integer,
  _status_anterior text,
  _status_tentado text,
  _motivo text,
  _ator text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  -- Tenta config local; se ausente, usa fallback do projeto.
  v_url := current_setting('app.supabase_url', true);
  v_key := current_setting('app.service_role_key', true);
  IF v_url IS NULL OR v_url = '' THEN
    v_url := 'https://ogkltfqvzweeqkfmrzts.supabase.co';
  END IF;

  -- Sem service_role_key configurada, faz fallback para INSERT direto
  -- (ainda será desfeito pelo RAISE, mas garantimos o "best effort").
  IF v_key IS NULL OR v_key = '' THEN
    BEGIN
      INSERT INTO public.qa_solicitacao_eventos
        (solicitacao_id, cliente_id, evento, status_anterior, descricao, ator, metadata)
      VALUES
        (_solicitacao_id, _cliente_id, 'tentativa_status_bloqueada',
         _status_anterior,
         'Tentativa de alterar status sem checklist configurado',
         COALESCE(_ator, 'sistema'),
         jsonb_build_object(
           'status_tentado', _status_tentado,
           'motivo', _motivo
         ));
    EXCEPTION WHEN OTHERS THEN
      -- nunca propaga erro daqui
      NULL;
    END;
    RETURN;
  END IF;

  -- pg_net enfileira a chamada HTTP em uma transação autônoma:
  -- sobrevive ao rollback do trigger pai.
  PERFORM net.http_post(
    url := v_url || '/rest/v1/qa_solicitacao_eventos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_key,
      'Authorization', 'Bearer ' || v_key,
      'Prefer', 'return=minimal'
    ),
    body := jsonb_build_object(
      'solicitacao_id', _solicitacao_id,
      'cliente_id', _cliente_id,
      'evento', 'tentativa_status_bloqueada',
      'status_anterior', _status_anterior,
      'descricao', 'Tentativa de alterar status sem checklist configurado',
      'ator', COALESCE(_ator, 'sistema'),
      'metadata', jsonb_build_object(
        'status_tentado', _status_tentado,
        'motivo', _motivo
      )
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- nunca propaga
  NULL;
END;
$$;

-- Atualiza a função de validação para registrar a tentativa antes do RAISE.
CREATE OR REPLACE FUNCTION public.qa_validar_transicao_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_old text := OLD.status_servico;
  v_new text := NEW.status_servico;
  v_allowed text[];
  v_ator text;
  v_jwt jsonb;
BEGIN
  IF v_old IS NOT DISTINCT FROM v_new THEN RETURN NEW; END IF;

  IF current_setting('qa.bypass_transicao', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- Resolve ator a partir do JWT (email) quando disponível
  BEGIN
    v_jwt := current_setting('request.jwt.claims', true)::jsonb;
    v_ator := COALESCE(v_jwt->>'email', v_jwt->>'sub', 'operador');
  EXCEPTION WHEN OTHERS THEN
    v_ator := 'operador';
  END;

  -- Bloqueio absoluto: sem checklist configurado
  IF COALESCE(NEW.sem_checklist_configurado, false) = true
     AND v_new NOT IN ('aguardando_documentacao','finalizado') THEN
    PERFORM public.qa_log_tentativa_bloqueada(
      NEW.id,
      NEW.cliente_id,
      v_old,
      v_new,
      'sem_checklist_configurado',
      v_ator
    );
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