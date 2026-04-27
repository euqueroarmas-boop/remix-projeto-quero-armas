-- 1) Coluna para condição profissional (rastreia o tipo usado na geração do checklist)
ALTER TABLE public.qa_processos
  ADD COLUMN IF NOT EXISTS condicao_profissional text;

-- 2) Limpar TODAS as certidões antigas (genéricas) em processos AINDA não validados
DELETE FROM public.qa_processo_documentos
WHERE tipo_documento IN (
  'certidoes_negativas',
  'certidao_civel',
  'certidao_criminal_federal',
  'certidao_criminal_estadual',
  'certidao_militar',
  'certidao_eleitoral'
)
AND status IN ('pendente','enviado','em_analise','revisao_humana','divergente','invalido');

-- 3) Inserir as 8 certidões granulares para cada processo aberto que use os serviços PF (2,3,26)
--    (apenas processos que ainda estão antes da aprovação final)
WITH novos_tipos AS (
  SELECT * FROM (VALUES
    ('certidao_crimes_eleitorais_tse',
     'Certidão Negativa de Crimes Eleitorais (TSE)',
     'Emitir Certidão de Crimes Eleitorais',
     'https://www.tse.jus.br/servicos-eleitorais/autoatendimento-eleitoral#/',
     90),
    ('certidao_crimes_militares_stm',
     'Certidão Negativa de Crimes Militares (STM)',
     'Emitir Certidão de Crimes Militares',
     'https://www.stm.jus.br/servicos-ao-cidadao/atendimentoaocidadao/certidao-negativa?view=default',
     90),
    ('certidao_federal_trf3_regional',
     'Certidão Federal TRF3 - Abrangência Regional',
     'Emitir Certidão Federal Regional',
     'https://web.trf3.jus.br/certidao-regional/CertidaoCivelEleitoralCriminal/SolicitarDadosCertidao',
     90),
    ('certidao_federal_trf3_sjsp_jef',
     'Certidão Federal TRF3 - Seção Judiciária e JEF de São Paulo',
     'Emitir Certidão Federal da Seção Judiciária de São Paulo',
     'https://web.trf3.jus.br/certidao-regional/CertidaoCivelEleitoralCriminal/SolicitarDadosCertidao',
     90),
    ('certidao_tjsp_execucoes_criminais',
     'Certidão Estadual TJSP - Execuções Criminais',
     'Emitir Certidão de Execuções Criminais',
     'https://esaj.tjsp.jus.br/sco/abrirCadastro.do',
     60),
    ('certidao_tjsp_distribuicao_criminal',
     'Certidão Estadual TJSP - Distribuição de Ações Criminais',
     'Emitir Certidão de Distribuição Criminal',
     'https://esaj.tjsp.jus.br/sco/abrirCadastro.do',
     60),
    ('certidao_antecedentes_policia_civil_sp',
     'Certidão de Antecedentes da Polícia Civil',
     'Emitir Certidão de Antecedentes da Polícia Civil',
     'https://servicos.sp.gov.br/fcarta/259d189e-dc87-4308-9812-7abed7494412',
     90),
    ('certidao_criminal_tjmsp',
     'Certidão Criminal do TJM-SP',
     'Emitir Certidão da Justiça Militar Estadual',
     'https://certidaocriminal.tjmsp.jus.br',
     90)
  ) AS t(tipo_documento, nome_documento, label_botao, link_emissao, validade_dias)
),
processos_alvo AS (
  SELECT p.id AS processo_id, p.cliente_id
  FROM public.qa_processos p
  WHERE p.servico_id IN (2,3,26)
    AND p.status NOT IN ('concluido','cancelado','aprovado')
)
INSERT INTO public.qa_processo_documentos
  (processo_id, cliente_id, tipo_documento, nome_documento, etapa, obrigatorio,
   status, validade_dias, formato_aceito, regra_validacao, link_emissao)
SELECT
  pa.processo_id,
  pa.cliente_id,
  nt.tipo_documento,
  nt.nome_documento,
  'complementar',
  true,
  'pendente',
  nt.validade_dias,
  ARRAY['pdf'],
  jsonb_build_object(
    'exige', jsonb_build_array('nome_titular','cpf','resultado','data_emissao'),
    'esperado', jsonb_build_object('resultado','NADA_CONSTA'),
    'label_botao', nt.label_botao
  ),
  nt.link_emissao
FROM processos_alvo pa
CROSS JOIN novos_tipos nt
WHERE NOT EXISTS (
  SELECT 1 FROM public.qa_processo_documentos d
  WHERE d.processo_id = pa.processo_id AND d.tipo_documento = nt.tipo_documento
);