CREATE TABLE IF NOT EXISTS public.qa_tipo_documento_aliases (
  processo_tipo text NOT NULL,
  hub_tipo      text NOT NULL,
  PRIMARY KEY (processo_tipo, hub_tipo)
);

GRANT SELECT ON public.qa_tipo_documento_aliases TO authenticated;
GRANT ALL ON public.qa_tipo_documento_aliases TO service_role;

ALTER TABLE public.qa_tipo_documento_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aliases readable by authenticated"
  ON public.qa_tipo_documento_aliases FOR SELECT TO authenticated USING (true);

INSERT INTO public.qa_tipo_documento_aliases (processo_tipo, hub_tipo) VALUES
  ('comprovante_endereco_ano_2022',            'comprovante_residencia'),
  ('comprovante_endereco_ano_2023',            'comprovante_residencia'),
  ('comprovante_endereco_ano_2024',            'comprovante_residencia'),
  ('comprovante_endereco_ano_2025',            'comprovante_residencia'),
  ('comprovante_endereco_ano_2026',            'comprovante_residencia'),
  ('comprovante_endereco_ano_2027',            'comprovante_residencia'),
  ('certidao_antecedentes_policia_civil_sp',   'antecedentes_criminais'),
  ('certidao_crimes_eleitorais_tse',           'antecedentes_eleitoral'),
  ('certidao_crimes_militares_stm',            'antecedentes_militar'),
  ('certidao_criminal_tjmsp',                  'antecedentes_estadual'),
  ('certidao_federal_trf3_regional',           'antecedentes_federal'),
  ('certidao_federal_trf3_sjsp_jef',           'antecedentes_federal'),
  ('certidao_tjsp_distribuicao_criminal',      'antecedentes_estadual'),
  ('certidao_tjsp_execucoes_criminais',        'antecedentes_estadual'),
  ('comprovante_filiacao_entidade_tiro',       'comprovante_clube_tiro'),
  ('comprovante_filiacao_entidade_tiro',       'comprovante_habitualidade'),
  ('declaracao_habitualidade_clube',           'comprovante_habitualidade'),
  ('declaracao_compromisso_habitualidade',     'comprovante_habitualidade'),
  ('declaracao_compromisso_treino',            'declaracao_correlata'),
  ('renda_nf_empresa',                         'renda_nf_recente'),
  ('renda_qsa',                                'renda_cartao_cnpj'),
  ('rg_com_cpf',                               'cin')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.qa_doc_hub_satisfaz_exigencias_processo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cliente_id integer;
BEGIN
  IF NEW.status <> 'aprovado' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'aprovado' THEN RETURN NEW; END IF;
  IF NEW.data_validade IS NOT NULL AND NEW.data_validade < CURRENT_DATE THEN RETURN NEW; END IF;

  v_cliente_id := NEW.qa_cliente_id;
  IF v_cliente_id IS NULL AND NEW.customer_id IS NOT NULL THEN
    SELECT id INTO v_cliente_id FROM public.qa_clientes WHERE customer_id = NEW.customer_id LIMIT 1;
  END IF;
  IF v_cliente_id IS NULL THEN RETURN NEW; END IF;

  UPDATE public.qa_processo_documentos
  SET status='aprovado', arquivo_url=NEW.arquivo_storage_path, arquivo_storage_key=NEW.arquivo_storage_path,
      data_envio=COALESCE(NEW.created_at,now()), data_validacao=now(), dados_extraidos_json=NEW.ia_dados_extraidos
  WHERE cliente_id=v_cliente_id AND status IN ('pendente','enviado','em_analise','revisao_humana')
    AND (tipo_documento=NEW.tipo_documento OR tipo_documento IN (
      SELECT processo_tipo FROM public.qa_tipo_documento_aliases WHERE hub_tipo=NEW.tipo_documento));

  RETURN NEW;
END;$$;

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
    WHERE pd2.status IN ('pendente','enviado','em_analise','revisao_humana')
      AND (p_cliente_id IS NULL OR pd2.cliente_id=p_cliente_id)
    ORDER BY pd2.id, dc.created_at DESC
  ) doc WHERE pd.id=doc.slot_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;$$;

SELECT public.qa_processo_rever_exigencias(NULL);