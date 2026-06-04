-- =========================================================================
-- 1) View: catálogo canônico de documentos obrigatórios por serviço
-- =========================================================================
CREATE OR REPLACE VIEW public.qa_servico_documentos_obrigatorios AS
SELECT
  sd.id,
  sd.servico_id,
  sd.tipo_documento,
  sd.nome_documento,
  sd.etapa,
  sd.obrigatorio,
  sd.condicao_profissional,
  sd.ordem,
  sd.ativo
FROM public.qa_servicos_documentos sd
WHERE sd.ativo = true AND sd.obrigatorio = true;

GRANT SELECT ON public.qa_servico_documentos_obrigatorios TO authenticated, anon;

-- =========================================================================
-- 2) Coluna sem_checklist_configurado e remoção de documentos_total
-- =========================================================================
ALTER TABLE public.qa_solicitacoes_servico
  ADD COLUMN IF NOT EXISTS sem_checklist_configurado boolean NOT NULL DEFAULT false;

ALTER TABLE public.qa_solicitacoes_servico
  DROP COLUMN IF EXISTS documentos_total;

-- =========================================================================
-- 3) RPC: calcular progresso (X_progresso, X_valido, Y, sem_checklist)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.qa_calcular_progresso(_solicitacao_id uuid)
RETURNS TABLE (
  x_progresso integer,
  x_valido    integer,
  y           integer,
  sem_checklist boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_servico_id integer;
  v_cliente_id integer;
BEGIN
  SELECT s.servico_id, s.cliente_id
    INTO v_servico_id, v_cliente_id
  FROM public.qa_solicitacoes_servico s
  WHERE s.id = _solicitacao_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 0, 0, true;
    RETURN;
  END IF;

  -- Y = total de tipos obrigatórios para o serviço
  SELECT COUNT(*)::int
    INTO y
  FROM public.qa_servico_documentos_obrigatorios
  WHERE servico_id = v_servico_id;

  sem_checklist := (y = 0);

  -- X_progresso = tipos distintos com algum documento recebido/aprovado (não reprovado)
  -- X_valido    = tipos distintos com algum documento aprovado
  IF v_cliente_id IS NULL OR sem_checklist THEN
    x_progresso := 0;
    x_valido := 0;
  ELSE
    SELECT
      COUNT(DISTINCT dc.tipo_documento) FILTER (
        WHERE dc.status IN ('pendente_aprovacao','recebido','aprovado')
      )::int,
      COUNT(DISTINCT dc.tipo_documento) FILTER (
        WHERE dc.status = 'aprovado'
      )::int
      INTO x_progresso, x_valido
    FROM public.qa_documentos_cliente dc
    WHERE dc.qa_cliente_id = v_cliente_id
      AND dc.tipo_documento IN (
        SELECT tipo_documento
        FROM public.qa_servico_documentos_obrigatorios
        WHERE servico_id = v_servico_id
      );
  END IF;

  RETURN QUERY SELECT x_progresso, x_valido, y, sem_checklist;
END;
$$;

GRANT EXECUTE ON FUNCTION public.qa_calcular_progresso(uuid) TO authenticated, service_role;

-- =========================================================================
-- 4) RPC: recalcular status com base no progresso (auto-avanço backend)
--    Aplica as regras:
--      - sem_checklist => não avança
--      - X_prog < Y    => aguardando_documentacao
--      - X_prog == Y   => em_verificacao
--      - X_valido == Y => pronto_para_protocolo
--    Não regride status que já passaram do órgão (enviado_ao_orgao+).
-- =========================================================================
CREATE OR REPLACE FUNCTION public.qa_recalcular_status_servico(_solicitacao_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status_atual text;
  v_x_prog int; v_x_val int; v_y int; v_sem boolean;
  v_novo text;
  v_status_orgao text[] := ARRAY[
    'enviado_ao_orgao','em_analise_orgao','notificado','restituido',
    'recurso_administrativo','deferido','indeferido','finalizado'
  ];
BEGIN
  SELECT status_servico INTO v_status_atual
  FROM public.qa_solicitacoes_servico
  WHERE id = _solicitacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Não mexe em estados sob responsabilidade do órgão / terminais
  IF v_status_atual = ANY(v_status_orgao) THEN
    RETURN v_status_atual;
  END IF;

  SELECT x_progresso, x_valido, y, sem_checklist
    INTO v_x_prog, v_x_val, v_y, v_sem
  FROM public.qa_calcular_progresso(_solicitacao_id);

  -- Mantém solicitacao marcada
  UPDATE public.qa_solicitacoes_servico
     SET sem_checklist_configurado = v_sem
   WHERE id = _solicitacao_id
     AND sem_checklist_configurado IS DISTINCT FROM v_sem;

  IF v_sem THEN
    RETURN v_status_atual; -- não decide nada
  END IF;

  IF v_y > 0 AND v_x_val = v_y THEN
    v_novo := 'pronto_para_protocolo';
  ELSIF v_y > 0 AND v_x_prog = v_y THEN
    v_novo := 'em_verificacao';
  ELSE
    v_novo := 'aguardando_documentacao';
  END IF;

  IF v_novo IS DISTINCT FROM v_status_atual THEN
    UPDATE public.qa_solicitacoes_servico
       SET status_servico = v_novo
     WHERE id = _solicitacao_id;

    -- Eventos auxiliares específicos quando completa documentação
    IF v_novo = 'em_verificacao' THEN
      INSERT INTO public.qa_solicitacao_eventos
        (solicitacao_id, evento, status_novo, descricao, ator, metadata)
      VALUES
        (_solicitacao_id, 'todos_documentos_recebidos', v_novo,
         'Todos os documentos obrigatórios foram recebidos.', 'sistema',
         jsonb_build_object('x_progresso', v_x_prog, 'x_valido', v_x_val, 'y', v_y));
    END IF;
  END IF;

  RETURN v_novo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.qa_recalcular_status_servico(uuid) TO authenticated, service_role;

-- =========================================================================
-- 5) Trigger em qa_documentos_cliente -> recalcula status de TODAS as
--    solicitações ativas do cliente que dependem do tipo_documento alterado.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.qa_doc_cliente_recalcular()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id int;
  v_tipo text;
  r record;
