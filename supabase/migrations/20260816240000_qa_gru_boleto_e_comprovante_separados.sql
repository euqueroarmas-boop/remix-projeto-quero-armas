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
