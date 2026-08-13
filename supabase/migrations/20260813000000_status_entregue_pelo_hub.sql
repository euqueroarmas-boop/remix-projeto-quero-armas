-- =============================================================================
-- STATUS `entregue_pelo_hub` — separa ENTREGA de REAPROVEITAMENTO
--
-- Ate aqui, tudo que o motor de reaproveitamento resolvia virava
-- `dispensado_por_reaproveitamento`. Mas o Hub Documental e o canal de entrega
-- do cliente: quando ele anexa um documento durante o processo, aquilo e
-- ENTREGA, nao reuso. 48 de 52 linhas (92%) estavam classificadas errado.
--
-- Taxonomia correta, em tres estados:
--   dispensado_grupo / nao_aplicavel     -> nao se aplica (resposta do cliente)
--   dispensado_por_reaproveitamento      -> ja estava no Hub ANTES do processo
--   entregue_pelo_hub                    -> entregue durante ESTE processo
--
-- O discriminador e `dc.created_at < p.data_criacao` — dado que ja existia na
-- consulta do motor, so nunca foi comparado.
--
-- Por que status novo e nao `aprovado`: a trava
-- `trg_qa_trava_aprovado_exige_arquivo` proibe duas exigencias do mesmo
-- processo compartilharem arquivo sob `aprovado`, e o reuso por alias faz
-- exatamente isso (laudo_psicologico <-> atestado da instituicao).
--
-- As CONSTRAINTS (chk_qa_processo_documentos_status e
-- chk_qa_proc_doc_status_vocabulario) ja foram atualizadas em passo anterior.
--
-- METODO: as funcoes sao alteradas por substituicao textual sobre a definicao
-- VIVA (pg_get_functiondef), nao por CREATE OR REPLACE de um corpo colado.
-- Assim nenhuma alteracao feita no banco que nao esteja no repositorio e
-- revertida. Cada substituicao tem assercao: se o alvo nao existir, a migration
-- ABORTA em vez de aplicar pela metade.
-- =============================================================================

BEGIN;

-- ── 1) Funcoes que CLASSIFICAM status: incluir o novo como cumprido ──────────
DO $listas$
DECLARE
  r record; d text; novo text; n int := 0;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
      FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public' AND p.prokind = 'f'
       AND p.proname IN ('qa_painel_progresso_clientes',
                         'qa_servico_divergencia_catalogo',
                         'qa_sincronizar_checklist_processos_servico')
  LOOP
    d := pg_get_functiondef(r.oid);
    novo := replace(d, '''dispensado_por_reaproveitamento'',''nao_aplicavel''',
                       '''dispensado_por_reaproveitamento'',''entregue_pelo_hub'',''nao_aplicavel''');
    novo := replace(novo, '''dispensado_por_reaproveitamento'',''concluido''',
                          '''dispensado_por_reaproveitamento'',''entregue_pelo_hub'',''concluido''');
    -- variantes com espaco depois da virgula
    novo := replace(novo, '''dispensado_por_reaproveitamento'', ''nao_aplicavel''',
                          '''dispensado_por_reaproveitamento'', ''entregue_pelo_hub'', ''nao_aplicavel''');
    novo := replace(novo, '''dispensado_por_reaproveitamento'', ''concluido''',
                          '''dispensado_por_reaproveitamento'', ''entregue_pelo_hub'', ''concluido''');
    IF novo = d THEN
      RAISE EXCEPTION 'ABORTADO: nenhuma lista de status encontrada em %', r.proname;
    END IF;
    EXECUTE novo;
    n := n + 1;
  END LOOP;
  IF n <> 3 THEN
    RAISE EXCEPTION 'ABORTADO: esperava 3 funcoes de lista, alterei %', n;
  END IF;
END
$listas$;

-- ── 2) BUG DA VIRGULA nas duas funcoes que filtram condicao_profissional ─────
-- Mesmo defeito ja corrigido em qa_explodir_checklist_processo: o campo aceita
-- varias condicoes separadas por virgula ("autonomo,empresario") e a igualdade
-- exata so casa com o valor unico.
DO $virgula$
DECLARE
  d text; novo text; oid_alvo oid;
