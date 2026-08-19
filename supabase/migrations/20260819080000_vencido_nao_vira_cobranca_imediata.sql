-- =============================================================================
-- DOCUMENTO VENCIDO PARA DE VIRAR COBRANÇA IMEDIATA
--
-- DECISÃO DO USUÁRIO (19/08/2026), a partir do caso do Gilson e estendida a
-- TODOS os clientes: "não peça reemissão agora; o momento é quando o
-- requerimento estiver pronto".
--
-- O PROBLEMA. Cartão CNPJ, QSA e certidões de antecedentes valem 30 dias. Um
-- processo leva mais que isso. Com a varredura diária ligada ontem, o documento
-- vencia e a exigência voltava para `pendente` na manhã seguinte — o cliente ia
-- atrás, pagava, entregava, e o documento vencia de novo antes do protocolo.
-- Ele pagaria duas ou três vezes pela mesma certidão sem sair do lugar. É
-- esteira, não progresso. O primeiro caso cairia em 21/08 (Anthony), o segundo
-- em 22/08 (QSA do Gilson).
--
-- A REGRA NOVA, em uma frase: vencimento marca a exigência como VENCIDA; a
-- reemissão só é pedida ao cliente quando o processo chega a
-- `pronto_para_protocolar`.
--
--   • VENCIDO   → status `expirado`, e o ARQUIVO FICA. A equipe precisa ver o
--                 que venceu; o cliente precisa reconhecer o documento quando a
--                 reemissão for pedida. Some da fila do cliente, não da tela.
--   • REPROVADO → continua virando `pendente` na hora, com o arquivo limpo.
--                 Ali não há o que esperar: o arquivo está errado agora.
--
-- É O MESMO TRATAMENTO QUE A GRU JÁ RECEBIA. Ver `etapaFinalProtocolo.ts`: a
-- taxa da PF não é oferecida enquanto o cliente junta certidão, porque
-- "dinheiro do cliente não pode depender de ele ter lido o aviso com atenção".
-- Reemissão de certidão é o mesmo dinheiro e o mesmo raciocínio, e agora passa
-- pelo mesmo portão (`exigenciaCobravelAgora`).
--
-- POR QUE `expirado` E NÃO UM STATUS NOVO: ele já está no vocabulário da tabela
-- (`chk_qa_processo_documentos_status`) desde o começo, já é traduzido para
-- "VENCIDO" pelo dicionário do front (`statusDocumento.ts`) e nunca foi escrito
-- por ninguém. Estava reservado exatamente para isto.
--
-- LADO DO CÓDIGO, que sobe junto (sem ele esta migration não resolve nada):
--   • src/lib/quero-armas/reemissaoVencido.ts        (regra + espelho Deno)
--   • src/lib/quero-armas/etapaFinalProtocolo.ts     (o portão único)
--   • supabase/functions/_shared/checklistVisibility.ts
--       → exigência vencida NÃO conta para "o processo está pronto". Sem isso,
--         o processo nunca chegaria a `pronto_para_protocolar` e a reemissão
--         nunca seria pedida. Uma esperando a outra, para sempre.
--
-- ── Por que PATCH e não CREATE OR REPLACE ───────────────────────────────────
-- Mesmo motivo de 20260815170000 e 20260819060000: o corpo vivo já recebeu dois
-- patches (o parâmetro `p_storage_path` e a guarda de `nao_aplicavel`). Recriar
-- a função a partir do arquivo original apagaria os dois em silêncio. Lemos o
-- corpo vivo, trocamos só as âncoras, e abortamos se alguma não existir.
--
-- Idempotente: se o corpo vivo já tiver 'expirado', não faz nada.
-- =============================================================================

BEGIN;

DO $migration$
DECLARE
  v_oid  oid;
  v_def  text;
  v_novo text;
  -- "Este documento venceu" (e não "foi reprovado"). Repetido em cada coluna
  -- de propósito: é a única forma de manter o UPDATE em uma passada só.
  v_venc CONSTANT text :=
    '(dc.status = ''aprovado'' AND dc.data_validade IS NOT NULL AND dc.data_validade < CURRENT_DATE)';
