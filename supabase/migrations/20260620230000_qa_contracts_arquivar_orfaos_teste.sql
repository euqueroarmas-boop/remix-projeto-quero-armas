-- Arquiva contratos de teste sem venda real (venda_id não resolve em
-- qa_vendas) e sem template_codigo gravado — confirmados pelo usuário como
-- artefatos de uma fase antiga de testes, sem cliente real associado.
--
-- Não reaproveita a coluna `status` (tem CHECK chk_qa_contracts_status
-- restrito ao fluxo real de assinatura) — usa uma coluna aditiva própria
-- para não interferir em nenhuma lógica de status existente.
ALTER TABLE public.qa_contracts
  ADD COLUMN IF NOT EXISTS arquivado_em timestamptz,
  ADD COLUMN IF NOT EXISTS arquivado_motivo text;

COMMENT ON COLUMN public.qa_contracts.arquivado_em IS
  'Quando preenchido, contrato é artefato histórico (ex.: teste sem venda real) — excluído de listagens e métricas de não-canônicos, mas mantido para auditoria.';

DO $$
DECLARE
  v_total integer;
BEGIN
  UPDATE public.qa_contracts c
     SET arquivado_em = now(),
         arquivado_motivo = 'contrato_teste_sem_venda_real_confirmado_pelo_usuario'
   WHERE c.arquivado_em IS NULL
     AND c.template_codigo IS NULL
     AND c.venda_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.qa_vendas v
        WHERE v.id_legado = c.venda_id OR v.id = c.venda_id
     );

  GET DIAGNOSTICS v_total = ROW_COUNT;
  RAISE NOTICE 'qa_contracts_arquivar_orfaos_teste: % contrato(s) de teste arquivado(s).', v_total;
END;
$$;
