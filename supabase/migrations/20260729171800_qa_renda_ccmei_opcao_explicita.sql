-- CCMEI como opcao explicita de ocupacao licita.
--
-- Base operacional/juridica Quero Armas:
-- Lei 10.826/2003, Decreto 11.615/2023, Decreto 12.345/2024,
-- IN DG/PF 201 e IN DG/PF 311.
--
-- Regra de negocio:
-- CCMEI substitui funcionalmente Contrato Social / Requerimento de Empresario
-- para MEI. Nunca substitui Cartao CNPJ.

ALTER TABLE public.qa_documentos_cliente DROP CONSTRAINT IF EXISTS qa_doc_cliente_tipo_check;

ALTER TABLE public.qa_documentos_cliente
  ADD CONSTRAINT qa_doc_cliente_tipo_check CHECK (
    tipo_documento = ANY (ARRAY[
      'cr','craf','sinarm','gt','gte','autorizacao_compra','nota_fiscal_arma',
      'rg_com_cpf','cin','cnh','cpf',
      'comprovante_residencia','declaracao_responsavel_imovel',
      'ctps','renda_holerite_mes_atual','renda_holerite_funcionario_publico',
      'renda_cartao_cnpj','renda_cnpj_autonomo','renda_contrato_social','renda_ccmei',
      'renda_nf_recente','renda_comprovante_beneficio','renda_extrato_inss',
      'antecedentes_criminais',
      'antecedentes_federal','antecedentes_federal_trf3_regional','antecedentes_federal_sjsp_jef',
      'antecedentes_estadual','antecedentes_estadual_distribuicao','antecedentes_estadual_execucoes',
      'antecedentes_militar','antecedentes_eleitoral',
      'declaracao_sem_inquerito_processo_criminal','declaracao_guarda_responsavel',
      'declaracao_correlata','declaracao_guarda_acervo_1endereco',
      'laudo_psicologico','laudo_capacidade_tecnica',
      'comprovante_efetiva_necessidade','documento_complementar_caso',
      'comprovante_habitualidade','comprovante_clube_tiro','comprovante_competicao',
      'protocolo_processo','oficio','despacho','exigencia','indeferimento',
      'procuracao','recurso_administrativo_doc','mandado_seguranca_doc',
      'certidao_alteracao_nome','outro'
    ]::text[])
  );

INSERT INTO public.qa_tipo_documento_aliases (processo_tipo, hub_tipo)
VALUES ('renda_contrato_social', 'renda_ccmei')
ON CONFLICT (processo_tipo, hub_tipo) DO NOTHING;

INSERT INTO public.qa_validacao_config (
  tipo_documento,
  limite_aprovacao_auto,
  limite_analise_humana,
  permite_aprovacao_auto,
  observacoes
)
VALUES (
  'renda_ccmei',
  0.88,
  0.55,
  true,
  'CCMEI substitui Contrato Social/Requerimento de Empresario para MEI; nao substitui Cartao CNPJ.'
)
ON CONFLICT (tipo_documento) DO UPDATE SET
  limite_aprovacao_auto = EXCLUDED.limite_aprovacao_auto,
  limite_analise_humana = EXCLUDED.limite_analise_humana,
  permite_aprovacao_auto = EXCLUDED.permite_aprovacao_auto,
  observacoes = EXCLUDED.observacoes;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT p.id
      FROM public.qa_processos p
      JOIN public.qa_processo_documentos pd
        ON pd.processo_id = p.id
      JOIN public.qa_documentos_cliente dc
        ON dc.qa_cliente_id = p.cliente_id
     WHERE p.status NOT IN ('cancelado', 'concluido')
       AND pd.tipo_documento = 'renda_contrato_social'
       AND pd.status IN ('pendente', 'rejeitado', 'enviado', 'em_analise', 'revisao_humana')
       AND pd.arquivo_storage_key IS NULL
       AND dc.tipo_documento = 'renda_ccmei'
       AND (dc.validado_admin = true OR dc.status = 'aprovado')
       AND dc.arquivo_storage_path IS NOT NULL
       AND (dc.data_validade IS NULL OR dc.data_validade >= CURRENT_DATE)
  LOOP
    PERFORM public.qa_reaproveitar_documentos_hub_processo(r.id, 'backfill_renda_ccmei');
  END LOOP;
END $$;
