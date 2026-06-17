BEGIN;

INSERT INTO public.qa_tipos_documento_catalogo (
  tipo_documento,
  categoria_hub,
  subcategoria_hub,
  escopo_documental,
  label_publico,
  descricao_upload,
  aceita_ia,
  aceita_vinculo_arma,
  exige_validade,
  reaproveitavel_global,
  revisao_humana_obrigatoria,
  ativo,
  ordem,
  fonte_normativa
)
VALUES
  (
    'declaracao_correlata',
    'declaracoes',
    'correlata',
    'permanente',
    'Declaração correlata',
    'Declaração complementar do titular para o serviço aplicável.',
    false,
    false,
    false,
    true,
    true,
    true,
    54,
    ARRAY['Lei 10.826/2003', 'IN DG/PF 201', 'IN DG/PF 311']
  ),
  (
    'documento_complementar_caso',
    'efetiva_necessidade',
    'complementar',
    'processo',
    'Documento complementar do caso',
    'Anexo complementar para reforço da análise do caso concreto.',
    false,
    false,
    false,
    false,
    true,
    true,
    71,
    ARRAY['Lei 10.826/2003', 'IN DG/PF 201']
  ),
  (
    'oficio',
    'documentos_processo',
    'oficio',
    'processo',
    'Ofício',
    'Documento processual específico do protocolo atual.',
    false,
    false,
    false,
    false,
    true,
    true,
    100,
    ARRAY['IN DG/PF 201', 'IN DG/PF 311']
  )
ON CONFLICT (tipo_documento) DO UPDATE
SET
  categoria_hub = EXCLUDED.categoria_hub,
  subcategoria_hub = EXCLUDED.subcategoria_hub,
  escopo_documental = EXCLUDED.escopo_documental,
  label_publico = EXCLUDED.label_publico,
  descricao_upload = EXCLUDED.descricao_upload,
  aceita_ia = EXCLUDED.aceita_ia,
  aceita_vinculo_arma = EXCLUDED.aceita_vinculo_arma,
  exige_validade = EXCLUDED.exige_validade,
  reaproveitavel_global = EXCLUDED.reaproveitavel_global,
  revisao_humana_obrigatoria = EXCLUDED.revisao_humana_obrigatoria,
  ativo = EXCLUDED.ativo,
  ordem = EXCLUDED.ordem,
  fonte_normativa = EXCLUDED.fonte_normativa,
  updated_at = now();

UPDATE public.qa_tipos_documento_catalogo
SET
  label_publico = CASE tipo_documento
    WHEN 'rg_com_cpf' THEN 'RG com CPF'
    WHEN 'comprovante_residencia' THEN 'Comprovante de residência'
    WHEN 'declaracao_responsavel_imovel' THEN 'Declaração do responsável pelo imóvel'
    WHEN 'comprovante_efetiva_necessidade' THEN 'Comprovação de efetiva necessidade'
    WHEN 'comprovante_habitualidade' THEN 'Comprovante de habitualidade'
    WHEN 'comprovante_clube_tiro' THEN 'Comprovante de clube / entidade'
    WHEN 'comprovante_competicao' THEN 'Comprovante de competição / atividade'
    WHEN 'protocolo_processo' THEN 'Protocolo do processo'
    WHEN 'despacho' THEN 'Despacho / movimentação'
    WHEN 'exigencia' THEN 'Exigência administrativa'
    WHEN 'indeferimento' THEN 'Indeferimento'
    WHEN 'procuracao' THEN 'Procuração'
    WHEN 'recurso_administrativo_doc' THEN 'Recurso administrativo'
    WHEN 'mandado_seguranca_doc' THEN 'Mandado de segurança / peça jurídica'
    ELSE label_publico
  END,
  categoria_hub = CASE
    WHEN tipo_documento IN ('procuracao', 'recurso_administrativo_doc', 'mandado_seguranca_doc') THEN 'documentos_processo'
    ELSE categoria_hub
  END,
  subcategoria_hub = CASE
    WHEN tipo_documento = 'procuracao' THEN 'procuracao'
    WHEN tipo_documento = 'recurso_administrativo_doc' THEN 'recurso'
    WHEN tipo_documento = 'mandado_seguranca_doc' THEN 'mandado'
    ELSE subcategoria_hub
  END,
  escopo_documental = CASE
    WHEN tipo_documento IN ('procuracao', 'recurso_administrativo_doc', 'mandado_seguranca_doc') THEN 'processo'
    ELSE escopo_documental
  END,
  reaproveitavel_global = CASE
    WHEN tipo_documento IN ('procuracao', 'recurso_administrativo_doc', 'mandado_seguranca_doc') THEN false
    ELSE reaproveitavel_global
  END,
  revisao_humana_obrigatoria = CASE
    WHEN tipo_documento IN (
      'declaracao_correlata',
      'documento_complementar_caso',
      'oficio',
      'procuracao',
      'recurso_administrativo_doc',
      'mandado_seguranca_doc'
    ) THEN true
    ELSE revisao_humana_obrigatoria
  END,
  updated_at = now()
WHERE tipo_documento IN (
  'rg_com_cpf',
  'comprovante_residencia',
  'declaracao_responsavel_imovel',
  'comprovante_efetiva_necessidade',
  'comprovante_habitualidade',
  'comprovante_clube_tiro',
  'comprovante_competicao',
  'protocolo_processo',
  'despacho',
  'exigencia',
  'indeferimento',
  'procuracao',
  'recurso_administrativo_doc',
  'mandado_seguranca_doc'
);

UPDATE public.qa_documentos_cliente d
SET
  categoria_hub = c.categoria_hub,
  subcategoria_hub = c.subcategoria_hub,
  escopo_documental = c.escopo_documental,
  reaproveitavel_global = c.reaproveitavel_global,
  revisao_humana_obrigatoria = c.revisao_humana_obrigatoria,
  fonte_normativa = c.fonte_normativa
FROM public.qa_tipos_documento_catalogo c
WHERE lower(d.tipo_documento) = c.tipo_documento
  AND (
    d.categoria_hub IS DISTINCT FROM c.categoria_hub OR
    d.subcategoria_hub IS DISTINCT FROM c.subcategoria_hub OR
    d.escopo_documental IS DISTINCT FROM c.escopo_documental OR
    d.reaproveitavel_global IS DISTINCT FROM c.reaproveitavel_global OR
    d.revisao_humana_obrigatoria IS DISTINCT FROM c.revisao_humana_obrigatoria OR
    d.fonte_normativa IS DISTINCT FROM c.fonte_normativa
  );

COMMIT;
