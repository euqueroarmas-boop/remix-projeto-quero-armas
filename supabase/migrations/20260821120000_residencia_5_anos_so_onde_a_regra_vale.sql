-- =============================================================================
-- A REGRA DOS 5 ANOS VALE SÓ ONDE ELA JÁ VALIA
-- -----------------------------------------------------------------------------
-- Decisão do titular (21/08/2026):
--
--   "Autorização de compra / posse de arma de fogo não usa comprovante de 5
--    anos de endereço. Só o atual."
--
-- O serviço 60 é exatamente esse — "Autorização de compra / Posse", o da PF /
-- SINARM. Ele nunca esteve na regra dos 5 anos: `qa_seed_endereco_5_anos`, que
-- semeia os comprovantes de endereço ano a ano desde junho, cobre apenas os
-- serviços 31, 44, 50 e 51. O 60 ficou de fora de propósito, porque ali só o
-- endereço ATUAL importa.
--
-- Na leva 18 eu coloquei a pergunta dos 5 anos em todo serviço que pedisse
-- certidão estadual — e isso alcançou o 60 por engano. Nove processos abertos
-- receberam uma pergunta que não deveriam receber.
--
-- ─── O CRITÉRIO, AGORA EXPLÍCITO ─────────────────────────────────────────────
--
-- A pergunta e as certidões de residência anterior valem EXATAMENTE nos
-- serviços que já usam o comprovante de endereço dos 5 anos: 31, 44, 50 e 51.
-- Uma regra, uma lista — e uma função que a diz por extenso, para que o
-- semeador das certidões e o catálogo leiam a MESMA coisa e não voltem a
-- divergir.
--
-- ─── O QUE ACONTECE COM O SERVIÇO 60 ─────────────────────────────────────────
--
--  - a pergunta sai do catálogo;
--  - a linha sai dos processos abertos. Linha intocada (pendente, sem arquivo,
--    sem observação e sem resposta no questionário) é APAGADA, porque nasceu
--    de engano e não faz parte da história do dossiê. Qualquer linha que já
--    tenha rastro vira 'nao_aplicavel' com a razão escrita — nunca se apaga o
--    que alguém tocou;
--  - o semeador das certidões passa a ignorar o serviço, então nem a equipe
--    lançando endereço anterior no admin cria bloco lá.
--
-- Reexecutável.
-- =============================================================================

BEGIN;

-- ─── 1) Quem usa a regra dos 5 anos ──────────────────────────────────────────
-- MESMA lista de qa_seed_endereco_5_anos (20260618050000). Se um dia um serviço
-- entrar ou sair de lá, tem de entrar ou sair daqui — a consulta (E) no rodapé
-- desta migration acusa a divergência.
CREATE OR REPLACE FUNCTION public.qa_servico_usa_residencia_5_anos(p_servico_id integer)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT p_servico_id IN (31, 44, 50, 51);
$$;

COMMENT ON FUNCTION public.qa_servico_usa_residencia_5_anos(integer) IS
  'TRUE nos serviços em que a residência dos ÚLTIMOS 5 ANOS importa — os '
  'mesmos que qa_seed_endereco_5_anos já cobre (Posse 31, Concessão de CR 44, '
  'Autorização de Compra CAC 50 e 51). A Autorização de compra / Posse da PF '
  '(60) usa só o endereço ATUAL e fica de fora, por decisão do titular em '
  '21/08/2026.';

GRANT EXECUTE ON FUNCTION public.qa_servico_usa_residencia_5_anos(integer)
  TO authenticated, service_role;

-- ─── 2) O semeador das certidões passa a respeitar o critério ────────────────
-- Patch textual: preserva o que estiver vivo e aborta se não achar o alvo.
DO $seed$
DECLARE
  d    text;
  novo text;
  o    oid;
  alvo constant text := '  -- Dossiê já entregue ao órgão não recebe exigência nova (Lei 9.784/99, mesma
  -- regra de 20260821010000). Notificação e recurso religam o relógio.
  IF public.qa_processo_relogio_parado(p_processo_id) THEN RETURN 0; END IF;';
