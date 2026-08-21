-- =============================================================================
-- LIMPEZA: a pergunta dos 5 anos tinha uma condição que não existe
-- -----------------------------------------------------------------------------
-- Na 20260821080000 a pergunta `pergunta_residencia_5_anos` nasceu com
--
--     'depende_de', jsonb_build_object('documento','comprovante_residencia')
--
-- A intenção era "só perguntar depois que o comprovante chegar". Mas o motor do
-- checklist (itemVisivelGuia, em src/lib/quero-armas/checklistGuiadoEngine.ts)
-- só entende `depende_de` na forma {chave, valor} — uma resposta do
-- questionário, nunca um documento. Com `chave` ausente o teste vira
-- `respostas[undefined] === undefined`, que é TRUE, e o item nunca é escondido.
--
-- Ou seja: a chave é INERTE. Não esconde nada, não quebra nada — só mente para
-- quem for ler a regra depois. Sai daqui.
--
-- A ordem "primeiro o comprovante, depois a pergunta" continua garantida, e por
-- dois mecanismos que de fato existem:
--
--   1. Dentro do grupo `endereco`, o comprovante tem ordem_grupo_checklist 40 e
--      a pergunta 45. O popup guiado do cliente apresenta UM item por vez, na
--      ordem — o comprovante vem antes.
--   2. No formulário público a ordem é física: o comprovante é enviado na etapa
--      1 e a pergunta só aparece na etapa 3, depois da leitura automática.
--
-- Nos serviços 31 e 44 a condição seria inútil de qualquer forma: eles não
-- pedem `comprovante_residencia` no catálogo — usam os comprovantes por ano
-- (`comprovante_endereco_ano_AAAA`) semeados por qa_seed_endereco_5_anos.
--
-- Reexecutável. Não muda comportamento: retira uma chave que nunca fez efeito.
-- =============================================================================

BEGIN;

UPDATE public.qa_servicos_documentos
   SET regra_validacao = regra_validacao - 'depende_de',
       updated_at      = now()
 WHERE tipo_documento = 'pergunta_residencia_5_anos'
   AND regra_validacao ? 'depende_de';

-- As linhas que já foram para dentro dos processos carregam a mesma cópia.
UPDATE public.qa_processo_documentos
   SET regra_validacao = regra_validacao - 'depende_de',
       updated_at      = now()
 WHERE tipo_documento = 'pergunta_residencia_5_anos'
   AND regra_validacao ? 'depende_de';

COMMIT;

-- =============================================================================
-- CONFERÊNCIA (rodar depois)
--
-- Esperado: 4 linhas de catálogo e 10 de processo, todas com depende_de = false.
--
-- SELECT 'catalogo' AS onde, servico_id::text AS ref,
--        (regra_validacao ? 'depende_de') AS ainda_tem_depende_de
--   FROM public.qa_servicos_documentos
--  WHERE tipo_documento = 'pergunta_residencia_5_anos'
--  UNION ALL
-- SELECT 'processo', count(*)::text,
--        bool_or(regra_validacao ? 'depende_de')
--   FROM public.qa_processo_documentos
--  WHERE tipo_documento = 'pergunta_residencia_5_anos';
-- =============================================================================
