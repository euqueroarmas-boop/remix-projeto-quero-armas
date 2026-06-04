-- ============================================================================
-- ENGINE DE PRAZOS E AUTO-LIBERAÇÃO DE ETAPAS — Quero Armas
-- ============================================================================
-- Mapeia tipo_documento -> categoria operacional de liberação por etapa.
-- Mesma lógica do front (componente ProcessoDetalheDrawer.categorizar).
CREATE OR REPLACE FUNCTION public.qa_categoria_documento(tipo text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(coalesce(tipo,'')) LIKE 'certidao%' OR lower(coalesce(tipo,'')) LIKE '%antecedentes%' THEN 'antecedentes'
    WHEN lower(coalesce(tipo,'')) LIKE '%laudo%' OR lower(coalesce(tipo,'')) LIKE '%psicologic%' OR lower(coalesce(tipo,'')) LIKE '%capacidade_tecnica%' OR lower(coalesce(tipo,'')) LIKE '%tiro%' OR lower(coalesce(tipo,'')) LIKE '%aptidao%' THEN 'exames'
    WHEN lower(coalesce(tipo,'')) LIKE '%endereco%' OR lower(coalesce(tipo,'')) LIKE '%residenc%' THEN 'endereco'
    WHEN lower(coalesce(tipo,'')) LIKE 'declaracao%' OR lower(coalesce(tipo,'')) LIKE 'dsa_%' OR lower(coalesce(tipo,'')) LIKE '%compromisso%' THEN 'declaracoes'
    ELSE 'outros'
  END;
$$;

-- Etapa de liberação numérica (1=endereco, 2=antecedentes, 3=declaracoes, 4=exames).
-- "outros" entra na etapa 1 (sempre liberado, fluxo herdado).
CREATE OR REPLACE FUNCTION public.qa_etapa_documento(tipo text)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE public.qa_categoria_documento(tipo)
    WHEN 'endereco'     THEN 1::smallint
    WHEN 'antecedentes' THEN 2::smallint
    WHEN 'declaracoes'  THEN 3::smallint
    WHEN 'exames'       THEN 4::smallint
    ELSE 1::smallint
  END;
$$;

-- ----------------------------------------------------------------------------
-- Recalcula prazos efetivos do processo:
--  1. Para cada doc com data_emissao definida, calcula data_validade_efetiva =
--     min(data_emissao + validade_dias, proxima_leitura).
--  2. Define no processo: primeiro_doc_aprovado_em (1o comprov. endereço aprovado),
--     prazo_critico_data e prazo_critico_doc_id (menor validade entre TODOS docs
--     entregues que ainda valem — i.e. status em ('enviado','em_analise','aprovado','divergente')).
--  3. Auto-libera próxima etapa: se TODOS os docs obrigatórios da etapa atual
--     estão aprovados, sobe etapa_liberada_ate em +1 (limitado a 4).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_recalcular_prazos_processo(p_processo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec_doc           record;
  v_validade_efet   date;
  v_validade_dias_efet integer;
  v_min_data        date;
  v_min_doc_id      uuid;
  v_min_doc_nome    text;
  v_primeiro_end    timestamptz;
  v_etapa_atual     smallint;
  v_etapa_nova      smallint;
  v_pendentes_etapa integer;
BEGIN
  -- 1) Atualiza data_validade_efetiva de cada doc do processo.
  FOR rec_doc IN
    SELECT id, tipo_documento, data_emissao, proxima_leitura,
           validade_dias, status
      FROM public.qa_processo_documentos
     WHERE processo_id = p_processo_id
  LOOP
    -- Pega validade_dias do doc, ou cai para a tabela central qa_validade_documentos.
    v_validade_dias_efet := rec_doc.validade_dias;
    IF v_validade_dias_efet IS NULL THEN
      SELECT validade_dias INTO v_validade_dias_efet
        FROM public.qa_validade_documentos
       WHERE tipo_documento = rec_doc.tipo_documento;
    END IF;

    v_validade_efet := NULL;
    IF rec_doc.data_emissao IS NOT NULL AND v_validade_dias_efet IS NOT NULL AND v_validade_dias_efet > 0 THEN
      v_validade_efet := rec_doc.data_emissao + (v_validade_dias_efet || ' days')::interval;
    END IF;
    -- Próxima leitura (contas de consumo) sempre encurta o prazo se for antes.
    IF rec_doc.proxima_leitura IS NOT NULL THEN
      v_validade_efet := LEAST(coalesce(v_validade_efet, rec_doc.proxima_leitura), rec_doc.proxima_leitura);
    END IF;

    UPDATE public.qa_processo_documentos
       SET data_validade_efetiva = v_validade_efet
     WHERE id = rec_doc.id;
  END LOOP;

  -- 2) Menor validade entre docs "vivos" (não invalidados / não excluídos).
  SELECT data_validade_efetiva, id, nome_documento
    INTO v_min_data, v_min_doc_id, v_min_doc_nome
    FROM public.qa_processo_documentos
   WHERE processo_id = p_processo_id
     AND data_validade_efetiva IS NOT NULL
     AND status IN ('enviado','em_analise','aprovado','divergente','revisao_humana')
   ORDER BY data_validade_efetiva ASC
   LIMIT 1;

  -- 3) 1º comprovante de endereço aprovado dispara o relógio do processo.
  SELECT MIN(data_validacao) INTO v_primeiro_end
    FROM public.qa_processo_documentos
   WHERE processo_id = p_processo_id
     AND status = 'aprovado'
     AND public.qa_categoria_documento(tipo_documento) = 'endereco';

  -- 4) Auto-liberação de etapa: se 100% obrigatórios da etapa atual aprovados, sobe.
  SELECT etapa_liberada_ate INTO v_etapa_atual
    FROM public.qa_processos
   WHERE id = p_processo_id;
  v_etapa_atual := coalesce(v_etapa_atual, 1);
  v_etapa_nova  := v_etapa_atual;

  -- Conta pendentes (não aprovados / não dispensados) na etapa atual, considerando
  -- só obrigatórios. Se zero pendentes, podemos liberar a próxima etapa.
  WHILE v_etapa_nova < 4 LOOP
    SELECT COUNT(*) INTO v_pendentes_etapa
      FROM public.qa_processo_documentos
     WHERE processo_id = p_processo_id
       AND obrigatorio = true
       AND public.qa_etapa_documento(tipo_documento) = v_etapa_nova
       AND status NOT IN ('aprovado','dispensado_grupo');
    EXIT WHEN v_pendentes_etapa > 0;
    v_etapa_nova := v_etapa_nova + 1;
  END LOOP;

  UPDATE public.qa_processos
     SET prazo_critico_data       = v_min_data,
         prazo_critico_doc_id     = v_min_doc_id,
         primeiro_doc_aprovado_em = COALESCE(primeiro_doc_aprovado_em, v_primeiro_end),
         etapa_liberada_ate       = GREATEST(coalesce(etapa_liberada_ate,1), v_etapa_nova)
   WHERE id = p_processo_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- Trigger: recalcula prazos sempre que muda algo relevante de um documento.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_trg_recalc_prazos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Roda no AFTER, then we don't compete with NEW writes; ignore failures silently.
  BEGIN
    PERFORM public.qa_recalcular_prazos_processo(COALESCE(NEW.processo_id, OLD.processo_id));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'qa_trg_recalc_prazos falhou: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS qa_proc_docs_recalc_prazos ON public.qa_processo_documentos;
CREATE TRIGGER qa_proc_docs_recalc_prazos
AFTER INSERT OR UPDATE OF status, data_emissao, proxima_leitura, validade_dias, data_validade
OR DELETE
ON public.qa_processo_documentos
FOR EACH ROW
EXECUTE FUNCTION public.qa_trg_recalc_prazos();

-- ----------------------------------------------------------------------------
-- Constraint sanity: etapa_liberada_ate entre 1..4.
-- ----------------------------------------------------------------------------
ALTER TABLE public.qa_processos
  DROP CONSTRAINT IF EXISTS qa_processos_etapa_liberada_chk;
ALTER TABLE public.qa_processos
  ADD CONSTRAINT qa_processos_etapa_liberada_chk
  CHECK (etapa_liberada_ate BETWEEN 1 AND 4);
