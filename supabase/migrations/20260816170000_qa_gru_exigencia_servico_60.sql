-- ============================================================================
-- GRU — exigência própria no serviço 60 (Autorização de compra / Posse)
-- ----------------------------------------------------------------------------
-- Hoje a taxa não existe como exigência: o serviço 60 pede o requerimento e
-- mais nada. Mas o protocolo não anda sem a GRU paga — no dossiê real ela é o
-- item 1.1, logo depois do requerimento (o mapa de ordem do protocolo já
-- reserva esse lugar para o tipo `gru`).
--
-- Ela vira a SEGUNDA CHAMADA do passo do requerimento: o cliente só paga
-- depois que a equipe conferir o requerimento gerado. Taxa paga em requerimento
-- com dado errado não volta — o requerimento é refeito do zero, com taxa nova.
--
-- A linha é criada COPIANDO as colunas de convenção (etapa, emissor, escopo,
-- formato aceito, grupo) da exigência do requerimento do mesmo serviço, em vez
-- de chutar valores. Assim ela nasce coerente com o que já está configurado.
--
-- Reexecutável: o NOT EXISTS impede duplicar em nova colagem.
-- ============================================================================

BEGIN;

INSERT INTO public.qa_servicos_documentos (
  servico_id, tipo_documento, nome_documento, etapa, ordem,
  obrigatorio, obrigatorio_etapa02, emissor, escopo, formato_aceito,
  ativo, orgao_emissor, instrucoes, observacoes_cliente,
  regra_validacao, grupo_id, biblioteca_id
)
SELECT req.servico_id,
       'gru',
       'GRU paga — taxa do requerimento (Polícia Federal)',
       req.etapa,
       req.ordem + 1,          -- imediatamente depois do requerimento
       true,
       req.obrigatorio_etapa02,
       req.emissor,
       req.escopo,
       req.formato_aceito,
       true,
       'Polícia Federal',
       'Só pague DEPOIS que a nossa equipe liberar o seu requerimento. '
       || 'O boleto da GRU é gerado no mesmo site da Polícia Federal onde você fez o '
       || 'requerimento, no botão "Boleto" ou "Pagar GRU com PagTesouro". '
       || 'Pague e envie aqui duas coisas: a página do boleto e o comprovante de pagamento.',
       'Envie a página do boleto e o comprovante. Sem a taxa paga o processo não é protocolado.',
       -- Mesmo grupo do requerimento no checklist guiado, na posição seguinte.
       '{"grupo_checklist":"requerimento","ordem_grupo_checklist":71}',
       req.grupo_id,
       (SELECT b.id
          FROM public.qa_documentos_biblioteca b
         WHERE b.ativo AND b.codigo = 'gru'
         LIMIT 1)
  FROM public.qa_servicos_documentos req
 WHERE req.servico_id = 60
   AND req.tipo_documento = 'requerimento_de_posse_de_arma_de_fogo'
   AND req.ativo
   AND NOT EXISTS (
     SELECT 1
       FROM public.qa_servicos_documentos g
      WHERE g.servico_id = 60
        AND g.tipo_documento = 'gru'
   );

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- Tem que voltar DUAS linhas — o requerimento e, logo abaixo, a GRU:
--
-- SELECT tipo_documento, nome_documento, etapa, ordem, obrigatorio, ativo,
--        regra_validacao ->> 'ordem_grupo_checklist' AS ordem_no_grupo
--   FROM public.qa_servicos_documentos
--  WHERE servico_id = 60
--    AND tipo_documento IN ('requerimento_de_posse_de_arma_de_fogo', 'gru')
--  ORDER BY ordem;
