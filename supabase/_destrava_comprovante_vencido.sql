-- ============================================================================
-- DESTRAVA IMEDIATA: comprovante de residência VENCIDO bloqueando o reenvio
--
-- Enquanto a correção do Hub não estiver publicada, o comprovante vencido no
-- acervo faz a tela recusar o comprovante novo por "duplicidade". Marcar o
-- vencido como 'substituido' (soft delete já usado pelo botão "Renovar")
-- libera o cliente para enviar na hora — o documento sai das listagens e o
-- histórico continua no banco.
--
-- NÃO apaga nada. NÃO mexe em documento dentro da validade.
-- ============================================================================

-- 1) CONFERE ANTES: o que vai ser marcado. Rode e leia o resultado.
--    Só devem aparecer comprovantes com data_validade JÁ PASSADA.
SELECT
  dc.id,
  qc.nome_completo,
  dc.tipo_documento,
  dc.status,
  dc.data_emissao,
  dc.data_validade,
  (CURRENT_DATE - dc.data_validade) AS dias_vencido
FROM public.qa_documentos_cliente dc
JOIN public.qa_clientes qc
  ON qc.id = dc.qa_cliente_id OR qc.customer_id = dc.customer_id
WHERE qc.nome_completo ILIKE '%gilson%'
  AND dc.tipo_documento = 'comprovante_residencia'
  AND dc.status = 'aprovado'
  AND dc.data_validade IS NOT NULL
  AND dc.data_validade < CURRENT_DATE;

-- 2) APLICA. Mesmas condições do bloco 1 — nada fora daquilo é tocado.
UPDATE public.qa_documentos_cliente dc
SET status = 'substituido',
    substituido_em = now(),
    updated_at = now()
FROM public.qa_clientes qc
WHERE (qc.id = dc.qa_cliente_id OR qc.customer_id = dc.customer_id)
  AND qc.nome_completo ILIKE '%gilson%'
  AND dc.tipo_documento = 'comprovante_residencia'
  AND dc.status = 'aprovado'
  AND dc.data_validade IS NOT NULL
  AND dc.data_validade < CURRENT_DATE;

-- 3) CONFERE DEPOIS: o vencido tem que estar 'substituido' e não pode sobrar
--    nenhum comprovante de residência 'aprovado' vencido para o cliente.
SELECT
  dc.id, dc.tipo_documento, dc.status, dc.data_emissao, dc.data_validade,
  dc.substituido_em
FROM public.qa_documentos_cliente dc
JOIN public.qa_clientes qc
  ON qc.id = dc.qa_cliente_id OR qc.customer_id = dc.customer_id
WHERE qc.nome_completo ILIKE '%gilson%'
  AND dc.tipo_documento = 'comprovante_residencia'
ORDER BY dc.created_at DESC;
