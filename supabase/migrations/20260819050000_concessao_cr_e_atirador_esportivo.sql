-- ============================================================================
-- Concessão de CR = atirador desportivo
-- ----------------------------------------------------------------------------
-- Decisão do titular em 19/08/2026: a Quero Armas vende UM item de Concessão de
-- CR, a R$ 1.239,00, e ele é de atirador esportivo. Colecionador e caçador
-- excepcional não estão à venda.
--
-- Com esta linha o gatilho `qa_trg_processo_modalidade_do_catalogo` passa a
-- carimbar `modalidade = 'atirador'` em todo processo de CR no nascimento, e o
-- checklist do serviço 44 passa a cobrar as duas exigências do inciso II do
-- art. 18, § 2º da IN 311/2025: comprovante de filiação à entidade de tiro e
-- declaração de compromisso de habitualidade.
--
-- O que NÃO muda: o preço (já é 1239 no catálogo e em qa_servicos) e o nome do
-- item na vitrine. As exigências de caçador (documento do Ibama) continuam
-- cadastradas e condicionadas a `cacador` — ficam dormindo, sem aparecer para
-- ninguém, e já estarão prontas no dia em que a atividade entrar na vitrine.
--
-- Reexecutável.
-- ============================================================================

BEGIN;

UPDATE public.qa_servicos_catalogo
   SET modalidade_cac = 'atirador',
       updated_at     = now()
 WHERE slug = 'concessao-cr';

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- 1) O item da vitrine agora diz a atividade que vende:
--
-- SELECT slug, nome, servico_id, preco, modalidade_cac, ativo
--   FROM public.qa_servicos_catalogo
--  WHERE categoria = 'SINARM CAC'
--  ORDER BY servico_id;
--
-- Esperado: `concessao-cr` com preco 1239 e modalidade_cac = 'atirador'.
--
-- 2) O que o cliente de CR vai ver no checklist, já com a atividade resolvida —
--    46 exigências, sendo estas as duas que só existem por ser atirador:
--
-- SELECT ordem, tipo_documento, nome_documento, condicao_modalidade
--   FROM public.qa_servicos_documentos
--  WHERE servico_id = 44 AND ativo
--    AND condicao_modalidade IS NOT NULL
--  ORDER BY ordem;
--
-- Esperado: 3 linhas — filiação (atirador+caçador), compromisso de
-- habitualidade (atirador) e documento do Ibama (caçador). As duas primeiras
-- entram no processo; a do Ibama fica dormindo enquanto caçador não for vendido.
--
-- 3) Teste de ponta a ponta, no primeiro processo de CR criado depois disto:
--
-- SELECT id, servico_id, modalidade, created_at
--   FROM public.qa_processos
--  WHERE servico_id = 44
--  ORDER BY created_at DESC LIMIT 1;
--
-- Esperado: modalidade = 'atirador', sem ninguém ter escolhido nada.
