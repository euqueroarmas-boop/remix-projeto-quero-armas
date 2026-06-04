-- 1) Conserta tipo da coluna cliente_id na timeline (cliente_id é integer)
ALTER TABLE public.qa_solicitacao_eventos
  ALTER COLUMN cliente_id TYPE integer USING NULL;

-- 2) Atualiza recálculo: força aguardando_documentacao quando sem checklist
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
  v_ja_logado boolean;
BEGIN
  SELECT status_servico INTO v_status_atual
  FROM public.qa_solicitacoes_servico
  WHERE id = _solicitacao_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_status_atual = ANY(v_status_orgao) THEN RETURN v_status_atual; END IF;

  SELECT x_progresso, x_valido, y, sem_checklist
    INTO v_x_prog, v_x_val, v_y, v_sem
  FROM public.qa_calcular_progresso(_solicitacao_id);

  UPDATE public.qa_solicitacoes_servico
     SET sem_checklist_configurado = v_sem
   WHERE id = _solicitacao_id
     AND sem_checklist_configurado IS DISTINCT FROM v_sem;

  IF v_sem THEN
    IF v_status_atual IS DISTINCT FROM 'aguardando_documentacao' THEN
      UPDATE public.qa_solicitacoes_servico
         SET status_servico = 'aguardando_documentacao'
       WHERE id = _solicitacao_id;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.qa_solicitacao_eventos
       WHERE solicitacao_id = _solicitacao_id
         AND evento = 'checklist_nao_configurado'
         AND created_at > now() - interval '30 days'
    ) INTO v_ja_logado;

    IF NOT v_ja_logado THEN
      INSERT INTO public.qa_solicitacao_eventos
        (solicitacao_id, evento, status_novo, descricao, ator, metadata)
      VALUES
        (_solicitacao_id, 'checklist_nao_configurado', 'aguardando_documentacao',
         'Serviço sem checklist de documentos obrigatórios. Configure para ativar o fluxo automático.',
         'sistema', jsonb_build_object('sem_checklist', true));
    END IF;

    RETURN 'aguardando_documentacao';
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

-- 3) Aplica retroativamente
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id FROM public.qa_solicitacoes_servico
     WHERE status_servico NOT IN (
       'enviado_ao_orgao','em_analise_orgao','notificado','restituido',
       'recurso_administrativo','deferido','indeferido','finalizado'
     )
  LOOP
    PERFORM public.qa_recalcular_status_servico(r.id);
  END LOOP;
END $$;