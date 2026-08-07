-- =============================================================================
-- Remove dois apelidos que fazem UM documento cumprir a exigência de OUTRO
--
-- Os dois casos abaixo são da mesma classe de erro que a migration de 31/07
-- ("separa_militar_estadual_da_uniao") existiu para corrigir: um documento
-- dispensa uma exigência que ele não cobre, o processo vai a protocolo
-- faltando peça, e a conferência da PF encontra o buraco.
--
-- ─── CASO 1 — introduzido hoje, em 20260807120000 ────────────────────────
--   ('certidao_federal_trf3_sjsp_jef', 'antecedentes_federal_trf3_regional')
--
--   A certidão REGIONAL do TRF3 e a certidão da SEÇÃO JUDICIÁRIA de São Paulo
--   (com Juizados Especiais Federais) são documentos distintos, emitidos em
--   sistemas distintos. A própria biblioteca diz isso na observação do item:
--   "Complementa a certidão regional; não a substitui."
--
--   Com o apelido, UMA certidão regional no Hub dispensava AS DUAS exigências.
--
-- ─── CASO 2 — sobrevivente de 18/06, nunca removido ──────────────────────
--   ('certidao_criminal_tjmsp', 'antecedentes_estadual')
--
--   `certidao_criminal_tjmsp` é o Tribunal de Justiça MILITAR de São Paulo.
--   Foi mapeado para `antecedentes_estadual` (Justiça Estadual COMUM) em
--   18/06, antes de existir tipo militar estadual. Em 30/07 ganhou o destino
--   correto (`antecedentes_militar_estadual`), mas o apelido errado ficou.
--
--   Com ele, uma certidão criminal comum do TJSP dispensava a exigência do TJM.
--
-- Nenhuma dispensa já concedida é desfeita: o motor só atua sobre exigências
-- em aberto. Isto fecha a porta daqui para a frente.
--
-- Idempotente.
-- =============================================================================

BEGIN;

DELETE FROM public.qa_tipo_documento_aliases
 WHERE (processo_tipo = 'certidao_federal_trf3_sjsp_jef'
        AND hub_tipo = 'antecedentes_federal_trf3_regional')
    OR (processo_tipo = 'certidao_criminal_tjmsp'
        AND hub_tipo = 'antecedentes_estadual');

COMMIT;
