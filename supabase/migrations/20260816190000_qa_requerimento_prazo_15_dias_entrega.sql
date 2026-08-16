-- ============================================================================
-- REQUERIMENTO — o prazo que vale é o de 15 dias, não os 30 impressos
-- ----------------------------------------------------------------------------
-- São DOIS relógios diferentes, e a migration anterior confundiu os dois:
--
--   * "Data de Vencimento" impressa no requerimento → ~30 dias da emissão.
--     É a validade do requerimento em si. Foi o que eu li nos documentos
--     reais (25/09→26/10, 14/01→14/02) e gravei como validade. Errado.
--
--   * Prazo de ENTREGA DA DOCUMENTAÇÃO → 15 dias corridos da emissão.
--     Passado esse prazo sem o dossiê completo, a Polícia Federal marca o
--     requerimento como EXPIRADO — mesmo com a data impressa ainda no futuro.
--     É este o prazo que a operação persegue, e é ele que tem que colorir a
--     badge do cliente.
--
-- Régua da badge (decisão da equipe, 16/08/2026):
--   15 a 10 dias → verde · 9 a 5 → amarelo · 4 a 0 → vermelho
--
-- Ela coincide com a régua de "ciclo curto" que o sistema já usa (crítico ≤4,
-- atenção ≤9), então o requerimento passou a ser tratado como ciclo curto no
-- código — uma régua só, uma cor só, em todas as telas.
--
-- Reexecutável. Só UPDATE de prazo e texto.
-- ============================================================================

BEGIN;

UPDATE public.qa_documentos_biblioteca
SET validade_dias = 15,
    observacao_cliente =
      'Depois de gerar o requerimento você tem 15 dias corridos para a documentação '
      || 'completa chegar à Polícia Federal — passou disso, o pedido expira e recomeça do zero. '
      || 'Calibre restrito reprova o pedido na hora, sem ninguém olhar a documentação: na dúvida, '
      || 'fale com a nossa equipe ANTES de escolher no site. '
      || 'Copie os dados do roteiro em vez de digitar de cabeça — endereço ou nome divergente '
      || 'do que consta nos seus documentos é motivo de exigência.',
    updated_at = now()
WHERE ativo
  AND codigo IN (
    'requerimento_de_posse_de_arma_de_fogo',
    'requerimento_posse_arma_fogo',
    'requerimento_posse',
    'requerimento_sinarm'
  );

UPDATE public.qa_servicos_documentos
SET validade_dias = 15,
    observacoes_cliente =
      'Prazo de 15 dias corridos, contados do dia em que você gerar o requerimento, para a '
      || 'documentação completa chegar à Polícia Federal. Depois disso o pedido expira. '
      || 'Calibre restrito reprova na hora. Envie o requerimento primeiro, pague a taxa '
      || 'depois da nossa liberação.',
    updated_at = now()
WHERE ativo
  AND tipo_documento IN (
    'requerimento_de_posse_de_arma_de_fogo',
    'requerimento_posse_arma_fogo',
    'requerimento_posse',
    'requerimento_sinarm'
  );

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- As duas linhas têm que voltar validade_dias = 15:
--
-- SELECT 'biblioteca' AS origem, codigo AS chave, validade_dias, observacao_cliente
--   FROM public.qa_documentos_biblioteca
--  WHERE codigo LIKE 'requerimento%'
-- UNION ALL
-- SELECT 'exigencia', tipo_documento, validade_dias, observacoes_cliente
--   FROM public.qa_servicos_documentos
--  WHERE tipo_documento LIKE 'requerimento%';
