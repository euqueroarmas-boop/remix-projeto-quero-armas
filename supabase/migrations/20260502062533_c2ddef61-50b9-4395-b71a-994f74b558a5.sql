
-- ============================================================================
-- Slice 2.2 — Engine de 5 anos de endereço (parte 2)
-- ============================================================================

-- (1) Função: mover documento "Definir Ano" para o slot anual correto
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_mover_endereco_revisao_para_ano(
  p_doc_revisao_id uuid,
  p_ano            smallint
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_revisao  public.qa_processo_documentos%ROWTYPE;
  v_slot_id  uuid;
  v_ano_atual smallint := EXTRACT(YEAR FROM CURRENT_DATE)::smallint;
BEGIN
  IF p_ano IS NULL OR p_ano < (v_ano_atual - 4) OR p_ano > v_ano_atual THEN
    RAISE EXCEPTION 'Ano % fora da janela permitida (% a %)', p_ano, v_ano_atual - 4, v_ano_atual;
  END IF;

  SELECT * INTO v_revisao FROM public.qa_processo_documentos WHERE id = p_doc_revisao_id;
  IF NOT FOUND OR v_revisao.tipo_documento <> 'comprovante_endereco_revisao_ano' THEN
    RAISE EXCEPTION 'Documento de revisão não encontrado';
  END IF;
  IF v_revisao.arquivo_storage_key IS NULL THEN
    RAISE EXCEPTION 'Item de revisão sem arquivo associado';
  END IF;

  SELECT id INTO v_slot_id
    FROM public.qa_processo_documentos
   WHERE processo_id   = v_revisao.processo_id
     AND tipo_documento = 'comprovante_endereco_ano_' || p_ano::text
     AND arquivo_storage_key IS NULL
     AND status = 'pendente'
   LIMIT 1;

  IF v_slot_id IS NULL THEN
    RAISE EXCEPTION 'Slot do ano % não existe ou já está preenchido', p_ano;
  END IF;

  UPDATE public.qa_processo_documentos
     SET arquivo_storage_key = v_revisao.arquivo_storage_key,
         arquivo_url         = v_revisao.arquivo_url,
         data_envio          = COALESCE(v_revisao.data_envio, now()),
         data_emissao        = COALESCE(v_revisao.data_emissao, make_date(p_ano::int, 1, 1)),
         status              = 'em_analise',
         observacoes         = COALESCE(observacoes,'') ||
           CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
           '[' || to_char(now(),'YYYY-MM-DD HH24:MI') ||
           '] Ano de competência definido pela Equipe (' || p_ano::text || ').',
         updated_at = now()
   WHERE id = v_slot_id;

  -- Remove o item de revisão (já promovido ao slot real)
  DELETE FROM public.qa_processo_documentos WHERE id = p_doc_revisao_id;

  INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
  VALUES (
    v_revisao.processo_id,
    'endereco_revisao_definido_ano',
    'Equipe definiu ano de competência ' || p_ano::text || ' para comprovante em revisão.',
    jsonb_build_object('ano_competencia', p_ano, 'doc_id', v_slot_id, 'origem_doc_revisao', p_doc_revisao_id),
    'equipe_operacional'
  );

  RETURN v_slot_id;
END;
$function$;

-- (2) Trigger: quando IA preenche data_emissao num item de revisão, mover sozinho
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_trg_revisao_endereco_auto_promover()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ano       smallint;
  v_slot_id   uuid;
  v_ano_atual smallint := EXTRACT(YEAR FROM CURRENT_DATE)::smallint;
BEGIN
  IF NEW.tipo_documento <> 'comprovante_endereco_revisao_ano' THEN
    RETURN NEW;
  END IF;
  IF NEW.data_emissao IS NULL OR (OLD.data_emissao IS NOT NULL AND OLD.data_emissao = NEW.data_emissao) THEN
    RETURN NEW;
  END IF;

  v_ano := EXTRACT(YEAR FROM NEW.data_emissao)::smallint;
  IF v_ano < (v_ano_atual - 4) OR v_ano > v_ano_atual THEN
    RETURN NEW; -- fora da janela: deixa para a Equipe decidir
  END IF;

  SELECT id INTO v_slot_id
    FROM public.qa_processo_documentos
   WHERE processo_id   = NEW.processo_id
     AND tipo_documento = 'comprovante_endereco_ano_' || v_ano::text
     AND arquivo_storage_key IS NULL
     AND status = 'pendente'
   LIMIT 1;

  IF v_slot_id IS NULL THEN
    RETURN NEW; -- slot já preenchido, não sobrescreve
  END IF;

  UPDATE public.qa_processo_documentos
     SET arquivo_storage_key = NEW.arquivo_storage_key,
         arquivo_url         = NEW.arquivo_url,
         data_envio          = COALESCE(NEW.data_envio, now()),
         data_emissao        = NEW.data_emissao,
         status              = 'em_analise',
         observacoes         = COALESCE(observacoes,'') ||
           CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
           '[' || to_char(now(),'YYYY-MM-DD HH24:MI') ||
           '] Ano detectado pela IA (' || v_ano::text || ') — promovido automaticamente da revisão.',
         updated_at = now()
   WHERE id = v_slot_id;

  -- Apaga o item de revisão original (substituído pelo slot anual real)
  DELETE FROM public.qa_processo_documentos WHERE id = NEW.id;

  INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
  VALUES (
    NEW.processo_id,
    'endereco_revisao_auto_promovido',
    'Comprovante em revisão promovido automaticamente para o ano ' || v_ano::text || ' (data extraída pela IA).',
    jsonb_build_object('ano_competencia', v_ano, 'doc_id', v_slot_id, 'origem_doc_revisao', NEW.id),
    'sistema'
  );

  RETURN NULL; -- linha original já deletada
END;
$function$;

DROP TRIGGER IF EXISTS qa_trg_revisao_endereco_auto_promover_t ON public.qa_processo_documentos;
CREATE TRIGGER qa_trg_revisao_endereco_auto_promover_t
AFTER UPDATE OF data_emissao ON public.qa_processo_documentos
FOR EACH ROW
WHEN (NEW.tipo_documento = 'comprovante_endereco_revisao_ano')
EXECUTE FUNCTION public.qa_trg_revisao_endereco_auto_promover();
