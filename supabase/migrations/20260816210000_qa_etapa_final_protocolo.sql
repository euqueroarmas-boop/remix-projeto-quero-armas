-- ============================================================================
-- ETAPA FINAL — o que só aparece no dia de protocolar
-- ----------------------------------------------------------------------------
-- Dois passos do checklist não fazem sentido enquanto o cliente ainda está
-- juntando certidão:
--
--   * ACESSO AO GOV.BR — o código de verificação em duas etapas vale poucos
--     minutos. Pedir antes da hora é pedir algo que expira antes de servir.
--   * JUNTADA ASSINADA — só existe depois que a equipe montar o dossiê
--     completo com a petição. Antes disso não há o que assinar.
--
-- Marcar `etapa_final` no `regra_validacao` tira os dois da FILA do cliente
-- até a equipe colocar o processo em "pronto para protocolar". Eles continuam
-- no catálogo desde o começo (contam no total do processo, o cliente vê que
-- existem), mas só viram tarefa quando têm o que fazer.
--
-- A ordem no dia do protocolo é: a equipe monta a juntada → o cliente assina a
-- juntada com o gov.br dele e devolve → o sistema confere a cadeia de
-- certificados ICP-Brasil → o cliente gera o código → a equipe protocola.
--
-- Reexecutável.
-- ============================================================================

BEGIN;

-- 1) Acesso ao gov.br passa a ser etapa final.
UPDATE public.qa_servicos_documentos
SET regra_validacao = COALESCE(regra_validacao, '{}'::jsonb) || '{"etapa_final":true}'::jsonb,
    updated_at = now()
WHERE ativo
  AND tipo_documento IN ('credencial_gov_br', 'senha_gov_br', 'acesso_gov_br');

-- 2) Juntada final assinada pelo cliente no gov.br.
--    Este É upload de arquivo: o cliente baixa o dossiê montado, assina no
--    assinador do gov.br e devolve o PDF assinado. A validação da cadeia usa a
--    edge `qa-validate-govbr-signature`, que já existe e já reconhece as
--    autoridades ICP-Brasil.
INSERT INTO public.qa_servicos_documentos (
  servico_id, tipo_documento, nome_documento, etapa, ordem,
  obrigatorio, obrigatorio_etapa02, emissor, escopo, formato_aceito,
  ativo, orgao_emissor, instrucoes, observacoes_cliente,
  regra_validacao, grupo_id, biblioteca_id
)
SELECT req.servico_id,
       'juntada_assinada',
       'Juntada final assinada no gov.br',
       req.etapa,
       req.ordem + 3,          -- depois do requerimento, da GRU e do acesso
       true,
       req.obrigatorio_etapa02,
       req.emissor,
       req.escopo,
       ARRAY['application/pdf']::text[],
       true,
       'gov.br',
       'Este é o último passo. A nossa equipe junta todos os seus documentos com a petição num '
       || 'arquivo único — a juntada. Você baixa esse arquivo, assina com o seu gov.br no '
       || 'assinador oficial (assinador.iti.br) e devolve aqui. O sistema confere a assinatura e '
       || 'a cadeia de certificados antes de liberar o envio à Polícia Federal. '
       || 'Assine sem alterar o arquivo: qualquer edição depois da assinatura a invalida.',
       'É o arquivo fechado que vai para a delegacia. Assine e devolva sem renomear nem editar.',
       '{"grupo_checklist":"requerimento","ordem_grupo_checklist":73,"etapa_final":true,"exige_assinatura_govbr":true}',
       req.grupo_id,
       NULL
  FROM public.qa_servicos_documentos req
 WHERE req.servico_id = 60
   AND req.tipo_documento = 'requerimento_de_posse_de_arma_de_fogo'
   AND req.ativo
   AND NOT EXISTS (
     SELECT 1
       FROM public.qa_servicos_documentos j
      WHERE j.servico_id = 60
        AND j.tipo_documento = 'juntada_assinada'
   );

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- Quatro linhas, nesta ordem, e as duas últimas com etapa_final = true:
--
-- SELECT tipo_documento, nome_documento, ordem,
--        regra_validacao ->> 'ordem_grupo_checklist' AS ordem_no_grupo,
--        regra_validacao ->> 'etapa_final'           AS etapa_final
--   FROM public.qa_servicos_documentos
--  WHERE servico_id = 60
--    AND tipo_documento IN ('requerimento_de_posse_de_arma_de_fogo', 'gru',
--                           'credencial_gov_br', 'juntada_assinada')
--  ORDER BY ordem;
