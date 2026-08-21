-- ============================================================================
-- AUTORIZAÇÃO DE COMPRA (50): a arma e a loja entram pelo checklist
-- ----------------------------------------------------------------------------
-- Regra do titular (20/08/2026): hoje a equipe pede o CONTRATO DA ARMA do
-- cliente — nele vêm os dados da arma e o CNPJ da loja onde ele vai comprar.
-- Quando ainda não comprou, pede-se que ele defina onde irá comprar. Sem isso
-- não dá para abrir o pedido no SINARM CAC: a loja e a arma saem impressas na
-- autorização (seções 3 e 4 do formulário do SisGCorp).
--
-- O QUE ESTE BLOCO FAZ — duas linhas novas no serviço 50, e só nele:
--   1. a PERGUNTA "você já fechou com a loja a arma que vai comprar?";
--   2. o UPLOAD do contrato/pedido da loja, cobrado só de quem responde SIM.
--      Quem responde NÃO segue no checklist normalmente — a definição da loja
--      é conversa com a equipe antes de abrir o pedido, e a observação da
--      pergunta diz exatamente isso ao cliente.
--
-- Nenhum tipo novo no vocabulário: o upload usa `documento_complementar_caso`,
-- que já existe no CHECK do hub. Processos abertos NÃO são tocados (regra do
-- titular: checklist novo é daqui pra frente).
--
-- Reexecutável.
-- ============================================================================

BEGIN;

INSERT INTO public.qa_servicos_documentos (
  servico_id, tipo_documento, nome_documento, etapa, ordem, obrigatorio,
  obrigatorio_etapa02, ativo, emissor, escopo, formato_aceito,
  condicao_profissional, condicao_modalidade, validade_dias, orgao_emissor,
  instrucoes, observacoes_cliente, regra_validacao
)
SELECT 50, v.tipo, v.nome, 'complementar', v.ordem, v.obrigatorio,
       false, true, 'cliente', 'processo', v.formatos,
       NULL, NULL, NULL, NULL,
       v.instrucoes, v.observacoes, v.regra
  FROM (VALUES
    ('pergunta_arma_loja_definida',
     'Você já fechou com a loja a arma que vai comprar?',
     433, true, ARRAY[]::text[],
     'A arma (marca, modelo e calibre) e a loja (CNPJ) saem impressas na autorização — '
     || 'sem elas não dá para abrir o pedido no SINARM CAC.',
     'Se ainda não escolheu, sem problema: responda NÃO e a equipe define com você '
     || 'a loja e a arma antes de abrir o pedido.',
     jsonb_build_object(
       'tipo',  'pergunta',
       'chave', 'arma_loja_definida',
       'opcoes', jsonb_build_array(
         jsonb_build_object('valor','sim','label','SIM — tenho o contrato ou pedido da loja'),
         jsonb_build_object('valor','nao','label','NÃO — ainda vou escolher com a equipe')),
       'grupo_checklist', 'arma',
       'ordem_grupo_checklist', 54)),
    ('documento_complementar_caso',
     'Contrato ou pedido da loja (dados da arma e CNPJ)',
     435, true, ARRAY['pdf','jpg','jpeg','png'],
     'É o documento da loja com a arma escolhida — marca, modelo, calibre — e o CNPJ dela. '
     || 'É dele que a equipe tira os dados para abrir o pedido no SINARM CAC.',
     'Vale contrato, pedido ou orçamento assinado/emitido pela loja.',
     jsonb_build_object(
       'grupo_checklist', 'arma',
       'ordem_grupo_checklist', 54,
       'exige_quando', jsonb_build_object('arma_loja_definida', 'sim'),
       'depende_de',   jsonb_build_object('chave', 'arma_loja_definida',
                                          'valor', 'sim')))
  ) AS v(tipo, nome, ordem, obrigatorio, formatos, instrucoes, observacoes, regra)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.qa_servicos_documentos sd
    WHERE sd.servico_id = 50
      AND sd.tipo_documento = v.tipo
      AND sd.condicao_profissional IS NULL
 );

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- As duas linhas novas, com a pergunta trazendo chave e opções:
--
-- SELECT ordem, tipo_documento, nome_documento, obrigatorio,
--        regra_validacao ->> 'chave'        AS chave,
--        regra_validacao -> 'exige_quando'  AS exige_quando
--   FROM public.qa_servicos_documentos
--  WHERE servico_id = 50 AND ativo
--    AND tipo_documento IN ('pergunta_arma_loja_definida','documento_complementar_caso')
--  ORDER BY ordem;
