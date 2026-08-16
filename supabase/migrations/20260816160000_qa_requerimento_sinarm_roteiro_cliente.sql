-- ============================================================================
-- REQUERIMENTO DO SINARM — texto do cliente alinhado ao fluxo real
-- ----------------------------------------------------------------------------
-- O que estava errado (medido no banco em 16/08/2026):
--
--   * A Biblioteca mandava "Baixe o modelo do requerimento no Hub Documental".
--     Esse modelo NUNCA existiu — `link_modelo` e `modelo_url` sempre estiveram
--     nulos. O cliente clicava, não achava nada, e o passo morria ali. É a
--     razão de `qa_documentos_cliente` não ter UM ÚNICO requerimento entregue.
--
--   * A exigência do serviço dizia o OPOSTO: "Não se preocupe. A nossa equipe
--     solicitara o seu requerimento". Duas instruções contraditórias na mesma
--     tela.
--
--   * `validade_dias = 15`. Nos requerimentos reais conferidos, a validade é de
--     30 dias contados da emissão (25/09→26/10 e 14/01→14/02). Os 15 dias não
--     se confirmaram em nenhum documento.
--
-- Fluxo correto, que os textos abaixo passam a descrever:
--   1. O cliente preenche o requerimento DENTRO do SINARM, com o gov.br dele
--      (não existe modelo para baixar — o formulário é do site da PF).
--   2. Baixa a via da Polícia Federal (3 páginas) e envia para nós.
--   3. NÃO paga a taxa. A equipe confere contra o cadastro e libera.
--   4. Liberado, ele paga a GRU e envia o boleto + comprovante.
--
-- Reexecutável. Somente UPDATE de texto — nenhuma estrutura é alterada.
-- ============================================================================

BEGIN;

-- 1) Biblioteca de documentos: é daqui que sai o passo a passo do pop-up.
UPDATE public.qa_documentos_biblioteca
SET descricao_o_que_e =
      'É o formulário oficial da Polícia Federal que abre o processo. '
      || 'Ele é preenchido e gerado dentro do SINARM, o sistema da PF, '
      || 'com o seu login gov.br.',
    descricao_como_enviar =
      'Este requerimento não tem modelo para baixar: ele é preenchido no site da Polícia Federal, com o seu gov.br.' || chr(10)
      || 'Abra o roteiro aqui no portal — ele traz os seus dados na mesma ordem dos campos do site da PF, cada um com botão de copiar.' || chr(10)
      || 'Ao terminar, clique em "Imprimir Requerimento" e baixe o arquivo (3 páginas, a via da Polícia Federal). Envie esse PDF aqui.' || chr(10)
      || 'NÃO pague a taxa ainda. A nossa equipe confere o que você digitou contra o seu cadastro e libera o pagamento.' || chr(10)
      || 'Depois da liberação você paga a GRU e envia o boleto com o comprovante.',
    observacao_cliente =
      'Copie os dados do roteiro em vez de digitar de cabeça. Endereço ou nome '
      || 'divergente do que consta nos seus documentos é motivo de exigência da '
      || 'Polícia Federal e atrasa o processo em pelo menos 10 dias.',
    validade_dias = 30,
    base_legal = COALESCE(NULLIF(base_legal, ''), 'IN DG/PF 201'),
    updated_at = now()
WHERE ativo
  AND codigo IN (
    'requerimento_de_posse_de_arma_de_fogo',
    'requerimento_posse_arma_fogo',
    'requerimento_posse',
    'requerimento_sinarm'
  );

-- 2) Exigência do serviço: tira o "não se preocupe, a equipe faz" que
--    contradizia a Biblioteca e desligava o cliente do passo.
UPDATE public.qa_servicos_documentos
SET instrucoes =
      'Você mesmo gera este requerimento no site da Polícia Federal, com o seu gov.br — '
      || 'não existe modelo para baixar. Abra o roteiro no portal: os seus dados aparecem '
      || 'na ordem dos campos do site, prontos para copiar. Gere o requerimento, baixe as '
      || '3 páginas da via da Polícia Federal e envie aqui. NÃO pague a taxa antes da nossa '
      || 'conferência — requerimento com dado errado é refeito do zero, e a taxa paga não volta.',
    observacoes_cliente =
      'Validade de 30 dias a partir da emissão. Envie primeiro, pague depois da nossa liberação.',
    validade_dias = 30,
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
-- Depois de rodar, esta consulta tem que mostrar os textos novos e validade 30,
-- e NENHUMA menção a "Baixe o modelo" ou "não se preocupe":
--
-- SELECT 'biblioteca' AS origem, codigo AS chave, validade_dias,
--        descricao_como_enviar AS texto
--   FROM public.qa_documentos_biblioteca
--  WHERE codigo LIKE 'requerimento%'
-- UNION ALL
-- SELECT 'exigencia', tipo_documento, validade_dias, instrucoes
--   FROM public.qa_servicos_documentos
--  WHERE tipo_documento LIKE 'requerimento%';
