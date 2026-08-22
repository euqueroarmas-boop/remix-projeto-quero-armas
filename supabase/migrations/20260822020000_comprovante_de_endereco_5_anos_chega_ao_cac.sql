-- =============================================================================
-- O COMPROVANTE DE ENDEREÇO DOS 5 ANOS CHEGA À AUTORIZAÇÃO DE COMPRA CAC
-- -----------------------------------------------------------------------------
-- Achado de 21/08/2026, conferido contra o banco: a migration 20260618050000
-- NUNCA CHEGOU AO BANCO. Ela estendia `qa_seed_endereco_5_anos` para os
-- serviços 50 e 51 (Autorização de Compra CAC, atirador e caçador), mas a lista
-- viva continua sendo a de maio.
--
-- O diff entre as duas versões é de UMA linha — só a lista de serviços. Todo o
-- resto da função é idêntico.
--
-- ─── O QUE ISSO SIGNIFICA HOJE ───────────────────────────────────────────────
--
-- A lista viva é (31, 44). Conferido em 21/08:
--   - o serviço 31 foi apagado ontem: era catálogo órfão, sem processo nenhum;
--   - o serviço 44 não tem NENHUM processo.
--
-- Ou seja: o semeador dos 5 anos nunca rodou para cliente nenhum. É código
-- morto em produção desde maio.
--
-- ─── POR QUE NÃO BASTA TROCAR A LISTA ────────────────────────────────────────
--
-- O serviço 44 NÃO pede `comprovante_residencia` no catálogo — ele vive só dos
-- comprovantes por ano, e o do ano corrente é o `comprovante_endereco_ano_AAAA`
-- com i = 0.
--
-- Já o 50 e o 51 PEDEM: "Comprovante de residência atual", ativo, no catálogo.
-- Estender o semeador sem mais nada faria o cliente ver o comprovante do ano
-- corrente DUAS VEZES — uma pelo catálogo, outra pelo semeador.
--
-- Por isso o semeador ganha uma regra: quando o próprio catálogo do serviço já
-- pede o comprovante atual, o ano corrente NÃO é semeado. O 44 não é afetado
-- (não tem essa linha) e continua recebendo os cinco anos.
--
-- ─── ALCANCE (COMPORTAMENTO COMPARTILHADO — LEIA ANTES DE APLICAR) ───────────
--
-- `qa_seed_endereco_5_anos` é chamada pelo explodidor de checklist para TODO
-- processo. Duas coisas mudam nela:
--
--   (a) a lista de serviços passa de (31, 44) para (44, 50, 51) — sai o número
--       morto, entram os dois de Autorização de Compra CAC;
--   (b) o ano corrente deixa de ser semeado quando o processo já exige
--       `comprovante_residencia`. Isso NUNCA tira documento de ninguém: só
--       impede que o mesmo comprovante nasça duas vezes.
--
-- Impacto medido em 21/08: existe UM processo vivo de serviço 50. Ele passa a
-- pedir os quatro anos anteriores, além do comprovante atual que já pedia. O
-- outro processo do 50 está com o relógio parado e não é tocado. Os serviços 44
-- e 51 não têm processo nenhum.
--
-- Reexecutável.
-- =============================================================================

BEGIN;

-- ─── 1) O semeador ganha os dois serviços e a regra do ano corrente ──────────
-- Patch textual, pela razão de sempre: preserva o que estiver VIVO e aborta se
-- o alvo não estiver lá. Recriar do arquivo reverteria qualquer ajuste que
-- tenha sido aplicado direto no banco — foi exatamente esse descompasso entre
-- repositório e produção que criou este problema.
DO $semeador$
DECLARE
  d    text;
  novo text;
  o    oid;
  a_lista constant text := 'IF v_proc.servico_id NOT IN (31, 44) THEN RETURN 0; END IF;';
  a_tipo  constant text := 'v_tipo := ''comprovante_endereco_ano_'' || v_ano::text;';
