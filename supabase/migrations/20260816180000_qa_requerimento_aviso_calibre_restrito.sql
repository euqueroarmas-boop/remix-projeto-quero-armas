-- ============================================================================
-- REQUERIMENTO — aviso do calibre restrito no texto do cliente
-- ----------------------------------------------------------------------------
-- Calibre restrito só pode ser vendido a segurança pública. Se o cliente
-- escolher um na lista do SINARM, a Polícia Federal indefere DE OFÍCIO: não
-- abre a documentação, não analisa nada. Certidões, laudos, exame de tiro e
-- petição são perdidos por causa de um item de menu, e o processo recomeça do
-- zero — com taxa nova.
--
-- É o único erro deste passo que NENHUMA conferência nossa pega depois: quando
-- o requerimento chega para a equipe, a escolha já foi feita e o pedido já
-- está condenado. Por isso o aviso entra também no texto do banco, não só na
-- tela do roteiro — ele precisa aparecer em qualquer lugar onde o cliente leia
-- sobre este documento.
--
-- Permitidos mais vendidos (lista do SINARM):
--   Pistola   → .22 Long Rifle (.22 LR), .380 ACP, .38 TPC
--   Revólver  → .38 SPL
--   Escopeta  → 12 GA
--
-- Reexecutável: os textos são REESCRITOS por inteiro, nunca concatenados —
-- append duplicaria o aviso a cada colagem.
-- ============================================================================

BEGIN;

UPDATE public.qa_documentos_biblioteca
SET descricao_como_enviar =
      'Este requerimento não tem modelo para baixar: ele é preenchido no site da Polícia Federal, com o seu gov.br.' || chr(10)
      || 'Abra o roteiro aqui no portal — ele traz os seus dados na mesma ordem dos campos do site da PF, cada um com botão de copiar.' || chr(10)
      || 'ATENÇÃO AO CALIBRE: depois dos seus dados o site pede a espécie e o calibre da arma. Calibre restrito é indeferido de ofício, sem análise da sua documentação. Permitidos mais vendidos — Pistola: .22 LR, .380 ACP ou .38 TPC. Revólver: .38 SPL. Escopeta: 12 GA.' || chr(10)
      || 'Ao terminar, clique em "Imprimir Requerimento" e baixe o arquivo (3 páginas, a via da Polícia Federal). Envie esse PDF aqui.' || chr(10)
      || 'NÃO pague a taxa ainda. A nossa equipe confere o que você digitou contra o seu cadastro e libera o pagamento.' || chr(10)
      || 'Depois da liberação você paga a GRU e envia o boleto com o comprovante.',
    observacao_cliente =
      'Calibre restrito reprova o pedido na hora, sem ninguém olhar a documentação. '
      || 'Na dúvida, fale com a nossa equipe ANTES de escolher no site. '
      || 'Copie os dados do roteiro em vez de digitar de cabeça: endereço ou nome divergente '
      || 'do que consta nos seus documentos é motivo de exigência da Polícia Federal.',
    updated_at = now()
WHERE ativo
  AND codigo IN (
    'requerimento_de_posse_de_arma_de_fogo',
    'requerimento_posse_arma_fogo',
    'requerimento_posse',
    'requerimento_sinarm'
  );

UPDATE public.qa_servicos_documentos
SET instrucoes =
      'Você mesmo gera este requerimento no site da Polícia Federal, com o seu gov.br — '
      || 'não existe modelo para baixar. Abra o roteiro no portal: os seus dados aparecem '
      || 'na ordem dos campos do site, prontos para copiar. '
      || 'CUIDADO COM O CALIBRE: escolher calibre restrito faz a PF indeferir de ofício, sem '
      || 'analisar nenhum documento. Permitidos mais vendidos — Pistola: .22 LR, .380 ACP ou '
      || '.38 TPC. Revólver: .38 SPL. Escopeta: 12 GA. '
      || 'Gere o requerimento, baixe as 3 páginas da via da Polícia Federal e envie aqui. '
      || 'NÃO pague a taxa antes da nossa conferência — requerimento com dado errado é refeito '
      || 'do zero, e a taxa paga não volta.',
    observacoes_cliente =
      'Calibre restrito reprova o pedido na hora. Validade de 30 dias a partir da emissão. '
      || 'Envie primeiro, pague depois da nossa liberação.',
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
-- As duas linhas têm que mencionar calibre:
--
-- SELECT 'biblioteca' AS origem, codigo AS chave,
--        descricao_como_enviar ILIKE '%calibre%' AS fala_de_calibre
--   FROM public.qa_documentos_biblioteca
--  WHERE codigo LIKE 'requerimento%'
-- UNION ALL
-- SELECT 'exigencia', tipo_documento, instrucoes ILIKE '%calibre%'
--   FROM public.qa_servicos_documentos
--  WHERE tipo_documento LIKE 'requerimento%';
