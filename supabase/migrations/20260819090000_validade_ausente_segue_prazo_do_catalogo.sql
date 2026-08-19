-- =============================================================================
-- DOCUMENTO COM PRAZO PARA DE FICAR SEM DATA DE VALIDADE
--
-- ACHADO (19/08/2026). O cartão CNPJ do Gilson não aparecia em varredura
-- nenhuma — nem na prévia de vencimento, nem na lista de "fora do alcance".
-- Motivo: a linha dele no acervo está com `data_validade` NULA. Não há data,
-- logo não há o que vencer.
--
-- Só que o catálogo diz que ele TEM prazo: `validade_dias = 30` ("emitido nos
-- últimos 30 dias"). Documento assim envelhece em silêncio e só é descoberto na
-- mesa do protocolo, quando já não dá para consertar sem perder o dia.
--
-- Hoje são dois casos, os dois ainda dentro do prazo:
--   • GILSON — cartão CNPJ, entregue 01/08 (18 dias), prazo 30.
--   • MIZAEL — holerite do mês, entregue 15/08 (4 dias), prazo 30.
--
-- A REGRA: quando o catálogo define prazo e o acervo não tem data, o sistema
-- calcula a data em vez de deixar em branco.
--
-- DE ONDE SAI A DATA, nesta ordem:
--   1. `dc.data_emissao` — a correta. O prazo corre da emissão do documento.
--   2. `pd.data_envio`   — aproximação, quando não sabemos a emissão.
--
-- POR QUE A ORDEM IMPORTA. Entregar é sempre DEPOIS de emitir. Usar a data de
-- entrega faz o documento parecer mais novo do que é — erro para o lado
-- perigoso, que deixaria passar documento já velho. Por isso a emissão vem
-- primeiro, e o evento registra qual das duas foi usada, para dar para auditar
-- depois.
--
-- NÃO SOBRESCREVE NADA: só preenche onde está nulo. Data que a IA extraiu ou
-- que a equipe digitou continua mandando.
--
-- Idempotente. Roda 06:05 UTC (03:05 BRT), cinco minutos antes da varredura de
-- vencimento — assim a data nasce antes de alguém precisar dela.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.qa_preencher_validade_por_prazo_catalogo()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_total integer := 0;
BEGIN
  WITH prazo AS (
    -- Menor prazo entre as exigências que este MESMO arquivo cumpre. Se o
    -- arquivo serve a dois processos com prazos diferentes, vale o mais curto:
    -- é o que decide se ele ainda serve para protocolar.
    SELECT dc.id                                    AS doc_id,
           min(pd.validade_dias)                    AS validade_dias,
           COALESCE(dc.data_emissao, min(pd.data_envio)::date) AS base,
           (dc.data_emissao IS NOT NULL)            AS base_e_emissao
      FROM public.qa_documentos_cliente dc
      JOIN public.qa_processo_documentos pd
        ON pd.arquivo_storage_key = dc.arquivo_storage_path
      JOIN public.qa_processos p
        ON p.id = pd.processo_id
     WHERE dc.data_validade IS NULL
       AND pd.validade_dias IS NOT NULL
       AND public.qa_processo_em_aberto(p.status)
       AND pd.status IN (
         'aprovado', 'validado', 'entregue_pelo_hub',
         'dispensado', 'dispensado_grupo', 'dispensado_por_reaproveitamento'
       )
     GROUP BY dc.id, dc.data_emissao
  ),
  preenchidas AS (
    UPDATE public.qa_documentos_cliente dc
       SET data_validade = prazo.base + prazo.validade_dias,
           updated_at    = now()
      FROM prazo
     WHERE dc.id = prazo.doc_id
       AND prazo.base IS NOT NULL
    RETURNING dc.id, dc.qa_cliente_id, dc.tipo_documento, dc.data_validade,
              prazo.validade_dias, prazo.base, prazo.base_e_emissao
  )
  INSERT INTO public.qa_documentos_cliente_eventos
    (documento_id, qa_cliente_id, acao, ator_tipo, detalhes)
  SELECT pr.id,
         pr.qa_cliente_id,
         'editado',
         'sistema',
         jsonb_build_object(
           'motivo', 'validade ausente calculada pelo prazo do catálogo',
           'tipo_documento', pr.tipo_documento,
           'prazo_dias', pr.validade_dias,
           'base_usada', CASE WHEN pr.base_e_emissao THEN 'data_emissao' ELSE 'data_envio' END,
           'base', pr.base,
           'data_validade', pr.data_validade
         )
    FROM preenchidas pr;

  GET DIAGNOSTICS v_total = ROW_COUNT;
  RETURN v_total;
END;
$$;

COMMENT ON FUNCTION public.qa_preencher_validade_por_prazo_catalogo() IS
  'Preenche data_validade nula no acervo usando o prazo do catálogo '
  '(validade_dias), contado da emissão quando conhecida. Nunca sobrescreve '
  'data já registrada.';

REVOKE ALL ON FUNCTION public.qa_preencher_validade_por_prazo_catalogo()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qa_preencher_validade_por_prazo_catalogo()
  TO service_role;

-- ─── Backfill: acerta os casos de hoje ───────────────────────────────────
DO $$
DECLARE v_n integer;
BEGIN
  SELECT public.qa_preencher_validade_por_prazo_catalogo() INTO v_n;
  RAISE NOTICE 'Documentos que ganharam data de validade: %', v_n;
END $$;

-- ─── Daqui em diante, sozinho ────────────────────────────────────────────
SELECT cron.unschedule('qa-preencher-validade-ausente-diario')
 WHERE EXISTS (
   SELECT 1 FROM cron.job WHERE jobname = 'qa-preencher-validade-ausente-diario'
 );

SELECT cron.schedule(
  'qa-preencher-validade-ausente-diario',
  '5 6 * * *',
  $$ SELECT public.qa_preencher_validade_por_prazo_catalogo(); $$
);

COMMIT;
