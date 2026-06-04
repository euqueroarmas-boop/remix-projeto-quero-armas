
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
  v_revisao_id      uuid;
  v_atualizados     integer := 0;
  v_existe_revisao  boolean;
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

  IF EXISTS (
    SELECT 1 FROM public.qa_processo_documentos
     WHERE processo_id = p_processo_id
       AND arquivo_storage_key = v_path
  ) THEN
    RETURN 0;
  END IF;

  SELECT data_emissao
    INTO v_data_emissao
    FROM public.qa_processo_documentos
   WHERE arquivo_storage_key = v_path
     AND data_emissao IS NOT NULL
   ORDER BY updated_at DESC
   LIMIT 1;

  IF v_data_emissao IS NOT NULL THEN
    v_ano := EXTRACT(YEAR FROM v_data_emissao)::smallint;

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
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.qa_processo_documentos
     WHERE processo_id = p_processo_id
       AND tipo_documento = 'comprovante_endereco_revisao_ano'
  ) INTO v_existe_revisao;

  IF NOT v_existe_revisao THEN
    INSERT INTO public.qa_processo_documentos (
      processo_id, cliente_id, tipo_documento, nome_documento,
      etapa, status, obrigatorio, validade_dias, ano_competencia,
      arquivo_storage_key, arquivo_url, data_envio, observacoes
    )
    VALUES (
      p_processo_id, v_proc.cliente_id,
      'comprovante_endereco_revisao_ano',
      'Comprovante de Endereço — Definir Ano (revisão da Equipe)',
      'base', 'revisao_humana', false, 90, NULL,
      v_path, v_path, now(),
      '[' || to_char(now(),'YYYY-MM-DD HH24:MI') ||
      '] Comprovante recebido no cadastro público, sem data extraída. ' ||
      'A Equipe Quero Armas deve identificar o ano de competência e mover para o slot correto.'
    )
    RETURNING id INTO v_revisao_id;

    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
    VALUES (
      p_processo_id, 'endereco_cadastro_publico_revisao_manual',
      'Comprovante do cadastro público enviado para revisão manual (sem data extraída).',
      jsonb_build_object('doc_id', v_revisao_id, 'storage_path', v_path),
      'sistema');

    v_atualizados := 1;
  END IF;

  RETURN v_atualizados;
END;
$function$;

-- Backfill correção
DO $$
DECLARE
  r record;
  v_ano_atual smallint := EXTRACT(YEAR FROM CURRENT_DATE)::smallint;
BEGIN
  FOR r IN
    SELECT id, processo_id, cliente_id, arquivo_storage_key
      FROM public.qa_processo_documentos
     WHERE tipo_documento = 'comprovante_endereco_ano_' || v_ano_atual::text
       AND arquivo_storage_key IS NOT NULL
       AND data_emissao IS NULL
       AND observacoes ILIKE '%Aproveitado automaticamente%'
  LOOP
    UPDATE public.qa_processo_documentos
       SET arquivo_storage_key = NULL,
           arquivo_url         = NULL,
           status              = 'pendente',
           data_envio          = NULL,
           observacoes         = COALESCE(observacoes,'') ||
             E'\n[' || to_char(now(),'YYYY-MM-DD HH24:MI') ||
             '] Vínculo automático revertido: o comprovante não comprova o ano ' || v_ano_atual::text || '.',
           updated_at = now()
     WHERE id = r.id;

    IF NOT EXISTS (
      SELECT 1 FROM public.qa_processo_documentos
       WHERE processo_id = r.processo_id
         AND tipo_documento = 'comprovante_endereco_revisao_ano'
    ) THEN
      INSERT INTO public.qa_processo_documentos (
        processo_id, cliente_id, tipo_documento, nome_documento,
        etapa, status, obrigatorio, validade_dias, ano_competencia,
        arquivo_storage_key, arquivo_url, data_envio, observacoes
      )
      VALUES (
        r.processo_id, r.cliente_id,
        'comprovante_endereco_revisao_ano',
        'Comprovante de Endereço — Definir Ano (revisão da Equipe)',
        'base', 'revisao_humana', false, 90, NULL,
        r.arquivo_storage_key, r.arquivo_storage_key, now(),
        '[' || to_char(now(),'YYYY-MM-DD HH24:MI') ||
        '] Backfill: comprovante do cadastro público sem data — Equipe deve identificar o ano.'
      );
    END IF;

    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
    VALUES (
      r.processo_id, 'endereco_cadastro_publico_backfill_corrigido',
      'Vínculo automático no slot do ano atual revertido (sem prova de data).',
      jsonb_build_object('doc_id', r.id, 'ano_revertido', v_ano_atual),
      'sistema');
  END LOOP;
END $$;

-- Categoria mantém endereco para o tipo de revisão
CREATE OR REPLACE FUNCTION public.qa_categoria_documento(tipo text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN tipo IS NULL THEN 'outros'
    WHEN tipo LIKE 'comprovante_endereco%' THEN 'endereco'
    WHEN tipo LIKE 'certidao%' OR tipo ILIKE '%antecedentes%' THEN 'antecedentes'
    WHEN tipo LIKE 'declaracao%' OR tipo ILIKE '%compromisso%' THEN 'declaracoes'
    WHEN tipo ILIKE '%laudo%' OR tipo ILIKE '%tiro%' OR tipo ILIKE '%aptidao%' THEN 'exames'
    ELSE 'outros'
  END;
$function$;
