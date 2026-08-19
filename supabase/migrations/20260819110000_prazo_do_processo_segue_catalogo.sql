-- =============================================================================
-- O PRAZO DO DOCUMENTO NO PROCESSO PASSA A SEGUIR O CATÁLOGO
--
-- ACHADO (19/08/2026). Ao conferir se a regra de validade alcançava a CONCESSÃO
-- DE CR, apareceram 26 exigências de processo aberto com o prazo EM BRANCO
-- embora o catálogo do serviço tenha o prazo preenchido. Exemplos:
--
--   • ABNER (CONCESSÃO DE CR) — sete certidões de antecedentes. Catálogo diz
--     30 ou 90 dias; o processo dele não diz nada.
--   • DAVI (CONCESSÃO DE CR) — três certidões, mesmo caso.
--   • RIVELINO (AUTORIZAÇÃO CAC) — comprovante de residência, catálogo 30.
--
-- POR QUE ISSO IMPORTA. `qa_preencher_validade_por_prazo_catalogo` só consegue
-- calcular a data de validade onde o PROCESSO tem prazo — ela lê
-- `pd.validade_dias`, não o catálogo. Sem prazo no processo, não há conta, não
-- há data, e o documento envelhece em silêncio. Foi exatamente assim que o
-- cartão CNPJ do Gilson passou 18 dias invisível.
--
-- POR QUE ACONTECEU. Mesma causa da ordem do checklist (20260819040000): o
-- prazo é COPIADO do catálogo no dia em que o checklist é montado. Mexer no
-- catálogo depois não alcança quem já tem processo aberto. Aqui é o mesmo
-- conserto, aplicado a outra coluna.
--
-- O QUE ESTA MIGRATION FAZ.
--   1. Copia o prazo do catálogo para o processo ONDE ELE ESTÁ EM BRANCO.
--   2. Faz isso rodar sozinho, no início do ciclo diário de validade — a
--      ordem certa é preencher o prazo primeiro, calcular a data depois.
--
-- O QUE ELA NÃO FAZ, DE PROPÓSITO: não sobrescreve prazo já gravado no
-- processo. Existem serviços com duas linhas de catálogo para o mesmo
-- documento e prazos diferentes (30 e 90 dias na mesma certidão) — enquanto
-- isso não estiver resolvido, trocar um prazo existente por outro seria
-- escolher lado sem saber qual. Preencher branco não tem esse risco.
--
-- Idempotente.
-- =============================================================================

BEGIN;

-- ─── 1) O prazo autoritativo de cada exigência, vindo do catálogo ────────
--
-- `DISTINCT ON (pd.id)` pelo mesmo motivo da ordem: o mesmo tipo pode ter mais
-- de uma linha no catálogo, uma por condição profissional. A regra ESPECÍFICA
-- da condição do processo ganha da geral; empatou, vale o MENOR prazo — o mais
-- curto é o que de fato decide se o documento ainda serve para protocolar.
CREATE OR REPLACE FUNCTION public.qa_realinhar_validade_dias_checklist(p_servico_id integer DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ajustadas integer := 0;
BEGIN
  WITH alvo AS (
    SELECT DISTINCT ON (pd.id)
           pd.id            AS pd_id,
           sd.validade_dias AS prazo_catalogo
      FROM public.qa_processo_documentos pd
      JOIN public.qa_processos p
        ON p.id = pd.processo_id
      JOIN public.qa_servicos_documentos sd
        ON sd.servico_id = p.servico_id
       AND sd.tipo_documento = pd.tipo_documento
     WHERE p.status NOT IN ('concluido', 'cancelado')
       AND sd.ativo = true
       AND sd.validade_dias IS NOT NULL
       AND pd.validade_dias IS NULL
       AND (p_servico_id IS NULL OR p.servico_id = p_servico_id)
       AND (
         sd.condicao_profissional IS NULL
         OR COALESCE(p.condicao_profissional, 'indefinido') = ANY (
              SELECT btrim(lower(x))
                FROM unnest(string_to_array(sd.condicao_profissional, ',')) AS x
            )
       )
     ORDER BY pd.id,
              (sd.condicao_profissional IS NOT NULL) DESC,
              sd.validade_dias
  )
  UPDATE public.qa_processo_documentos pd
     SET validade_dias = alvo.prazo_catalogo
    FROM alvo
   WHERE pd.id = alvo.pd_id;

  GET DIAGNOSTICS v_ajustadas = ROW_COUNT;
  RETURN v_ajustadas;
END;
$$;

COMMENT ON FUNCTION public.qa_realinhar_validade_dias_checklist(integer) IS
  'Copia validade_dias do catálogo para exigências de processo aberto que estão '
  'sem prazo. Nunca sobrescreve prazo já gravado. Regra específica da condição '
  'profissional ganha da geral; empate vale o prazo mais curto.';

REVOKE ALL ON FUNCTION public.qa_realinhar_validade_dias_checklist(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qa_realinhar_validade_dias_checklist(integer)
  TO service_role;

-- ─── 2) O ciclo diário passa a fazer as duas coisas, na ordem certa ──────
-- Preencher o prazo ANTES de calcular a data. Ao contrário, a conta roda sem
-- ter de onde tirar o número e não faz nada — que é o estado de hoje.
CREATE OR REPLACE FUNCTION public.qa_manutencao_validade_documentos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prazos    integer;
  v_validades integer;
BEGIN
  SELECT public.qa_realinhar_validade_dias_checklist(NULL)  INTO v_prazos;
  SELECT public.qa_preencher_validade_por_prazo_catalogo()  INTO v_validades;

  RETURN jsonb_build_object(
    'prazos_copiados_do_catalogo', v_prazos,
    'validades_calculadas',        v_validades
  );
END;
$$;

COMMENT ON FUNCTION public.qa_manutencao_validade_documentos() IS
  'Ciclo diário de validade: copia o prazo do catálogo para quem está sem, '
  'e só então calcula as datas de validade.';

REVOKE ALL ON FUNCTION public.qa_manutencao_validade_documentos()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qa_manutencao_validade_documentos()
  TO service_role;

-- ─── 3) Agora, para os 26 casos de hoje ──────────────────────────────────
DO $$
DECLARE v_r jsonb;
BEGIN
  SELECT public.qa_manutencao_validade_documentos() INTO v_r;
  RAISE NOTICE 'Manutenção de validade: %', v_r;
END $$;

-- ─── 4) O agendamento passa a chamar as duas etapas ──────────────────────
SELECT cron.unschedule('qa-preencher-validade-ausente-diario')
 WHERE EXISTS (
   SELECT 1 FROM cron.job WHERE jobname = 'qa-preencher-validade-ausente-diario'
 );

SELECT cron.unschedule('qa-manutencao-validade-diario')
 WHERE EXISTS (
   SELECT 1 FROM cron.job WHERE jobname = 'qa-manutencao-validade-diario'
 );

SELECT cron.schedule(
  'qa-manutencao-validade-diario',
  '5 6 * * *',
  $$ SELECT public.qa_manutencao_validade_documentos(); $$
);

COMMIT;