BEGIN
  v_cliente_id := COALESCE(NEW.qa_cliente_id, OLD.qa_cliente_id);
  v_tipo := COALESCE(NEW.tipo_documento, OLD.tipo_documento);

  IF v_cliente_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Loga recebimento (apenas em INSERT) — útil para auditoria/notificação
  IF TG_OP = 'INSERT' THEN
    FOR r IN
      SELECT s.id
        FROM public.qa_solicitacoes_servico s
       WHERE s.cliente_id = v_cliente_id
         AND s.status_servico NOT IN (
           'enviado_ao_orgao','em_analise_orgao','notificado','restituido',
           'recurso_administrativo','deferido','indeferido','finalizado'
         )
         AND EXISTS (
           SELECT 1 FROM public.qa_servico_documentos_obrigatorios o
            WHERE o.servico_id = s.servico_id AND o.tipo_documento = v_tipo
         )
    LOOP
      INSERT INTO public.qa_solicitacao_eventos
        (solicitacao_id, cliente_id, evento, descricao, ator, metadata)
      VALUES
        (r.id, NULL, 'documento_recebido',
         'Documento recebido: ' || v_tipo, 'sistema',
         jsonb_build_object('tipo_documento', v_tipo, 'arquivo_nome', NEW.arquivo_nome));
      PERFORM public.qa_recalcular_status_servico(r.id);
    END LOOP;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    FOR r IN
      SELECT s.id
        FROM public.qa_solicitacoes_servico s
       WHERE s.cliente_id = v_cliente_id
         AND EXISTS (
           SELECT 1 FROM public.qa_servico_documentos_obrigatorios o
            WHERE o.servico_id = s.servico_id AND o.tipo_documento = v_tipo
         )
    LOOP
      PERFORM public.qa_recalcular_status_servico(r.id);
    END LOOP;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_doc_cliente_recalcular ON public.qa_documentos_cliente;
CREATE TRIGGER trg_qa_doc_cliente_recalcular
AFTER INSERT OR UPDATE ON public.qa_documentos_cliente
FOR EACH ROW EXECUTE FUNCTION public.qa_doc_cliente_recalcular();

-- =========================================================================
-- 6) Notificação backend-driven via pg_net HTTP -> qa-notify-event
--    Mapeia status_servico para evento e dispara automaticamente.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.qa_dispatch_notify_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evento text;
  v_url text := 'https://ogkltfqvzweeqkfmrzts.supabase.co/functions/v1/qa-notify-event';
  v_anon text := current_setting('app.settings.anon_key', true);
  v_service text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_evento := CASE NEW.status_servico
      WHEN 'montando_pasta' THEN 'montando_pasta'
      ELSE NULL END;
  ELSIF TG_OP = 'UPDATE' AND NEW.status_servico IS DISTINCT FROM OLD.status_servico THEN
    v_evento := CASE NEW.status_servico
      WHEN 'montando_pasta'         THEN 'montando_pasta'
      WHEN 'em_verificacao'         THEN 'em_verificacao'
      WHEN 'pronto_para_protocolo'  THEN 'pronto_para_protocolo'
      WHEN 'enviado_ao_orgao'       THEN 'enviado_ao_orgao'
      WHEN 'em_analise_orgao'       THEN 'status_orgao'
      WHEN 'notificado'             THEN 'status_orgao'
      WHEN 'restituido'             THEN 'status_orgao'
      WHEN 'recurso_administrativo' THEN 'status_orgao'
      WHEN 'deferido'               THEN 'status_orgao'
      WHEN 'indeferido'             THEN 'status_orgao'
      ELSE NULL END;
  END IF;

  IF v_evento IS NULL THEN
    RETURN NEW;
  END IF;

  -- service role armazenado no Vault (se disponível); fallback usa anon
  BEGIN
    SELECT decrypted_secret INTO v_service
      FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_service := NULL;
  END;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_service, v_anon, '')
    ),
    body := jsonb_build_object(
      'evento', v_evento,
      'solicitacao_id', NEW.id,
      'status_novo', NEW.status_servico,
      'status_orgao', CASE WHEN v_evento = 'status_orgao' THEN NEW.status_servico ELSE NULL END
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_dispatch_notify ON public.qa_solicitacoes_servico;
CREATE TRIGGER trg_qa_dispatch_notify
AFTER INSERT OR UPDATE OF status_servico ON public.qa_solicitacoes_servico
FOR EACH ROW EXECUTE FUNCTION public.qa_dispatch_notify_event();