BEGIN
  -- 2a) qa_sincronizar_checklist_processos_servico (4 ocorrencias)
  SELECT p.oid INTO oid_alvo
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname='public' AND p.proname='qa_sincronizar_checklist_processos_servico';
  d := pg_get_functiondef(oid_alvo);
  novo := replace(d,
    '(sd.condicao_profissional IS NULL OR sd.condicao_profissional = v_proc.condicao)',
    '(sd.condicao_profissional IS NULL OR v_proc.condicao = ANY (SELECT btrim(lower(x)) FROM unnest(string_to_array(sd.condicao_profissional, '','')) AS x))');
  IF novo = d THEN
    RAISE EXCEPTION 'ABORTADO: filtro de condicao nao encontrado em qa_sincronizar_checklist_processos_servico';
  END IF;
  EXECUTE novo;

  -- 2b) qa_servico_divergencia_catalogo (1 ocorrencia)
  SELECT p.oid INTO oid_alvo
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname='public' AND p.proname='qa_servico_divergencia_catalogo';
  d := pg_get_functiondef(oid_alvo);
  novo := replace(d,
    '(c.condicao_profissional IS NULL
            OR c.condicao_profissional = COALESCE(p.condicao_profissional,''indefinido''))',
    '(c.condicao_profissional IS NULL
            OR COALESCE(p.condicao_profissional,''indefinido'') = ANY (SELECT btrim(lower(x)) FROM unnest(string_to_array(c.condicao_profissional, '','')) AS x))');
  IF novo = d THEN
    RAISE EXCEPTION 'ABORTADO: filtro de condicao nao encontrado em qa_servico_divergencia_catalogo';
  END IF;
  EXECUTE novo;
END
$virgula$;

-- ── 3) MOTOR DE REAPROVEITAMENTO: decide entre reuso e entrega ───────────────
DO $motor$
DECLARE
  d text; novo text; oid_alvo oid;
BEGIN
  SELECT p.oid INTO oid_alvo
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname='public' AND p.proname='qa_reaproveitar_documentos_hub_processo';
  d := pg_get_functiondef(oid_alvo);

  -- 3a) o status deixa de ser fixo (2 ocorrencias: por tipo/alias e por ano)
  novo := replace(d,
    'status = ''dispensado_por_reaproveitamento'',',
    'status = CASE WHEN c.created_at < v_proc.data_criacao
                        THEN ''dispensado_por_reaproveitamento''
                        ELSE ''entregue_pelo_hub'' END,');
  IF novo = d THEN
    RAISE EXCEPTION 'ABORTADO: atribuicao de status nao encontrada no motor';
  END IF;

  -- 3b) metadados coerentes com a origem — corrige de quebra o badge
  --     "REAPROVEITADO" que o drawer e o classificador leem dessas flags.
  d := novo;
  novo := replace(d,
    '''reutilizado_do_hub'', true,
             ''reaproveitado_da_central'', true,',
    '''reutilizado_do_hub'', (c.created_at < v_proc.data_criacao),
             ''reaproveitado_da_central'', (c.created_at < v_proc.data_criacao),
             ''entregue_pelo_hub'', (c.created_at >= v_proc.data_criacao),');
  IF novo = d THEN
    RAISE EXCEPTION 'ABORTADO: metadados de reuso nao encontrados no motor';
  END IF;

  -- 3c) a observacao no historico nao pode afirmar reaproveitamento
  d := novo;
  novo := replace(d,
    '''] Reaproveitado automaticamente da Central de Documentos (doc #''',
    '''] '' || CASE WHEN c.created_at < v_proc.data_criacao THEN ''Reaproveitado automaticamente da Central de Documentos'' ELSE ''Entregue pelo Hub Documental neste processo'' END || '' (doc #''');
  novo := replace(novo,
    '''] Reaproveitado da Central de Documentos por ano de emissão ''',
    '''] '' || CASE WHEN c.created_at < v_proc.data_criacao THEN ''Reaproveitado da Central de Documentos'' ELSE ''Entregue pelo Hub Documental neste processo'' END || '' por ano de emissão ''');

  EXECUTE novo;