BEGIN
  SELECT p.oid INTO o
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public'
     AND p.proname = 'qa_seed_certidoes_estados_anteriores'
   LIMIT 1;
  IF o IS NULL THEN
    RAISE EXCEPTION 'ABORTADO: qa_seed_certidoes_estados_anteriores nao encontrada';
  END IF;
  d := pg_get_functiondef(o);

  IF position('qa_servico_usa_residencia_5_anos' in d) > 0 THEN
    RAISE NOTICE 'Semeador ja respeita o criterio de servico — nada a fazer.';
    RETURN;
  END IF;
  IF position(alvo in d) = 0 THEN
    RAISE EXCEPTION 'ABORTADO: guarda do relogio parado nao encontrada no semeador';
  END IF;

  novo := replace(d, alvo, alvo || '

  -- CRITERIO DE SERVICO (21/08/2026): so onde a residencia dos ultimos 5 anos
  -- importa. Autorizacao de compra / Posse da PF usa so o endereco ATUAL.
  IF NOT public.qa_servico_usa_residencia_5_anos(v_proc.servico_id) THEN RETURN 0; END IF;');

  EXECUTE novo;
  RAISE NOTICE 'Semeador passou a respeitar o criterio de servico.';
END
$seed$;

-- ─── 3) A pergunta sai do catálogo de quem não usa a regra ───────────────────
DELETE FROM public.qa_servicos_documentos
 WHERE tipo_documento = 'pergunta_residencia_5_anos'
   AND NOT public.qa_servico_usa_residencia_5_anos(servico_id);

COMMIT;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ TRANSAÇÃO 2 — os processos que já receberam a pergunta por engano         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
BEGIN;

-- Silencia os avisos: tirar uma linha do checklist não é "documento recebido".
DO $off$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['trg_qa_processo_doc_verde','trg_qa_admin_notif_doc_processo'] LOOP
    IF EXISTS (SELECT 1 FROM pg_trigger g
                 JOIN pg_class c ON c.oid = g.tgrelid
                WHERE c.relname = 'qa_processo_documentos' AND g.tgname = t) THEN
      EXECUTE format('ALTER TABLE public.qa_processo_documentos DISABLE TRIGGER %I', t);
    END IF;
  END LOOP;
END $off$;

-- 4.1 Linha com rastro NÃO é apagada: vira não-aplicável, com a razão escrita.
UPDATE public.qa_processo_documentos pd
   SET status = 'nao_aplicavel',
       observacoes = COALESCE(pd.observacoes,'') ||
         CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
         '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
         '] Este serviço usa apenas o endereço atual — a regra dos 5 anos não se ' ||
         'aplica aqui.',
       updated_at = now()
  FROM public.qa_processos p
 WHERE p.id = pd.processo_id
   AND pd.tipo_documento = 'pergunta_residencia_5_anos'
   AND NOT public.qa_servico_usa_residencia_5_anos(p.servico_id)
   AND pd.status <> 'nao_aplicavel'
   AND (
        NULLIF(btrim(COALESCE(pd.observacoes,'')), '') IS NOT NULL
     OR coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,'')) IS NOT NULL
     OR pd.status <> 'pendente'
     OR COALESCE(p.respostas_questionario_json, '{}'::jsonb) ? 'residencia_5_anos'
   );

-- 4.2 Linha intocada some: nasceu de engano, não faz parte da história.
DELETE FROM public.qa_processo_documentos pd
 USING public.qa_processos p
 WHERE p.id = pd.processo_id
   AND pd.tipo_documento = 'pergunta_residencia_5_anos'
   AND NOT public.qa_servico_usa_residencia_5_anos(p.servico_id)
   AND pd.status = 'pendente'
   AND NULLIF(btrim(COALESCE(pd.observacoes,'')), '') IS NULL
   AND coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,'')) IS NULL
   AND NOT (COALESCE(p.respostas_questionario_json, '{}'::jsonb) ? 'residencia_5_anos');