BEGIN
  SELECT p.oid INTO o
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'qa_seed_endereco_5_anos'
   LIMIT 1;
  IF o IS NULL THEN
    RAISE EXCEPTION 'ABORTADO: qa_seed_endereco_5_anos nao encontrada';
  END IF;
  d := pg_get_functiondef(o);

  -- Idempotência: já tem a regra do ano corrente? Então não faz nada.
  IF position('comprovante ATUAL pelo catalogo' in d) > 0 THEN
    RAISE NOTICE 'Semeador ja atualizado — nada a fazer.';
    RETURN;
  END IF;

  IF position(a_lista in d) = 0 THEN
    RAISE EXCEPTION 'ABORTADO: a lista de servicos viva nao e a esperada. Rode "SELECT substring(pg_get_functiondef(p.oid) from ''servico_id NOT IN \([^)]*\)'') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=''public'' AND p.proname=''qa_seed_endereco_5_anos'';" e reveja antes de aplicar.';
  END IF;
  IF position(a_tipo in d) = 0 THEN
    RAISE EXCEPTION 'ABORTADO: montagem do tipo comprovante_endereco_ano_ nao encontrada no semeador';
  END IF;

  -- (a) A lista. Sai o 31 (apagado em 22/08), entram 50 e 51.
  novo := replace(d, a_lista,
    '-- Autorizacao de Compra CAC (50 e 51) entrou em 22/08/2026. O 31 saiu:
  -- era catalogo orfao, apagado por 20260822010000.
  IF v_proc.servico_id NOT IN (44, 50, 51) THEN RETURN 0; END IF;');

  -- (b) O ano corrente não nasce duas vezes.
  novo := replace(novo, a_tipo, a_tipo || '

    -- Quem ja pede o comprovante ATUAL pelo catalogo do servico (50 e 51, com
    -- "Comprovante de residencia atual") nao recebe o ano corrente semeado:
    -- seria o MESMO documento duas vezes na tela do cliente. O 44 nao tem essa
    -- linha no catalogo e continua recebendo os cinco anos.
    IF i = 0 AND EXISTS (
      SELECT 1 FROM public.qa_processo_documentos x
       WHERE x.processo_id = p_processo_id
         AND x.tipo_documento = ''comprovante_residencia''
    ) THEN
      CONTINUE;
    END IF;');

  EXECUTE novo;
  RAISE NOTICE 'Semeador atualizado: servicos (44, 50, 51) e ano corrente sem duplicata.';
END
$semeador$;

COMMIT;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ TRANSAÇÃO 2 — os processos que já estão abertos                           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
BEGIN;

-- Silencia os avisos: uma exigência nova no checklist não é "documento recebido".
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

-- Só processo que ainda monta dossiê. Depois do protocolo o dossiê congela —
-- mesma regra da Lei 9.784/99 que 20260821010000 firmou.
DO $backfill$
DECLARE r record; v_criados integer; v_total integer := 0; v_procs integer := 0;
BEGIN
  FOR r IN
    SELECT p.id, p.servico_id
      FROM public.qa_processos p
      JOIN public.qa_clientes cl ON cl.id = p.cliente_id
     WHERE p.servico_id IN (44, 50, 51)
       AND NOT public.qa_processo_relogio_parado(p.id)
       AND COALESCE(cl.status,'') <> 'excluido_lgpd'
       AND COALESCE(cl.excluido,false) = false
       -- Só onde o checklist já foi montado; processo sem checklist recebe os
       -- comprovantes na explosão, junto com todo o resto.
       AND EXISTS (SELECT 1 FROM public.qa_processo_documentos x WHERE x.processo_id = p.id)
  LOOP
    v_procs := v_procs + 1;
    BEGIN
      v_criados := COALESCE(public.qa_seed_endereco_5_anos(r.id), 0);
      v_total := v_total + v_criados;
      IF v_criados > 0 THEN
        RAISE NOTICE 'Processo % (servico %): % comprovante(s) de ano acrescentado(s).',
          r.id, r.servico_id, v_criados;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'semeadura de endereco falhou no processo %: %', r.id, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'Comprovante de endereco 5 anos: % processo(s) visitado(s), % linha(s) criada(s).',
    v_procs, v_total;
END
$backfill$;

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
-- A) A lista viva do semeador. Esperado: servico_id NOT IN (44, 50, 51).
--
-- SELECT substring(pg_get_functiondef(p.oid) from 'servico_id NOT IN \([^)]*\)') AS lista_viva
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public' AND p.proname = 'qa_seed_endereco_5_anos';
--
-- B) A regra do ano corrente entrou. Esperado: true.
--
-- SELECT pg_get_functiondef(p.oid) LIKE '%comprovante ATUAL pelo catalogo%' AS tem_regra
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public' AND p.proname = 'qa_seed_endereco_5_anos';
--
-- C) O que o processo vivo do serviço 50 passou a pedir. Esperado: o
--    "Comprovante de residência atual" que já existia, MAIS quatro anos
--    anteriores — e NENHUM comprovante_endereco_ano do ano corrente.
--
-- SELECT p.servico_id, pd.tipo_documento, pd.nome_documento, pd.ano_competencia, pd.status
--   FROM public.qa_processo_documentos pd
--   JOIN public.qa_processos p ON p.id = pd.processo_id
--  WHERE p.servico_id IN (44, 50, 51)
--    AND (pd.tipo_documento LIKE 'comprovante%endereco%'
--      OR pd.tipo_documento LIKE 'comprovante_residencia%')
--  ORDER BY p.servico_id, pd.ano_competencia NULLS FIRST, pd.tipo_documento;
--
-- D) Ninguém ficou com o comprovante do ano corrente em duplicata. Esperado: 0.
--
-- SELECT count(*) AS duplicados
--   FROM public.qa_processo_documentos a
--   JOIN public.qa_processo_documentos b
--     ON b.processo_id = a.processo_id
--    AND b.tipo_documento = 'comprovante_endereco_ano_' || EXTRACT(YEAR FROM CURRENT_DATE)::int::text
--  WHERE a.tipo_documento = 'comprovante_residencia';
-- =============================================================================
