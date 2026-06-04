CREATE OR REPLACE FUNCTION public.qa_aproveitar_endereco_cadastro_publico(p_processo_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proc        public.qa_processos%ROWTYPE;
  v_path        text;
  v_ano_atual   smallint := EXTRACT(YEAR FROM CURRENT_DATE)::smallint;
  v_slot_id     uuid;
  v_atualizados integer := 0;
BEGIN
  SELECT * INTO v_proc FROM public.qa_processos WHERE id = p_processo_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF v_proc.cliente_id IS NULL THEN RETURN 0; END IF;

  SELECT comprovante_endereco_path
    INTO v_path
    FROM public.qa_cadastro_publico
   WHERE cliente_id_vinculado = v_proc.cliente_id
     AND comprovante_endereco_path IS NOT NULL
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_path IS NULL THEN RETURN 0; END IF;

  SELECT id INTO v_slot_id
    FROM public.qa_processo_documentos
   WHERE processo_id = p_processo_id
     AND tipo_documento = 'comprovante_endereco_ano_' || v_ano_atual::text
     AND status = 'pendente'
     AND arquivo_storage_key IS NULL
   LIMIT 1;

  IF v_slot_id IS NULL THEN RETURN 0; END IF;

  UPDATE public.qa_processo_documentos
     SET arquivo_storage_key = v_path,
         arquivo_url         = v_path,
         status              = 'em_analise',
         data_envio          = COALESCE(data_envio, now()),
         observacoes         = COALESCE(observacoes,'') ||
           CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
           '[' || to_char(now(),'YYYY-MM-DD HH24:MI') ||
           '] Aproveitado automaticamente do comprovante enviado no cadastro público.',
         updated_at = now()
   WHERE id = v_slot_id;
  GET DIAGNOSTICS v_atualizados = ROW_COUNT;

  IF v_atualizados > 0 THEN
    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
    VALUES (
      p_processo_id, 'endereco_cadastro_publico_aproveitado',
      'Comprovante de endereço do cadastro público vinculado ao slot do ano ' || v_ano_atual::text,
      jsonb_build_object('ano_competencia', v_ano_atual, 'doc_id', v_slot_id, 'storage_path', v_path),
      'sistema');
  END IF;

  RETURN v_atualizados;
END;
$$;

REVOKE ALL ON FUNCTION public.qa_aproveitar_endereco_cadastro_publico(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_aproveitar_endereco_cadastro_publico(uuid) TO authenticated, service_role;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.qa_processos WHERE servico_id IN (31, 44) LOOP
    PERFORM public.qa_seed_endereco_5_anos(r.id);
    PERFORM public.qa_aproveitar_endereco_cadastro_publico(r.id);
    PERFORM public.qa_recalcular_prazos_processo(r.id);
  END LOOP;
END $$;