END
$motor$;

-- ── 4) NOTIFICACAO ao cliente tambem no status novo ─────────────────────────
-- Preco da opcao escolhida: `entregue_pelo_hub` nao dispara os gatilhos de
-- `aprovado`, entao a notificacao precisa ser ligada explicitamente.
DO $notif$
DECLARE d text; novo text; oid_alvo oid;
BEGIN
  SELECT p.oid INTO oid_alvo
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname='public' AND p.proname='qa_dispatch_exigencia_cumprida';
  IF oid_alvo IS NULL THEN
    RAISE EXCEPTION 'ABORTADO: qa_dispatch_exigencia_cumprida nao existe';
  END IF;
  d := pg_get_functiondef(oid_alvo);
  novo := replace(d,
    'IF NEW.status <> ''aprovado'' THEN RETURN NEW; END IF;',
    'IF NEW.status NOT IN (''aprovado'', ''entregue_pelo_hub'') THEN RETURN NEW; END IF;');
  novo := replace(novo,
    'IF TG_OP = ''UPDATE'' AND OLD.status = ''aprovado'' THEN RETURN NEW; END IF;',
    'IF TG_OP = ''UPDATE'' AND OLD.status IN (''aprovado'', ''entregue_pelo_hub'') THEN RETURN NEW; END IF;');
  IF novo = d THEN
    RAISE EXCEPTION 'ABORTADO: guarda de status nao encontrada em qa_dispatch_exigencia_cumprida';
  END IF;
  EXECUTE novo;
END
$notif$;

-- ── 5) BACKFILL SILENCIOSO do historico ─────────────────────────────────────
-- Requisito explicito do usuario: NAO renotificar ninguem. Os dois gatilhos que
-- disparam em cumprimento sao desabilitados dentro da transacao e reabilitados
-- no mesmo COMMIT.
DO $off$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['trg_qa_processo_doc_verde','trg_qa_admin_notif_doc_processo'] LOOP
    IF EXISTS (SELECT 1 FROM pg_trigger g
                JOIN pg_class c ON c.oid = g.tgrelid
               WHERE c.relname = 'qa_processo_documentos' AND g.tgname = t) THEN
      EXECUTE format('ALTER TABLE public.qa_processo_documentos DISABLE TRIGGER %I', t);
    ELSE
      RAISE EXCEPTION 'ABORTADO: gatilho % nao existe — nao posso garantir silencio', t;
    END IF;
  END LOOP;
END
$off$;

UPDATE public.qa_processo_documentos pd
   SET status = 'entregue_pelo_hub',
       metadados_documento_json = COALESCE(pd.metadados_documento_json, '{}'::jsonb)
         || jsonb_build_object(
              'reutilizado_do_hub', false,
              'reaproveitado_da_central', false,
              'entregue_pelo_hub', true,
              'reclassificado_em', now(),
              'reclassificado_motivo', 'entrega feita durante o processo, nao reuso'
            ),
       updated_at = now()
  FROM public.qa_processos p,
       public.qa_documentos_cliente dc
 WHERE p.id = pd.processo_id
   AND dc.id = (pd.metadados_documento_json ->> 'hub_documento_id')::uuid
   AND pd.status = 'dispensado_por_reaproveitamento'
   AND dc.created_at >= p.data_criacao;

ALTER TABLE public.qa_processo_documentos ENABLE TRIGGER trg_qa_processo_doc_verde;
ALTER TABLE public.qa_processo_documentos ENABLE TRIGGER trg_qa_admin_notif_doc_processo;

-- Rede de seguranca: se por qualquer motivo um gatilho ficar desabilitado,
-- a transacao inteira e desfeita em vez de deixar o banco sem notificacao.
DO $chk$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
              WHERE c.relname = 'qa_processo_documentos'
                AND g.tgname IN ('trg_qa_processo_doc_verde','trg_qa_admin_notif_doc_processo')
                AND g.tgenabled = 'D') THEN
    RAISE EXCEPTION 'ABORTADO: gatilho ficou desabilitado ao final';
  END IF;
END
$chk$;

COMMIT;
