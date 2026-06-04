-- =========================================================================
-- REMOÇÃO TOTAL DO TIPO "comprovante_endereco_revisao_ano"
-- =========================================================================

-- 1) Trigger e função de auto-promoção
DROP TRIGGER IF EXISTS qa_trg_revisao_endereco_auto_promover_t ON public.qa_processo_documentos;
DROP FUNCTION IF EXISTS public.qa_trg_revisao_endereco_auto_promover();

-- 2) RPC de movimentação manual
DROP FUNCTION IF EXISTS public.qa_mover_endereco_revisao_para_ano(uuid, smallint);

-- 3) Apaga registros já criados
DELETE FROM public.qa_processo_documentos
 WHERE tipo_documento = 'comprovante_endereco_revisao_ano';

-- 4) Reescreve aproveitamento: só vincula se houver data; sem data, NÃO faz nada
CREATE OR REPLACE FUNCTION public.qa_aproveitar_endereco_cadastro_publico(p_processo_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_proc            public.qa_processos%ROWTYPE;
  v_path            text;
  v_data_emissao    date;
  v_ano             smallint;
  v_slot_id         uuid;
  v_atualizados     integer := 0;
  v_ano_atual       smallint := EXTRACT(YEAR FROM CURRENT_DATE)::smallint;
BEGIN
  SELECT * INTO v_proc FROM public.qa_processos WHERE id = p_processo_id;
  IF NOT FOUND OR v_proc.cliente_id IS NULL THEN RETURN 0; END IF;

  SELECT comprovante_endereco_path
    INTO v_path
    FROM public.qa_cadastro_publico
   WHERE cliente_id_vinculado = v_proc.cliente_id
     AND comprovante_endereco_path IS NOT NULL
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_path IS NULL THEN RETURN 0; END IF;

  -- Já vinculado em algum slot deste processo? Não duplica.
  IF EXISTS (
    SELECT 1 FROM public.qa_processo_documentos
     WHERE processo_id = p_processo_id
       AND arquivo_storage_key = v_path
  ) THEN
    RETURN 0;
  END IF;

  -- Procura data real desse arquivo (extraída pela IA em outro processo)
  SELECT data_emissao
    INTO v_data_emissao
    FROM public.qa_processo_documentos
   WHERE arquivo_storage_key = v_path
     AND data_emissao IS NOT NULL
   ORDER BY updated_at DESC
   LIMIT 1;

  -- SEM DATA → não cria documento auxiliar, não presume ano. Mantém apenas
  -- o original no Hub Cliente / Cadastro Público.
  IF v_data_emissao IS NULL THEN
    RETURN 0;
  END IF;

  v_ano := EXTRACT(YEAR FROM v_data_emissao)::smallint;

  -- Janela de 5 anos (atual + 4 anteriores)
  IF v_ano < (v_ano_atual - 4) OR v_ano > v_ano_atual THEN
    RETURN 0;
  END IF;

  SELECT id INTO v_slot_id
    FROM public.qa_processo_documentos
   WHERE processo_id   = p_processo_id
     AND tipo_documento = 'comprovante_endereco_ano_' || v_ano::text
     AND status         = 'pendente'
     AND arquivo_storage_key IS NULL
   LIMIT 1;

  IF v_slot_id IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.qa_processo_documentos
     SET arquivo_storage_key = v_path,
         arquivo_url         = v_path,
         status              = 'em_analise',
         data_envio          = COALESCE(data_envio, now()),
         data_emissao        = v_data_emissao,
         observacoes         = COALESCE(observacoes,'') ||
           CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
           '[' || to_char(now(),'YYYY-MM-DD HH24:MI') ||
           '] Aproveitado automaticamente do cadastro público (ano de competência ' || v_ano::text || ').',
         updated_at = now()
   WHERE id = v_slot_id;
  GET DIAGNOSTICS v_atualizados = ROW_COUNT;

  IF v_atualizados > 0 THEN
    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
    VALUES (
      p_processo_id, 'endereco_cadastro_publico_aproveitado',
      'Comprovante do cadastro público vinculado ao slot do ano ' || v_ano::text || ' (data real do documento).',
      jsonb_build_object('ano_competencia', v_ano, 'doc_id', v_slot_id, 'storage_path', v_path, 'origem_data','data_emissao_extraida'),
      'sistema');
  END IF;

  RETURN v_atualizados;
END;
$function$;