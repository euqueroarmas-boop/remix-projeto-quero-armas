-- =============================================================================
-- BLOCO 2C de 7 — CERTIDÕES: o "segundo grau" deixa de ser exigência
--
-- Resposta do usuário (07/08/2026): "2º grau não é cobrado. A PF não exige
-- esse documento."
--
-- Isso resolve a contradição do Bloco 2B por um terceiro caminho: os slots
-- não são "o mesmo documento" nem "documento diferente que precisa de tipo
-- próprio" — eles NÃO DEVEM EXISTIR.
--
-- E o projeto já sabia. O cabeçalho de `certidoesAbrangencia.ts` registra:
--
--     "NÃO EXISTEM certidões de 'segundo grau' neste sistema. Os códigos
--      certidao_estadual_segundo_grau_* foram criados por premissa errada e o
--      usuário já os eliminou em 22/07/2026 (...) Eles sobrevivem apenas como
--      apelido de compatibilidade para checklists antigos; nunca devem voltar
--      a ser exigência visível."
--
-- A decisão é de 22/07. O que a desfez foi 20260730010000, uma semana depois,
-- que criou apelidos tratando os dois como slots vivos e deixou o comentário
-- "TJSP é o segundo grau" — a premissa errada de volta. Este bloco restaura a
-- decisão original.
--
-- ─── Por que os apelidos NÃO são apagados ────────────────────────────────
-- É exatamente o que o cabeçalho descreve como certo: eles existem para que
-- checklist antigo que ainda carregue o slot feche sozinho, em vez de ficar
-- órfão. Apagá-los transformaria exigência invisível em exigência eterna.
--
-- Idempotente.
-- =============================================================================

BEGIN;

-- ─── 1) Some do catálogo — nenhum checklist novo volta a pedir ───────────
UPDATE public.qa_servicos_documentos
   SET ativo = false, updated_at = now()
 WHERE tipo_documento IN (
   'certidao_estadual_segundo_grau_acoes_criminais',
   'certidao_estadual_segundo_grau_execucoes_criminais'
 );

UPDATE public.qa_documentos_biblioteca
   SET ativo = false, updated_at = now()
 WHERE codigo IN (
   'certidao_estadual_segundo_grau_acoes_criminais',
   'certidao_estadual_segundo_grau_execucoes_criminais'
 );

-- ─── 2) Some dos processos em andamento ──────────────────────────────────
-- nao_aplicavel, não apagado: a linha é histórico do processo e pode ter
-- arquivo anexado. O status já conta como cumprido em checklistMetrics, então
-- a exigência sai da contagem de pendências e do checklist do cliente.
UPDATE public.qa_processo_documentos pd
   SET status = 'nao_aplicavel',
       observacoes = COALESCE(pd.observacoes, '') ||
         CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
         '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
         '] Exigência removida: a Polícia Federal não exige certidão de segundo grau.',
       updated_at = now()
  FROM public.qa_processos p
 WHERE p.id = pd.processo_id
   AND pd.tipo_documento IN (
     'certidao_estadual_segundo_grau_acoes_criminais',
     'certidao_estadual_segundo_grau_execucoes_criminais'
   )
   AND pd.status NOT IN ('aprovado','nao_aplicavel')
   AND COALESCE(p.status, '') NOT IN ('finalizado','deferido','indeferido','cancelado');

COMMIT;
