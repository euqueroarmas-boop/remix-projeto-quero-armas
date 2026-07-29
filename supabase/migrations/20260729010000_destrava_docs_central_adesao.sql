-- Destrava clientes cujos documentos da Central de Adesão nunca cumpriram
-- exigência do checklist — E corrige, ANTES disso, dois defeitos da ponte
-- Hub → processo que só ficaram alcançáveis agora.
--
-- Contexto: a trigger qa_doc_hub_satisfaz_exigencias_processo() (18/06) só age
-- sobre status='aprovado'. Como a Central de Adesão gravava
-- 'pendente_aprovacao', ela nunca disparava para esses documentos e o cliente
-- era cobrado de novo por algo que já havia entregue.
--
-- Ao passar a gravar 'aprovado', esse caminho é ativado — e com ele dois
-- comportamentos que estavam dormentes:
--   1) a trigger ignora ano_competencia, então UM comprovante de endereço
--      fecharia TODOS os anos exigidos (serviços 31 = CR e 44 = autorização
--      de compra CAC são os únicos que têm slots por ano);
--   2) a tabela de apelidos cruza documentos distintos, deixando um documento
--      cumprir a exigência de outro.
--
-- Por isso a ORDEM aqui é obrigatória: corrigir apelidos e trigger primeiro,
-- aprovar os documentos depois, varrer por último.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1) APELIDOS: um documento não pode cumprir a exigência de outro.
--    Cada certidão agora aponta para o tipo granular correspondente do Hub,
--    que a IA já classifica separadamente.
-- ─────────────────────────────────────────────────────────────────────────

-- QSA e Cartão CNPJ são documentos diferentes do grupo "empresário".
DELETE FROM public.qa_tipo_documento_aliases
WHERE processo_tipo = 'renda_qsa' AND hub_tipo = 'renda_cartao_cnpj';

-- Certidões federais: TRF 3ª Região e Seção Judiciária/JEF são distintas.
DELETE FROM public.qa_tipo_documento_aliases
WHERE processo_tipo IN ('certidao_federal_trf3_regional', 'certidao_federal_trf3_sjsp_jef')
  AND hub_tipo = 'antecedentes_federal';

-- Certidões estaduais: distribuição e execuções são peças distintas.
DELETE FROM public.qa_tipo_documento_aliases
WHERE processo_tipo IN ('certidao_tjsp_distribuicao_criminal', 'certidao_tjsp_execucoes_criminais')
  AND hub_tipo = 'antecedentes_estadual';

-- CAC: filiação à entidade, declaração de habitualidade do clube e declaração
-- de compromisso são TRÊS documentos com finalidades distintas. Um único
-- "comprovante de habitualidade" fechava os três slots de uma vez.
-- A filiação já tem tipo próprio no Hub (comprovante_clube_tiro).
DELETE FROM public.qa_tipo_documento_aliases
WHERE processo_tipo = 'comprovante_filiacao_entidade_tiro'
  AND hub_tipo = 'comprovante_habitualidade';

-- A declaração de compromisso ganha tipo próprio (criado na migration anterior)
-- em vez de ser cumprida pelo comprovante de habitualidade.
DELETE FROM public.qa_tipo_documento_aliases
WHERE processo_tipo = 'declaracao_compromisso_habitualidade'
  AND hub_tipo = 'comprovante_habitualidade';

-- Reaponta cada exigência para o seu tipo granular próprio.
INSERT INTO public.qa_tipo_documento_aliases (processo_tipo, hub_tipo) VALUES
  ('certidao_federal_trf3_regional',       'antecedentes_federal_trf3_regional'),
  ('certidao_federal_trf3_sjsp_jef',       'antecedentes_federal_sjsp_jef'),
  ('certidao_tjsp_distribuicao_criminal',  'antecedentes_estadual_distribuicao'),
  ('certidao_tjsp_execucoes_criminais',    'antecedentes_estadual_execucoes'),
  ('declaracao_compromisso_habitualidade', 'declaracao_compromisso_habitualidade')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) TRIGGER: respeita ano_competencia.
--    Slot com ano definido só é cumprido por documento emitido naquele ano.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_doc_hub_satisfaz_exigencias_processo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cliente_id integer;
  v_ano_doc    smallint;
