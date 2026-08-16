-- ============================================================================
-- ACESSO AO GOV.BR — exigência própria no serviço 60 (Bloco 2)
-- ----------------------------------------------------------------------------
-- O protocolo do requerimento é feito no site da Polícia Federal com a conta do
-- PRÓPRIO cliente: não existe acesso de despachante. Sem a senha dele, o dossiê
-- fica pronto e parado.
--
-- Hoje isso é resolvido por fora — nos zips que a equipe usa há um arquivo
-- "Senha do GOV.txt" em texto puro, dentro da pasta do cliente. Esta exigência
-- traz o passo para dentro do sistema: o cliente digita no portal, a senha
-- entra cifrada em AES-GCM no cofre que já existe (`qa_cliente_credenciais`) e
-- cada uso fica registrado em `qa_senha_gov_acessos`.
--
-- ATENÇÃO — este item NÃO é upload de arquivo. Não existe PDF para o cliente
-- mandar. Quem marca a linha como cumprida é a edge `qa-senha-gov-cliente`, no
-- momento em que a senha é guardada. Se alguém trocar o fluxo para exigir
-- arquivo, o passo trava para sempre.
--
-- Fica no mesmo grupo do requerimento e da GRU: é a mesma etapa da vida do
-- processo — gerar o requerimento, pagar a taxa, liberar o acesso.
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
       'credencial_gov_br',
       'Acesso ao gov.br para protocolar',
       req.etapa,
       req.ordem + 2,          -- depois do requerimento e da GRU
       true,
       req.obrigatorio_etapa02,
       req.emissor,
       req.escopo,
       req.formato_aceito,
       true,
       'gov.br',
       'O protocolo na Polícia Federal é feito na sua conta gov.br — não existe acesso de '
       || 'despachante. Informe a sua senha aqui no portal: ela é guardada criptografada, '
       || 'ninguém da equipe consegue vê-la na tela, e todo uso fica registrado. '
       || 'Se a sua conta tem verificação em duas etapas, a equipe vai pedir UMA vez o código '
       || 'de acesso gerado no aplicativo gov.br — depois disso o navegador dela fica '
       || 'autorizado e o código não é mais necessário. Você pode remover esse acesso quando '
       || 'quiser, no app gov.br, em Segurança da conta.',
       'Não é envio de arquivo: você digita a senha no portal e o passo se resolve sozinho. '
       || 'Se trocar a senha no gov.br, atualize aqui — senão o processo para.',
       -- Mesmo grupo do requerimento no checklist guiado, na posição seguinte à GRU.
       '{"grupo_checklist":"requerimento","ordem_grupo_checklist":72,"sem_upload":true}',
       req.grupo_id,
       NULL
  FROM public.qa_servicos_documentos req
 WHERE req.servico_id = 60
   AND req.tipo_documento = 'requerimento_de_posse_de_arma_de_fogo'
   AND req.ativo
   AND NOT EXISTS (
     SELECT 1
       FROM public.qa_servicos_documentos g
      WHERE g.servico_id = 60
        AND g.tipo_documento = 'credencial_gov_br'
   );

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- Tem que voltar TRÊS linhas, nesta ordem: requerimento, GRU, acesso gov.br.
--
-- SELECT tipo_documento, nome_documento, ordem, obrigatorio, ativo,
--        regra_validacao ->> 'ordem_grupo_checklist' AS ordem_no_grupo
--   FROM public.qa_servicos_documentos
--  WHERE servico_id = 60
--    AND tipo_documento IN ('requerimento_de_posse_de_arma_de_fogo', 'gru', 'credencial_gov_br')
--  ORDER BY ordem;
