-- ============================================================================
-- REMOVE A TABELA DE LIMITE DE COMPRAS
--
-- A tabela nasceu de uma decisão errada minha: transformar em regra do checkout
-- um limite que é do órgão, não da loja. Quantas armas cada pessoa pode ter
-- depende da categoria, da finalidade (defesa pessoal x CAC) e de autorização
-- judicial — nada disso cabe no carrinho.
--
-- O código já não lê esta tabela: `qa-checkout-criar-venda` só avisa quando o
-- mesmo serviço foi comprado nos últimos 30 minutos, e quem está comprando
-- confirma na própria tela. Isto aqui só limpa o que ficou no banco.
-- ============================================================================

DROP TABLE IF EXISTS public.qa_servicos_limite_compra;

-- ── Conferência: não pode sobrar nada ───────────────────────────────────────
SELECT count(*) AS tabelas_de_limite_restantes
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relname = 'qa_servicos_limite_compra';
