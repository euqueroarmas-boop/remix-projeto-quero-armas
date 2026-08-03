
-- 1) Serviços que possuem a pergunta de titularidade do comprovante
WITH svc AS (
  SELECT DISTINCT servico_id FROM public.qa_servicos_documentos
  WHERE tipo_documento = 'pergunta_comprovante_em_nome' AND ativo
),
base AS (
  SELECT s.servico_id,
         COALESCE((SELECT ordem FROM public.qa_servicos_documentos d
                   WHERE d.servico_id = s.servico_id AND d.tipo_documento='pergunta_comprovante_em_nome' AND d.ativo
                   ORDER BY d.ordem LIMIT 1), 30) AS ord0
  FROM svc s
)
-- 2) Reordena o bloco de endereço em passos de 10 a partir da pergunta base
UPDATE public.qa_servicos_documentos d
SET ordem = b.ord0 + CASE d.tipo_documento
      WHEN 'comprovante_residencia' THEN 10
      WHEN 'documento_identificacao_terceiro' THEN 20
      WHEN 'pergunta_ainda_reside_imovel' THEN 50
      WHEN 'declaracao_responsavel_imovel' THEN 60
    END,
    updated_at = now()
FROM base b
WHERE d.servico_id = b.servico_id
  AND d.tipo_documento IN ('comprovante_residencia','documento_identificacao_terceiro','pergunta_ainda_reside_imovel','declaracao_responsavel_imovel');

-- 3) Cria a pergunta de ESTADO CIVIL do terceiro onde ainda não existe
INSERT INTO public.qa_servicos_documentos
  (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, emissor, escopo, regra_validacao)
SELECT b.servico_id, 'pergunta_titular_estado_civil',
       'Qual o estado civil do titular do comprovante?',
       'complementar', true, b.ord0 + 30, true, 'cliente', 'processo',
       jsonb_build_object(
         'tipo','pergunta',
         'chave','titular_estado_civil',
         'grupo_checklist','endereco',
         'ordem_grupo_checklist',20,
         'depende_de', jsonb_build_object('chave','comprovante_em_nome_titular','valor','nao'),
         'opcoes', jsonb_build_array(
           jsonb_build_object('valor','solteiro','label','SOLTEIRO(A)'),
           jsonb_build_object('valor','casado','label','CASADO(A)'),
           jsonb_build_object('valor','divorciado','label','DIVORCIADO(A)'),
           jsonb_build_object('valor','viuvo','label','VIÚVO(A)'),
           jsonb_build_object('valor','uniao_estavel','label','UNIÃO ESTÁVEL')
         )
       )
FROM (
  SELECT DISTINCT sd.servico_id,
         (SELECT ordem FROM public.qa_servicos_documentos d2
          WHERE d2.servico_id = sd.servico_id AND d2.tipo_documento='pergunta_comprovante_em_nome' AND d2.ativo
          ORDER BY d2.ordem LIMIT 1) AS ord0
  FROM public.qa_servicos_documentos sd
  WHERE sd.tipo_documento='pergunta_comprovante_em_nome' AND sd.ativo
) b
WHERE NOT EXISTS (
  SELECT 1 FROM public.qa_servicos_documentos e
  WHERE e.servico_id = b.servico_id AND e.tipo_documento='pergunta_titular_estado_civil'
);

-- 4) Cria a pergunta de PROFISSÃO do terceiro onde ainda não existe
INSERT INTO public.qa_servicos_documentos
  (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, emissor, escopo, regra_validacao)
SELECT b.servico_id, 'pergunta_titular_profissao',
       'Qual a profissão do titular do comprovante?',
       'complementar', true, b.ord0 + 40, true, 'cliente', 'processo',
       jsonb_build_object(
         'tipo','pergunta',
         'chave','titular_profissao',
         'entrada','texto',
         'grupo_checklist','endereco',
         'ordem_grupo_checklist',20,
         'depende_de', jsonb_build_object('chave','comprovante_em_nome_titular','valor','nao')
       )
FROM (
  SELECT DISTINCT sd.servico_id,
         (SELECT ordem FROM public.qa_servicos_documentos d2
          WHERE d2.servico_id = sd.servico_id AND d2.tipo_documento='pergunta_comprovante_em_nome' AND d2.ativo
          ORDER BY d2.ordem LIMIT 1) AS ord0
  FROM public.qa_servicos_documentos sd
  WHERE sd.tipo_documento='pergunta_comprovante_em_nome' AND sd.ativo
) b
WHERE NOT EXISTS (
  SELECT 1 FROM public.qa_servicos_documentos e
  WHERE e.servico_id = b.servico_id AND e.tipo_documento='pergunta_titular_profissao'
);

-- 5) Garante a dependência do "ainda reside" e da declaração ao comprovante de terceiro
UPDATE public.qa_servicos_documentos
SET regra_validacao = COALESCE(regra_validacao,'{}'::jsonb)
      || jsonb_build_object('depende_de', jsonb_build_object('chave','comprovante_em_nome_titular','valor','nao'))
      || jsonb_build_object('grupo_checklist','endereco','ordem_grupo_checklist',20),
    updated_at = now()
WHERE tipo_documento IN ('pergunta_ainda_reside_imovel','declaracao_responsavel_imovel','documento_identificacao_terceiro')
  AND servico_id IN (SELECT DISTINCT servico_id FROM public.qa_servicos_documentos WHERE tipo_documento='pergunta_comprovante_em_nome' AND ativo);
