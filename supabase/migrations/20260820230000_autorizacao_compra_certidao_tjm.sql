-- ============================================================================
-- AUTORIZAÇÃO DE COMPRA ATIRADOR (50): entra a 8ª certidão — TJM
-- ----------------------------------------------------------------------------
-- Correção apontada pelo titular em 20/08/2026: são OITO certidões de
-- idoneidade, e a migration 20260820220000 semeou sete. Faltou a da Justiça
-- Militar ESTADUAL (TJM) — que não é a mesma coisa que a da Justiça Militar da
-- União (STM): são tribunais diferentes, cada um emite a sua.
--
-- Ela está nos dossiês deferidos (ex.: "Certidão Criminal — Tribunal de
-- Justiça Militar de São Paulo", no dossiê do Carlos Renato) e já existe no
-- checklist do CR (serviço 44) como `antecedentes_militar_estadual`.
--
-- As oito, para não restar dúvida:
--   1. Justiça Eleitoral (TSE)
--   2. Justiça Militar da União (STM)
--   3. Justiça Militar Estadual (TJM)          ← a que faltava
--   4. Justiça Federal — TRF3 regional
--   5. Justiça Federal — Seção Judiciária + JEF
--   6. Justiça Estadual — distribuições criminais (TJSP)
--   7. Justiça Estadual — execuções criminais (TJSP)
--   8. Polícia Civil — atestado de antecedentes (SSP)
--
-- Mesma regra da migration anterior: SÓ o catálogo. Nenhum processo existente
-- é tocado — o checklist completo vale para processos criados daqui pra frente.
--
-- Reexecutável.
-- ============================================================================

BEGIN;

INSERT INTO public.qa_servicos_documentos (
  servico_id, tipo_documento, nome_documento, etapa, ordem, obrigatorio,
  obrigatorio_etapa02, ativo, emissor, escopo, formato_aceito,
  condicao_profissional, condicao_modalidade, validade_dias, orgao_emissor,
  instrucoes, observacoes_cliente, regra_validacao
)
SELECT 50, 'antecedentes_militar_estadual',
       'Certidão Criminal — Tribunal de Justiça Militar (TJM)',
       'base', 385, true,
       false, true, 'cliente', 'permanente', ARRAY['pdf','jpg','jpeg','png'],
       NULL, NULL, 90, 'TJM',
       'É a certidão da Justiça Militar do seu estado — diferente da certidão do STM, '
       || 'que é da União. As duas entram no dossiê.',
       NULL,
       jsonb_build_object('grupo_checklist', 'antecedentes',
                          'ordem_grupo_checklist', 40)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.qa_servicos_documentos sd
    WHERE sd.servico_id = 50
      AND sd.tipo_documento = 'antecedentes_militar_estadual'
      AND sd.condicao_profissional IS NULL
 );

-- Se a linha já existir inativa por algum motivo, reacende.
UPDATE public.qa_servicos_documentos
   SET ativo = true, obrigatorio = true, updated_at = now()
 WHERE servico_id = 50
   AND tipo_documento = 'antecedentes_militar_estadual'
   AND (NOT ativo OR NOT obrigatorio);

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- As OITO certidões do serviço 50, todas ativas e obrigatórias:
--
-- SELECT ordem, tipo_documento, nome_documento, validade_dias
--   FROM public.qa_servicos_documentos
--  WHERE servico_id = 50 AND ativo
--    AND regra_validacao ->> 'grupo_checklist' = 'antecedentes'
--    AND tipo_documento LIKE 'antecedentes%'
--  ORDER BY ordem;
--
-- Esperado: 8 linhas — eleitoral, STM, TRF3, SJSP/JEF, distribuição TJSP,
-- execuções TJSP, TJM e Polícia Civil.
