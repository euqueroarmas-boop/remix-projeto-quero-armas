-- Motor: QAAdminNotifContrato
--
-- O contrato assinado nunca entrou na aba "Eventos de Documentos" porque essa
-- aba lê só public.qa_admin_notificacoes, e o contrato — por decisão de
-- arquitetura registrada em qa-upload-signed-contract — não vira linha em
-- qa_documentos_cliente nem em qa_processo_documentos, as duas únicas tabelas
-- com gatilho de notificação. O único registro vinha da edge function
-- notifyAdminUpload, que resolvia o cliente por CPF só-dígitos e nascia órfã
-- (cliente_id NULL) sempre que o cadastro guardava o CPF mascarado.
--
-- Este gatilho passa a ser a FONTE ÚNICA de eventos de contrato no histórico:
--   * resolve o cliente pela FK, sem depender de CPF;
--   * cobre os dois caminhos de upload (portal do cliente e staff-assistido),
--     porque ambos escrevem o mesmo status em qa_contracts;
--   * registra o ciclo inteiro — recebido, validado, rejeitado, revisão manual.
--
-- Por isso a chamada notifyAdminUpload({tipo:"contrato"}) foi removida de
-- qa-upload-signed-contract no mesmo commit: mantê-la duplicaria o evento
-- "recebido".

CREATE OR REPLACE FUNCTION public.qa_admin_notif_contrato()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _st text;
  _titulo text;
  _cli_id bigint;
  _cli_nome text;
  _dup int;
BEGIN
  -- Reenvio do mesmo PDF mantém o status; por isso olhamos também o
  -- customer_uploaded_at, senão a correção de um arquivo errado passaria batida.
  IF TG_OP = 'UPDATE'
     AND coalesce(NEW.status, '') IS NOT DISTINCT FROM coalesce(OLD.status, '')
     AND NEW.customer_uploaded_at IS NOT DISTINCT FROM OLD.customer_uploaded_at THEN
    RETURN NEW;
  END IF;

  CASE lower(coalesce(NEW.status, ''))
    WHEN 'customer_signature_uploaded' THEN
      _st := 'em_analise'; _titulo := 'Contrato assinado recebido';
    WHEN 'validated' THEN
      _st := 'aprovado';   _titulo := 'Contrato validado';
    WHEN 'rejected' THEN
      _st := 'rejeitado';  _titulo := 'Contrato rejeitado';
    WHEN 'pending_manual_review' THEN
      _st := 'em_analise'; _titulo := 'Contrato em revisão manual';
    ELSE
      -- generated, validating, pending_customer_signature, etc.: etapas
      -- internas da peça, não eventos documentais do cliente.
      RETURN NEW;
  END CASE;

  -- qa_contracts.cliente_id ora traz o id canônico, ora o id_legado. O painel
  -- filtra por qa_clientes.id, então normalizamos aqui; o match exato pelo id
  -- tem precedência sobre o id_legado.
  SELECT c.id, c.nome_completo
    INTO _cli_id, _cli_nome
  FROM public.qa_clientes c
  WHERE c.id = NEW.cliente_id OR c.id_legado = NEW.cliente_id
  ORDER BY (c.id = NEW.cliente_id) DESC
  LIMIT 1;

  -- Blindagem contra updates repetidos no mesmo ciclo (e contra a janela de
  -- deploy, enquanto a edge function antiga ainda estiver publicada).
  SELECT count(*) INTO _dup
  FROM public.qa_admin_notificacoes n
  WHERE n.referencia_tabela = 'qa_contracts'
    AND n.referencia_id = NEW.id::text
    AND coalesce(n.status, '') = _st
    AND n.created_at > now() - interval '5 minutes';
  IF _dup > 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.qa_admin_notificacoes
    (tipo, status, titulo, mensagem, cliente_id, cliente_nome, documento_nome,
     referencia_tabela, referencia_id, link, metadata)
  VALUES (
    'contrato',
    _st,
    _titulo,
    coalesce(_cli_nome, 'Cliente') || ' — Contrato assinado (Gov.br/ICP-Brasil)',
    _cli_id,
    _cli_nome,
    'Contrato assinado (Gov.br/ICP-Brasil)',
    'qa_contracts',
    NEW.id::text,
    CASE WHEN _cli_id IS NOT NULL THEN '/clientes/' || _cli_id::text ELSE NULL END,
    jsonb_build_object(
      'status_bruto', NEW.status,
      'validation_status', NEW.validation_status,
      'contract_number', NEW.contract_number,
      'venda_id', NEW.venda_id,
      'sha256', NEW.customer_signed_sha256,
      'arquivo', NEW.customer_signed_pdf_path,
      'motivo_rejeicao', CASE
        WHEN _st = 'rejeitado' THEN coalesce(
          NEW.validation_details->>'motivo',
          'Assinatura digital não validada automaticamente (Gov.br/ICP-Brasil).'
        )
        ELSE NULL
      END,
      'detalhes', NEW.validation_details
    )
  );

  RETURN NEW;
END;
$$;

-- GRANT TO authenticated não remove o EXECUTE padrão que o Postgres concede a
-- PUBLIC — função nova exige REVOKE explícito.
REVOKE ALL ON FUNCTION public.qa_admin_notif_contrato() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_qa_admin_notif_contrato ON public.qa_contracts;
CREATE TRIGGER trg_qa_admin_notif_contrato
AFTER INSERT OR UPDATE OF status ON public.qa_contracts
FOR EACH ROW EXECUTE FUNCTION public.qa_admin_notif_contrato();
