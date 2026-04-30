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

    -- Documento já criado como aprovado/reprovado: registra evento adicional.
    IF NEW.status IN ('aprovado','reprovado') THEN
      FOR r IN
        SELECT s.id
          FROM public.qa_solicitacoes_servico s
         WHERE s.cliente_id = v_cliente_id
           AND EXISTS (
             SELECT 1 FROM public.qa_servico_documentos_obrigatorios o
              WHERE o.servico_id = s.servico_id AND o.tipo_documento = v_tipo
           )
      LOOP
        INSERT INTO public.qa_solicitacao_eventos
          (solicitacao_id, cliente_id, evento, descricao, ator, metadata)
        VALUES
          (r.id, NULL,
           CASE WHEN NEW.status = 'aprovado' THEN 'documento_aprovado' ELSE 'documento_reprovado' END,
           CASE WHEN NEW.status = 'aprovado'
                THEN 'Documento aprovado: ' || v_tipo
                ELSE 'Documento reprovado: ' || v_tipo END,
           'sistema',
           jsonb_build_object(
             'tipo_documento', v_tipo,
             'arquivo_nome', NEW.arquivo_nome,
             'motivo', NEW.motivo_reprovacao
           ));
      END LOOP;
    END IF;

  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    -- Eventos de aprovação/reprovação na timeline
    IF NEW.status IN ('aprovado','reprovado') THEN
      FOR r IN
        SELECT s.id
          FROM public.qa_solicitacoes_servico s
         WHERE s.cliente_id = v_cliente_id
           AND EXISTS (
             SELECT 1 FROM public.qa_servico_documentos_obrigatorios o
              WHERE o.servico_id = s.servico_id AND o.tipo_documento = v_tipo
           )
      LOOP
        INSERT INTO public.qa_solicitacao_eventos
          (solicitacao_id, cliente_id, evento, descricao, ator, metadata)
        VALUES
          (r.id, NULL,
           CASE WHEN NEW.status = 'aprovado' THEN 'documento_aprovado' ELSE 'documento_reprovado' END,
           CASE WHEN NEW.status = 'aprovado'
                THEN 'Documento aprovado: ' || v_tipo
                ELSE 'Documento reprovado: ' || v_tipo END,
           'sistema',
           jsonb_build_object(
             'tipo_documento', v_tipo,
             'arquivo_nome', NEW.arquivo_nome,
             'status_anterior', OLD.status,
             'motivo', NEW.motivo_reprovacao
           ));
      END LOOP;
    END IF;

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