BEGIN
  IF NEW.status <> 'aprovado' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'aprovado' THEN RETURN NEW; END IF;
  IF NEW.data_validade IS NOT NULL AND NEW.data_validade < CURRENT_DATE THEN RETURN NEW; END IF;

  v_cliente_id := NEW.qa_cliente_id;
  IF v_cliente_id IS NULL AND NEW.customer_id IS NOT NULL THEN
    SELECT id INTO v_cliente_id FROM public.qa_clientes WHERE customer_id = NEW.customer_id LIMIT 1;
  END IF;
  IF v_cliente_id IS NULL THEN RETURN NEW; END IF;

  -- Ano do documento: emissão quando houver, senão o envio.
  v_ano_doc := EXTRACT(YEAR FROM COALESCE(NEW.data_emissao, NEW.created_at, now()))::smallint;

  UPDATE public.qa_processo_documentos pd
  SET status='aprovado', arquivo_url=NEW.arquivo_storage_path, arquivo_storage_key=NEW.arquivo_storage_path,
      data_envio=COALESCE(NEW.created_at,now()), data_validacao=now(), dados_extraidos_json=NEW.ia_dados_extraidos
  WHERE pd.cliente_id=v_cliente_id AND pd.status IN ('pendente','enviado','em_analise','revisao_humana')
    AND (pd.tipo_documento=NEW.tipo_documento OR pd.tipo_documento IN (
      SELECT processo_tipo FROM public.qa_tipo_documento_aliases WHERE hub_tipo=NEW.tipo_documento))
    -- Exigência por ano (CR / autorização CAC): só fecha o ano correspondente.
    AND (pd.ano_competencia IS NULL OR pd.ano_competencia = v_ano_doc);

  RETURN NEW;
END;$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) VARREDURA: mesma regra de ano aplicada à reavaliação em massa.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_processo_rever_exigencias(p_cliente_id integer DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_updated integer := 0;
BEGIN
  UPDATE public.qa_processo_documentos pd
  SET status='aprovado', arquivo_url=doc.arquivo_storage_path, arquivo_storage_key=doc.arquivo_storage_path,
      data_envio=COALESCE(doc.created_at,now()), data_validacao=now(), dados_extraidos_json=doc.ia_dados_extraidos
  FROM (
    SELECT DISTINCT ON (pd2.id) pd2.id AS slot_id, dc.arquivo_storage_path, dc.created_at, dc.ia_dados_extraidos
    FROM public.qa_processo_documentos pd2
    JOIN public.qa_documentos_cliente dc
      ON dc.status='aprovado' AND (dc.data_validade IS NULL OR dc.data_validade>=CURRENT_DATE)
      AND (dc.qa_cliente_id=pd2.cliente_id OR EXISTS (
        SELECT 1 FROM public.qa_clientes qc WHERE qc.id=pd2.cliente_id AND qc.customer_id=dc.customer_id))
      AND (dc.tipo_documento=pd2.tipo_documento OR pd2.tipo_documento IN (
        SELECT processo_tipo FROM public.qa_tipo_documento_aliases WHERE hub_tipo=dc.tipo_documento))
      -- Slot com ano exigido só aceita documento emitido naquele ano.
      AND (pd2.ano_competencia IS NULL
           OR pd2.ano_competencia = EXTRACT(YEAR FROM COALESCE(dc.data_emissao, dc.created_at))::smallint)
    WHERE pd2.status IN ('pendente','enviado','em_analise','revisao_humana')
      AND (p_cliente_id IS NULL OR pd2.cliente_id=p_cliente_id)
    ORDER BY pd2.id, dc.created_at DESC
  ) doc WHERE pd.id=doc.slot_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4) Só agora: aprova os documentos da Central de Adesão presos em
--    'pendente_aprovacao'. O UPDATE dispara a trigger — já corrigida.
--    Escopo estreito: documento enviado pelo próprio cliente não é tocado.
-- ─────────────────────────────────────────────────────────────────────────
UPDATE public.qa_documentos_cliente
SET status = 'aprovado',
    validado_admin = true,
    aprovado_em = COALESCE(aprovado_em, now())
WHERE status = 'pendente_aprovacao'
  AND origem = 'admin'
  AND ia_dados_extraidos->>'origem' = 'central_adesao';

-- 5) Varredura final, com as regras já corrigidas.
SELECT public.qa_processo_rever_exigencias(NULL);

COMMIT;