-- 4.3 Bloco de certidão de estado anterior que porventura tenha nascido em
--     serviço fora da regra. Mesma prudência: só o que está VAZIO sai. Bloco
--     que já carrega um documento entregue PERMANECE — apagar seria jogar fora
--     certidão do cliente. Se sobrar algum assim, a conferência (D) mostra
--     quais são, para a equipe decidir caso a caso.
DELETE FROM public.qa_processo_documentos pd
 USING public.qa_processos p
 WHERE p.id = pd.processo_id
   AND pd.campos_complementares_json ->> 'gerado_por' = 'estados_anteriores'
   AND NOT public.qa_servico_usa_residencia_5_anos(p.servico_id)
   AND coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,'')) IS NULL
   AND pd.status IN ('pendente','nao_aplicavel');

-- Religa os gatilhos e aborta se algum ficar desligado.
DO $on$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['trg_qa_processo_doc_verde','trg_qa_admin_notif_doc_processo'] LOOP
    IF EXISTS (SELECT 1 FROM pg_trigger g
                 JOIN pg_class c ON c.oid = g.tgrelid
                WHERE c.relname = 'qa_processo_documentos' AND g.tgname = t) THEN
      EXECUTE format('ALTER TABLE public.qa_processo_documentos ENABLE TRIGGER %I', t);
    END IF;
  END LOOP;
END $on$;

DO $chk$
DECLARE v_off text;
BEGIN
  SELECT string_agg(g.tgname, ', ') INTO v_off
    FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
   WHERE c.relname = 'qa_processo_documentos'
     AND g.tgname IN ('trg_qa_processo_doc_verde','trg_qa_admin_notif_doc_processo')
     AND g.tgenabled = 'D';
  IF v_off IS NOT NULL THEN
    RAISE EXCEPTION 'ABORTADO: gatilho(s) ficaram desligados: %', v_off;
  END IF;
END $chk$;

COMMIT;

-- =============================================================================
-- CONFERÊNCIA (rodar depois, UMA DE CADA VEZ)
--
-- A) A pergunta ficou só onde a regra vale. Esperado: 31, 44, 50 (e 51, se ele
--    tiver certidão estadual no catálogo). NENHUM 60.
--
-- SELECT servico_id FROM public.qa_servicos_documentos
--  WHERE tipo_documento = 'pergunta_residencia_5_anos'
--  ORDER BY servico_id;
--
-- B) Nos processos, idem. Esperado: nenhuma linha de serviço 60.
--
-- SELECT p.servico_id, pd.status, count(*) AS linhas
--   FROM public.qa_processo_documentos pd
--   JOIN public.qa_processos p ON p.id = pd.processo_id
--  WHERE pd.tipo_documento = 'pergunta_residencia_5_anos'
--  GROUP BY p.servico_id, pd.status
--  ORDER BY p.servico_id;
--
-- C) O semeador ganhou o critério. Esperado: 1 linha.
--
-- SELECT p.proname
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--    AND p.proname = 'qa_seed_certidoes_estados_anteriores'
--    AND pg_get_functiondef(p.oid) LIKE '%qa_servico_usa_residencia_5_anos%';
--
-- D) Bloco de estado anterior em serviço fora da regra. VAZIOS têm de ser 0;
--    os que aparecerem em "com_documento" foram preservados de propósito —
--    são certidões que o cliente entregou de verdade, e quem decide o que
--    fazer com elas é a equipe, não a migration.
--
-- SELECT count(*) FILTER (WHERE coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,'')) IS NULL) AS vazios,
--        count(*) FILTER (WHERE coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,'')) IS NOT NULL) AS com_documento
--   FROM public.qa_processo_documentos pd
--   JOIN public.qa_processos p ON p.id = pd.processo_id
--  WHERE pd.campos_complementares_json ->> 'gerado_por' = 'estados_anteriores'
--    AND NOT public.qa_servico_usa_residencia_5_anos(p.servico_id);
--
-- E) AS DUAS LISTAS CONTINUAM IGUAIS? Compara o critério desta migration com a
--    lista viva dentro de qa_seed_endereco_5_anos. Esperado: true.
--
-- SELECT pg_get_functiondef(p.oid) LIKE '%IN (31, 44, 50, 51)%' AS listas_iguais
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public' AND p.proname = 'qa_seed_endereco_5_anos';
-- =============================================================================
