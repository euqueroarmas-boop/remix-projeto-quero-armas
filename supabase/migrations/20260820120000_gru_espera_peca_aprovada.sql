-- ============================================================================
-- A ETAPA DE PROTOCOLO SÓ ABRE DEPOIS DA DEFESA APROVADA PELO CLIENTE
-- ----------------------------------------------------------------------------
-- A ordem real do serviço é: o cliente entrega os documentos → a equipe
-- jurídica escreve a peça de defesa com base no que ele trouxe → o cliente lê e
-- aprova → SÓ ENTÃO ele paga a GRU, libera o gov.br e assina a juntada.
--
-- O sistema pulava o meio. `qa-processo-checar-conclusao-checklist` promovia o
-- processo para `pronto_para_protocolar` assim que a documentação fechava, e
-- essa promoção é exatamente o que abre a etapa final para o cliente
-- (`etapaFinalProtocolo.protocoloLiberado`). O único freio ligado à peça só
-- mordia quando ela JÁ tinha sido enviada e estava pendurada
-- (`aguardando_cliente` ou `devolvida`). Processo sem peça nenhuma passava
-- reto — e o cliente era convidado a pagar R$ 88 antes de existir defesa.
--
-- É o caso confirmado do Anthony (20/08/2026): documentação inteira entregue,
-- boleto da GRU aberto no checklist, nenhuma peça gerada na base.
--
-- Esta coluna diz quais serviços têm defesa escrita. A marcação inicial é
-- FAIL-SAFE: todo serviço que gera processo passa a exigir. Errar para mais
-- custa uma tarefa a mais no painel da equipe; errar para menos custa dinheiro
-- do cliente na hora errada.
-- ============================================================================

ALTER TABLE public.qa_servicos_catalogo
  ADD COLUMN IF NOT EXISTS exige_peca_defesa boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.qa_servicos_catalogo.exige_peca_defesa IS
  'Serviço em que a equipe jurídica escreve peça de defesa e o cliente precisa APROVAR antes de o sistema abrir a etapa de protocolo (GRU, gov.br, juntada). Lido pela edge function qa-processo-checar-conclusao-checklist.';

UPDATE public.qa_servicos_catalogo
   SET exige_peca_defesa = true,
       updated_at = now()
 WHERE gera_processo = true
   AND exige_peca_defesa IS DISTINCT FROM true;

-- Conferência: quais serviços passaram a exigir a peça.
-- SELECT slug, nome, gera_processo, exige_peca_defesa
--   FROM public.qa_servicos_catalogo
--  WHERE ativo = true
--  ORDER BY exige_peca_defesa DESC, nome;

-- Exceção (rodar só se algum serviço NÃO tiver defesa escrita):
-- UPDATE public.qa_servicos_catalogo
--    SET exige_peca_defesa = false, updated_at = now()
--  WHERE slug IN ('slug-do-servico');
