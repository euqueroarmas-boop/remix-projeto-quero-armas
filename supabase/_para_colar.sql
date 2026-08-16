-- ############################################################################
-- PARA COLAR NO SQL EDITOR DO SUPABASE — 16/08/2026
-- ----------------------------------------------------------------------------
-- Dois blocos, na ordem. Pode colar os dois de uma vez.
--
--   BLOCO A (20260816240000) — separa boleto e comprovante da GRU
--   BLOCO B (20260816250000) — o Hub passa a aceitar os dois tipos novos
--
-- Os dois sao reexecutaveis: colar de novo nao duplica nada.
-- ############################################################################

-- ===== BLOCO A =============================================================

-- ============================================================================
-- GRU — boleto e comprovante viram DUAS exigências (regra da equipe, 16/08/2026)
-- ----------------------------------------------------------------------------
-- A exigência `gru` nasceu como item único pedindo duas coisas no mesmo passo:
-- "envie a página do boleto e o comprovante de pagamento". No dossiê real eles
-- são DUAS peças separadas — 1.1 boleto, 1.2 comprovante — e o mapa de ordem do
-- protocolo já foi corrigido para isso no código.
--
-- POR QUE NÃO DÁ PARA DEIXAR JUNTO: são dois PDFs distintos, com propósitos
-- distintos. O boleto prova o valor e o código da taxa; o comprovante prova que
-- ela foi paga. Um upload só obriga o cliente a mesclar os dois arquivos por
-- conta própria — e quando ele manda um só, o passo aparece cumprido com metade
-- da prova. A conferência da equipe só descobre na hora de montar a juntada.
--
-- O QUE ESTA MIGRATION FAZ:
--   1. Reduz a exigência `gru` existente ao BOLETO (renomeia e reescreve o
--      texto). Ela é mantida, não recriada: já existe processo com documento
--      pendurado nela, e trocar o tipo órfãozaria esses uploads.
--   2. Cria `gru_comprovante` logo depois.
--   3. Renumera acesso ao gov.br e juntada assinada, que ficavam nas posições
--      agora ocupadas.
--
-- A ordem final do grupo "requerimento" passa a ser:
--   requerimento · 71 boleto · 72 comprovante · 73 acesso gov.br · 74 juntada
--
-- Reexecutável.
-- ============================================================================

BEGIN;

-- 1) A exigência que já existe passa a ser SÓ o boleto.
UPDATE public.qa_servicos_documentos
SET nome_documento = 'Boleto da GRU — taxa do requerimento (Polícia Federal)',
    instrucoes =
      'Só pague DEPOIS que a nossa equipe liberar o seu requerimento. '
      || 'O boleto da GRU é gerado no mesmo site da Polícia Federal onde você fez o '
      || 'requerimento, no botão "Boleto" ou "Pagar GRU com PagTesouro". '
      || 'Envie aqui a página do boleto. O comprovante de pagamento é o passo seguinte.',
    observacoes_cliente =
      'Só o boleto neste passo. O comprovante de pagamento vai no passo seguinte.',
    regra_validacao = COALESCE(regra_validacao, '{}'::jsonb)
                      || '{"grupo_checklist":"requerimento","ordem_grupo_checklist":71}'::jsonb,
    updated_at = now()
WHERE servico_id = 60
  AND tipo_documento = 'gru';

-- 2) Comprovante de pagamento — item próprio, imediatamente depois do boleto.
--    biblioteca_id fica NULL de propósito: o código `gru` da biblioteca já está
--    amarrado ao boleto, e apontar os dois para a mesma entrada faria o
--    reaproveitamento do Hub cumprir um passo com o arquivo do outro.
INSERT INTO public.qa_servicos_documentos (
  servico_id, tipo_documento, nome_documento, etapa, ordem,
  obrigatorio, obrigatorio_etapa02, emissor, escopo, formato_aceito,
  ativo, orgao_emissor, instrucoes, observacoes_cliente,
  regra_validacao, grupo_id, biblioteca_id
)
SELECT g.servico_id,
       'gru_comprovante',
       'Comprovante de pagamento da taxa (GRU)',
       g.etapa,
       g.ordem + 1,
       true,
       g.obrigatorio_etapa02,
       g.emissor,
       g.escopo,
       g.formato_aceito,
       true,
       'Polícia Federal',
       'Depois de pagar o boleto da GRU, envie aqui o comprovante de pagamento — o recibo do '
       || 'banco, do aplicativo ou do PagTesouro. Confira se aparece o valor, a data e a '
       || 'confirmação de que o pagamento foi efetivado. Agendamento não vale: o processo só é '
       || 'protocolado com a taxa efetivamente paga.',
       'Sem a taxa paga o processo não é protocolado.',
       '{"grupo_checklist":"requerimento","ordem_grupo_checklist":72}'::jsonb,
       g.grupo_id,
       NULL
  FROM public.qa_servicos_documentos g
 WHERE g.servico_id = 60
   AND g.tipo_documento = 'gru'
   AND g.ativo
   AND NOT EXISTS (
     SELECT 1
       FROM public.qa_servicos_documentos c
      WHERE c.servico_id = 60
        AND c.tipo_documento = 'gru_comprovante'
   );

