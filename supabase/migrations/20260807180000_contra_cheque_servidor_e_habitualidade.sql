-- =============================================================================
-- Contra-cheque é do SERVIDOR PÚBLICO, não do CLT
--
-- Regra do usuário (07/08/2026):
--   holerite      → quem escolhe CLT na ocupação lícita
--   contra-cheque → servidor público
--
-- O Hub já tem um tipo para cada:
--   renda_holerite_mes_atual            'Holerite mais recente'
--   renda_holerite_funcionario_publico  'Holerite recente (servidor público)'
--
-- A exigência `contra_cheque_digital` ('Contra Cheque Digital') não tem tipo
-- próprio no Hub e vinha sendo traduzida, no frontend, para
-- `renda_holerite_mes_atual` — o balde do CLT. Servidor público entregava o
-- contra-cheque e o documento era arquivado como holerite de celetista.
--
-- O apelido abaixo fecha a exigência a partir do tipo CORRETO. O frontend foi
-- corrigido no mesmo commit para gravar em `renda_holerite_funcionario_publico`.
--
-- Sobre a habitualidade: nenhum apelido é criado de propósito.
-- `declaracao_compromisso_habitualidade` e `comprovante_habitualidade` são
-- documentos distintos, com finalidades distintas, e cada um já tem tipo
-- próprio no Hub. O banco desfez essa equivalência em 20260729010000; agora o
-- frontend para de refazê-la. A exigência fecha por identidade de tipo.
--
-- Idempotente.
-- =============================================================================

BEGIN;

INSERT INTO public.qa_tipo_documento_aliases (processo_tipo, hub_tipo) VALUES
  ('contra_cheque_digital', 'renda_holerite_funcionario_publico')
ON CONFLICT DO NOTHING;

-- Garante que o apelido para o balde errado não exista (nunca chegou a ser
-- criado no banco, mas a intenção fica registrada e o comando é inócuo).
DELETE FROM public.qa_tipo_documento_aliases
 WHERE processo_tipo = 'contra_cheque_digital'
   AND hub_tipo = 'renda_holerite_mes_atual';

DELETE FROM public.qa_tipo_documento_aliases
 WHERE processo_tipo = 'declaracao_compromisso_habitualidade'
   AND hub_tipo = 'comprovante_habitualidade';

COMMIT;
