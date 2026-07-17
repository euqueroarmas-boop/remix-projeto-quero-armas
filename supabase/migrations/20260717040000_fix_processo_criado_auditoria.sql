-- Correção 4: enriquece o trigger de auditoria de criação de processos
--
-- Problema: o evento 'processo_criado' em qa_processo_eventos só gravava
-- {status, servico_id}. Quando um processo nasce com pagamento_status='confirmado'
-- (fora do fluxo canônico), não havia como detectar nem rastrear a origem.
--
-- Correção:
--   1. Acrescenta pagamento_status e venda_id ao dados_json do evento normal.
--   2. Quando um processo nasce com pagamento_status='confirmado', emite também
--      'processo_criado_estado_suspeito' para visibilidade imediata no painel.
--      Este estado indica que alguma rota criou o processo pré-confirmado, o que
--      pode bloquear a explosão do checklist se a guarda de idempotência for ativada.

CREATE OR REPLACE FUNCTION public.qa_processos_log_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator, user_id)
    VALUES (
      NEW.id,
      'processo_criado',
      'Processo criado com status=' || NEW.status || ' pagamento=' || COALESCE(NEW.pagamento_status, '?'),
      jsonb_build_object(
        'status',            NEW.status,
        'pagamento_status',  NEW.pagamento_status,
        'servico_id',        NEW.servico_id,
        'venda_id',          NEW.venda_id,
        'auth_uid',          auth.uid()
      ),
      CASE WHEN auth.uid() IS NULL THEN 'sistema' ELSE 'usuario' END,
      auth.uid()
    );

    -- Alerta: processo nasceu com pagamento já confirmado fora do fluxo canônico.
    -- O fluxo correto é: aguardando → (webhook/confirmar) → confirmado.
    -- Se nasceu confirmado diretamente, é provável que uma rota inespecífica fez
    -- o UPDATE sem passar pela RPC, o que pode bloquear a explosão do checklist.
    IF NEW.pagamento_status = 'confirmado' THEN
      INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
      VALUES (
        NEW.id,
        'processo_criado_estado_suspeito',
        'ATENÇÃO: processo criado já com pagamento_status=confirmado. '
          || 'Origem desconhecida — checklist pode não ser explodido automaticamente. '
          || 'Verifique e execute qa_explodir_checklist_processo se necessário.',
        jsonb_build_object(
          'status',           NEW.status,
          'pagamento_status', NEW.pagamento_status,
          'servico_id',       NEW.servico_id,
          'venda_id',         NEW.venda_id,
          'auth_uid',         auth.uid()
        ),
        'sistema'
      );
    END IF;

  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator, user_id)
    VALUES (
      NEW.id,
      'status_alterado',
      'Status: ' || OLD.status || ' → ' || NEW.status,
      jsonb_build_object(
        'de',               OLD.status,
        'para',             NEW.status,
        'pagamento_status', NEW.pagamento_status,
        'venda_id',         NEW.venda_id,
        'auth_uid',         auth.uid()
      ),
      CASE WHEN auth.uid() IS NULL THEN 'sistema' ELSE 'usuario' END,
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Recria o trigger (mantém AFTER INSERT OR UPDATE, mesma semântica)
DROP TRIGGER IF EXISTS trg_qa_processos_log_status ON public.qa_processos;
CREATE TRIGGER trg_qa_processos_log_status
  AFTER INSERT OR UPDATE ON public.qa_processos
  FOR EACH ROW EXECUTE FUNCTION public.qa_processos_log_status_change();