-- 3) Os dois passos de etapa final descem uma casa — o comprovante entrou na
--    frente deles.
UPDATE public.qa_servicos_documentos
SET ordem = ordem + 1,
    regra_validacao = COALESCE(regra_validacao, '{}'::jsonb)
                      || '{"ordem_grupo_checklist":73}'::jsonb,
    updated_at = now()
WHERE servico_id = 60
  AND tipo_documento = 'credencial_gov_br'
  AND COALESCE(regra_validacao ->> 'ordem_grupo_checklist', '') <> '73';

UPDATE public.qa_servicos_documentos
SET ordem = ordem + 1,
    regra_validacao = COALESCE(regra_validacao, '{}'::jsonb)
                      || '{"ordem_grupo_checklist":74}'::jsonb,
    updated_at = now()
WHERE servico_id = 60
  AND tipo_documento = 'juntada_assinada'
  AND COALESCE(regra_validacao ->> 'ordem_grupo_checklist', '') <> '74';

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- Tem que voltar CINCO linhas: o requerimento e, depois dele, 71/72/73/74.
--
-- SELECT tipo_documento, nome_documento, ordem, obrigatorio, ativo,
--        regra_validacao ->> 'ordem_grupo_checklist' AS ordem_no_grupo,
--        regra_validacao ->> 'etapa_final'           AS etapa_final
--   FROM public.qa_servicos_documentos
--  WHERE servico_id = 60
--    AND tipo_documento IN ('requerimento_de_posse_de_arma_de_fogo', 'gru',
--                           'gru_comprovante', 'credencial_gov_br', 'juntada_assinada')
--  ORDER BY ordem;


-- ===== BLOCO B =============================================================

-- =============================================================================
-- HUB: comprovante da GRU e juntada assinada entram no CHECK
--
-- Dois tipos novos nasceram nas migrations de 16/08/2026 e ficaram sem lugar no
-- vocabulario do Hub:
--
--   gru_comprovante  -- boleto e comprovante da taxa viraram itens SEPARADOS no
--                       dossie (1.1 e 1.2). Sem o tipo no CHECK, o comprovante
--                       so poderia ser gravado como 'outro'.
--   juntada_assinada -- o PDF do dossie fechado, assinado pelo cliente no
--                       gov.br. E o arquivo que efetivamente vai a delegacia;
--                       arquiva-lo como 'outro' apagaria justamente a peca que
--                       precisa ser reencontrada depois.
--
-- Este bloco e ADITIVO: nenhum tipo sai da lista. Os tipos de 20260814180000
-- continuam identicos e os dois novos sao acrescentados.
--
-- Idempotente (DROP IF EXISTS + ADD com lista literal).
-- =============================================================================

BEGIN;

ALTER TABLE public.qa_documentos_cliente
  DROP CONSTRAINT IF EXISTS qa_doc_cliente_tipo_check;

