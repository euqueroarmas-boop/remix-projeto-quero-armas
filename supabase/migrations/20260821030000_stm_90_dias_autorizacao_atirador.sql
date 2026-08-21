-- =============================================================================
-- STM com 90 dias na AUTORIZAÇÃO DE COMPRA — ATIRADOR ESPORTIVO (serviço 50)
-- -----------------------------------------------------------------------------
-- O QUE ESTÁ ERRADO
--
-- A Certidão Criminal da Justiça Militar da União (STM) traz a própria validade
-- impressa: 90 dias. É isso que a tabela única diz (função `qa_prazo_certidao`,
-- migration 20260819140000) e é o que está gravado nos serviços 44 (CR) e 60
-- (posse). No serviço 50 ela está com 30.
--
-- POR QUE ESCAPOU
--
-- O checklist do serviço 50 nasceu em 20/08 (migration 20260820220000) copiando
-- a lista do CR, que tinha 30 ANTES do alinhamento. O alinhamento geral rodou em
-- 19/08 — um dia antes. O serviço 50 nasceu depois e nunca passou por ele.
--
-- Conferido em produção em 21/08/2026:
--   servico_id 44 → 90   ·   servico_id 60 → 90   ·   servico_id 50 → 30
-- É a ÚNICA certidão do serviço 50 fora da tabela única; as outras sete batem.
--
-- O QUE MUDA
--
-- Só a certidão do STM, só no serviço 50. Nenhum outro serviço, nenhum outro
-- tipo de documento, nenhum item entra ou sai de checklist. O prazo só AUMENTA
-- (30 → 90), então ninguém passa a dever documento por causa disto: quem estava
-- marcado como vencido cedo demais volta a valer.
--
-- O valor não é digitado à mão: vem da função `qa_prazo_certidao`, que é a
-- fonte canônica. Se a tabela mudar um dia, esta linha acompanha.
--
-- Idempotente.
-- =============================================================================

BEGIN;

-- ─── 1) O catálogo do serviço 50 ─────────────────────────────────────────────
UPDATE public.qa_servicos_documentos sd
   SET validade_dias = public.qa_prazo_certidao(sd.tipo_documento),
       updated_at    = now()
 WHERE sd.servico_id     = 50
   AND sd.tipo_documento = 'antecedentes_militar'
   AND sd.ativo          = true
   AND sd.validade_dias IS DISTINCT FROM public.qa_prazo_certidao(sd.tipo_documento);

-- ─── 2) Os processos do serviço 50 que já estão abertos ──────────────────────
-- Mesma regra da migration 20260819140000, restrita a este serviço e a este
-- tipo. Processo concluído, cancelado ou apagado por LGPD fica fora.
UPDATE public.qa_processo_documentos pd
   SET validade_dias = public.qa_prazo_certidao(pd.tipo_documento)
  FROM public.qa_processos p
 WHERE p.id             = pd.processo_id
   AND p.servico_id     = 50
   AND pd.tipo_documento = 'antecedentes_militar'
   AND p.status NOT IN ('concluido', 'cancelado', 'excluido_lgpd')
   AND pd.validade_dias IS DISTINCT FROM public.qa_prazo_certidao(pd.tipo_documento);

COMMIT;

-- =============================================================================
-- CONFERÊNCIA (rodar depois, uma de cada vez)
--
-- A) Os três serviços têm de mostrar 90:
--
-- SELECT servico_id, validade_dias
--   FROM public.qa_servicos_documentos
--  WHERE ativo AND tipo_documento = 'antecedentes_militar'
--    AND servico_id IN (44, 50, 60)
--  ORDER BY servico_id;
--
-- B) Nenhuma certidão de nenhum serviço pode estar fora da tabela única
--    (esperado: 0 linhas):
--
-- SELECT servico_id, tipo_documento, validade_dias AS no_catalogo,
--        public.qa_prazo_certidao(tipo_documento) AS pela_tabela
--   FROM public.qa_servicos_documentos
--  WHERE ativo
--    AND public.qa_prazo_certidao(tipo_documento) IS NOT NULL
--    AND validade_dias IS DISTINCT FROM public.qa_prazo_certidao(tipo_documento)
--  ORDER BY servico_id, tipo_documento;
-- =============================================================================