BEGIN
  SELECT p.oid INTO v_oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'qa_reabrir_exigencias_documento_invalido'
   ORDER BY p.pronargs DESC
   LIMIT 1;

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'qa_reabrir_exigencias_documento_invalido não encontrada.';
  END IF;

  v_def := pg_get_functiondef(v_oid);

  IF position('''expirado''' in v_def) > 0 THEN
    RAISE NOTICE 'A regra de vencido já está no corpo vivo. Nada a fazer.';
    RETURN;
  END IF;

  -- ── 1) Não reprocessar o que já foi marcado como vencido ─────────────────
  -- Sem isto o vencido seria reescrito TODA madrugada e geraria um evento por
  -- dia no histórico do processo.
  IF position('NOT IN (''pendente'', ''nao_aplicavel'')' in v_def) = 0 THEN
    RAISE EXCEPTION
      'Âncora do filtro de status não encontrada no corpo vivo — a migration '
      '20260819060000 (guarda de nao_aplicavel) foi aplicada? Reveja antes de seguir.';
  END IF;

  v_novo := replace(
    v_def,
    'NOT IN (''pendente'', ''nao_aplicavel'')',
    'NOT IN (''pendente'', ''nao_aplicavel'', ''expirado'')'
  );

  -- ── 2) Vencido vira `expirado` e MANTÉM o arquivo ────────────────────────
  IF v_novo !~ 'SET\s+status\s*=\s*''pendente''' THEN
    RAISE EXCEPTION
      'Âncora do SET (status = ''pendente'') não encontrada no corpo vivo da função.';
  END IF;

  v_novo := regexp_replace(
    v_novo,
    'SET\s+status\s*=\s*''pendente'',\s*' ||
    'arquivo_url\s*=\s*NULL,\s*' ||
    'arquivo_storage_key\s*=\s*NULL,\s*' ||
    'data_envio\s*=\s*NULL,\s*' ||
    'data_validacao\s*=\s*NULL,\s*' ||
    'dados_extraidos_json\s*=\s*NULL,\s*' ||
    'motivo_rejeicao\s*=\s*NULL,\s*' ||
    'validacao_ia_status\s*=\s*NULL,\s*' ||
    'validacao_ia_erro\s*=\s*NULL',
    'SET status               = CASE WHEN ' || v_venc || ' THEN ''expirado'' ELSE ''pendente'' END,' || E'\n' ||
    '           -- VENCIDO guarda tudo: some da fila do cliente, não da tela.' || E'\n' ||
    '           -- REPROVADO limpa, como sempre: aquele arquivo não serve mais.' || E'\n' ||
    '           arquivo_url          = CASE WHEN ' || v_venc || ' THEN pd.arquivo_url          ELSE NULL END,' || E'\n' ||
    '           arquivo_storage_key  = CASE WHEN ' || v_venc || ' THEN pd.arquivo_storage_key  ELSE NULL END,' || E'\n' ||
    '           data_envio           = CASE WHEN ' || v_venc || ' THEN pd.data_envio           ELSE NULL END,' || E'\n' ||
    '           data_validacao       = CASE WHEN ' || v_venc || ' THEN pd.data_validacao       ELSE NULL END,' || E'\n' ||
    '           dados_extraidos_json = CASE WHEN ' || v_venc || ' THEN pd.dados_extraidos_json ELSE NULL END,' || E'\n' ||
    '           motivo_rejeicao      = NULL,' || E'\n' ||
    '           validacao_ia_status  = CASE WHEN ' || v_venc || ' THEN pd.validacao_ia_status  ELSE NULL END,' || E'\n' ||
    '           validacao_ia_erro    = CASE WHEN ' || v_venc || ' THEN pd.validacao_ia_erro    ELSE NULL END',
    ''
  );

  -- ── 3) O evento passa a dizer a verdade nova ─────────────────────────────
  -- Só o ramo do VENCIDO muda. O do reprovado continua com o texto antigo,
  -- porque nele a exigência realmente voltou a ser cobrada agora.
  IF position('''. A exigência voltou a ser cobrada.''' in v_novo) = 0 THEN
    RAISE EXCEPTION 'Âncora do texto do evento (ramo vencido) não encontrada no corpo vivo.';
  END IF;

  v_novo := replace(
    v_novo,
    '''. A exigência voltou a ser cobrada.''',
    '''. NÃO será pedida reemissão agora: o documento vale poucos dias e o '' || '
    '''cliente pagaria de novo. A reemissão entra na fila quando o processo '' || '
    '''ficar pronto para protocolar.'''
  );

  EXECUTE v_novo;
END
$migration$;

COMMIT;