ALTER TABLE public.qa_documentos_cliente
  ADD CONSTRAINT qa_doc_cliente_tipo_check
  CHECK (tipo_documento = ANY (ARRAY[
    'antecedentes_criminais'::text,
    'antecedentes_eleitoral'::text,
    'antecedentes_estadual'::text,
    'antecedentes_estadual_ac'::text,
    'antecedentes_estadual_al'::text,
    'antecedentes_estadual_am'::text,
    'antecedentes_estadual_ap'::text,
    'antecedentes_estadual_ba'::text,
    'antecedentes_estadual_ce'::text,
    'antecedentes_estadual_df'::text,
    'antecedentes_estadual_distribuicao'::text,
    'antecedentes_estadual_es'::text,
    'antecedentes_estadual_execucoes'::text,
    'antecedentes_estadual_go'::text,
    'antecedentes_estadual_ma'::text,
    'antecedentes_estadual_mg'::text,
    'antecedentes_estadual_ms'::text,
    'antecedentes_estadual_mt'::text,
    'antecedentes_estadual_pa'::text,
    'antecedentes_estadual_pb'::text,
    'antecedentes_estadual_pe'::text,
    'antecedentes_estadual_pi'::text,
    'antecedentes_estadual_pr'::text,
    'antecedentes_estadual_rj'::text,
    'antecedentes_estadual_rn'::text,
    'antecedentes_estadual_ro'::text,
    'antecedentes_estadual_rr'::text,
    'antecedentes_estadual_rs'::text,
    'antecedentes_estadual_sc'::text,
    'antecedentes_estadual_se'::text,
    'antecedentes_estadual_sp'::text,
    'antecedentes_estadual_to'::text,
    'antecedentes_federal'::text,
    'antecedentes_federal_sjsp_jef'::text,
    'antecedentes_federal_trf1_regional'::text,
    'antecedentes_federal_trf2_regional'::text,
    'antecedentes_federal_trf3_regional'::text,
    'antecedentes_federal_trf4_regional'::text,
    'antecedentes_federal_trf5_regional'::text,
    'antecedentes_federal_trf6_regional'::text,
    'antecedentes_militar'::text,
    'antecedentes_militar_estadual'::text,
    'atestado_aptidao_psicologica_instituicao'::text,
    'atestado_capacidade_tecnica_instituicao'::text,
    'autorizacao_compra'::text,
    'boletim_ocorrencia'::text,
    'certidao_alteracao_nome'::text,
    'cin'::text,
    'cnh'::text,
    'comprovante_competicao'::text,
    'comprovante_efetiva_necessidade'::text,
    'comprovante_filiacao_entidade_tiro'::text,
    'comprovante_pagamento'::text,
    'comprovante_residencia'::text,
    'contrato_assinado'::text,
    'cr'::text,
    'craf'::text,
    'ctps'::text,
    'declaracao_correlata'::text,
    'declaracao_endereco_acervo'::text,
    'declaracao_guarda_acervo_1endereco'::text,
    'declaracao_guarda_acervo_2enderecos'::text,
    'declaracao_guarda_responsavel'::text,
    'declaracao_homonimia'::text,
    'declaracao_nao_possuir_segundo_endereco'::text,
    'declaracao_responsavel_imovel'::text,
    'declaracao_sem_inquerito_processo_criminal'::text,
    'despacho'::text,
    'documento_complementar_caso'::text,
    'documento_identificacao_terceiro'::text,
    'dsa_declaracao_seguranca_acervo'::text,
    'exigencia'::text,
    'foto_3x4'::text,
    'gru'::text,
    'gru_comprovante'::text,
    'gt'::text,
    'gte'::text,
    'habilitacao_cacador_ibama'::text,
    'indeferimento'::text,
    'juntada_assinada'::text,
    'laudo_capacidade_tecnica'::text,
    'laudo_psicologico'::text,
    'mandado_seguranca_doc'::text,
    'nota_fiscal_arma'::text,
    'oficio'::text,
    'outro'::text,
    'procuracao'::text,
    'procuracao_assinada'::text,
    'protocolo_processo'::text,
    'recurso_administrativo_doc'::text,
    'renda_cartao_cnpj'::text,
    'renda_carteira_funcional'::text,
    'renda_ccmei'::text,
    'renda_cnpj_autonomo'::text,
    'renda_comprovante_beneficio'::text,
    'renda_contra_cheque_mes_atual'::text,
    'renda_contrato_social'::text,
    'renda_extrato_inss'::text,
    'renda_ficha_cadastral_jucesp'::text,
    'renda_holerite_funcionario_publico'::text,
    'renda_holerite_mes_atual'::text,
    'renda_nf_empresa'::text,
    'renda_qsa'::text,
    'requerimento_de_posse_de_arma_de_fogo'::text,
    'rg_com_cpf'::text,
    'sinarm'::text
  ]));

COMMENT ON CONSTRAINT qa_doc_cliente_tipo_check ON public.qa_documentos_cliente IS
  'Vocabulario fechado do Hub. Espelhado em src/lib/quero-armas/documentosHubCatalogo.ts; o teste catalogoHubVsConstraint.test.ts falha se os dois divergirem.';

COMMIT;

-- -- Conferencia: tem que voltar os dois tipos novos dentro do CHECK.
--
-- SELECT pg_get_constraintdef(oid) LIKE '%gru_comprovante%'  AS tem_gru_comprovante,
--        pg_get_constraintdef(oid) LIKE '%juntada_assinada%' AS tem_juntada_assinada
--   FROM pg_constraint
--  WHERE conname = 'qa_doc_cliente_tipo_check';
