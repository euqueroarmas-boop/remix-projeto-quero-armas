-- =============================================================================
-- A CERTIDÃO ENVIADA NO PROCESSO VIRA PATRIMÔNIO DO CLIENTE — e sabe de que
-- ESTADO ela é
-- -----------------------------------------------------------------------------
-- Autorizado pelo titular em 21/08/2026: "Pode aplicar assim. E quero a trava do
-- estado junto. E importante: se o cliente muda de estado apresentando um novo
-- comprovante, a exigência dos antecedentes é daquele estado."
--
-- ─── O QUE ESTAVA ERRADO ─────────────────────────────────────────────────────
--
-- O motor de reaproveitamento (qa_reaproveitar_documentos_hub_processo) funciona
-- bem: aponta dois processos para o MESMO arquivo guardado, sem copiar nada, e
-- roda sozinho quando o processo é criado. O problema é que NINGUÉM alimenta o
-- cofre a partir do checklist. Conferido: são 11 pontos no sistema que inserem
-- em qa_documentos_cliente e nenhum vem do processo — nem a porta do cliente,
-- nem a da equipe, nem a validação por IA.
--
-- Resultado medido em 21/08: o cofre tem 6 a 8 certidões de cada tipo, TODAS
-- dentro da validade, e só 4 linhas de processo foram reaproveitadas. A certidão
-- que o cliente sobe dentro de um processo morre ali — nunca vira patrimônio
-- dele, nunca serve ao processo seguinte.
--
-- ─── O QUE MUDOU DEPOIS DA REVISÃO ADVERSARIAL (21/08, 4 lentes) ─────────────
--
-- Esta migration foi escrita, revisada e REESCRITA. O que a revisão pegou e que
-- está corrigido aqui:
--
--  1. BLOQUEANTE — o espelho lia NEW.arquivo_nome e NEW.arquivo_mime, colunas
--     que NÃO existem em qa_processo_documentos (existem só no cofre). O nome
--     agora sai do próprio caminho do arquivo e o mime fica de fora.
--  2. BLOQUEANTE — gravava origem = 'checklist_do_processo', valor que o CHECK
--     qa_documentos_cliente_origem_chk recusa ('admin','cliente','sistema',
--     'scanner','importacao'). Passa a gravar 'sistema', e a procedência real
--     fica em metadados_documento_json.origem_detalhada.
--  3. O espelho NUNCA pode derrubar a aprovação do documento. Agora o INSERT
--     roda dentro de bloco com EXCEPTION: se qualquer coisa der errado (tipo
--     fora do vocabulário do cofre, cascata de gatilho, o que for), ele avisa
--     no log e a aprovação segue.
--  4. O GATILHO QUE REABRIA CERTIDÃO POR MUDANÇA DE ESTADO SAIU DAQUI. Ele
--     apagava o ponteiro do arquivo e disparava até no PRIMEIRO preenchimento
--     do estado. A mudança de estado passa a ser tratada na migration seguinte
--     (20260821080000), onde o estado antigo vira RESIDÊNCIA ANTERIOR e a
--     certidão antiga é MOVIDA para a exigência do estado anterior — nada é
--     apagado.
--  5. A lista de status de processo escrita à mão contradizia a regra canônica
--     de 20260821010000 (deixava de fora 'notificado' e 'recurso_administrativo',
--     que são justamente quando o relógio VOLTA). Passa a usar o portão
--     qa_processo_relogio_parado. ATENÇÃO: comportamento COMPARTILHADO — ver
--     "ALCANCE" abaixo.
--  6. qa_certidao_e_territorial via só 6 códigos; o cofre aceita dezenas. Agora
--     reconhece também as famílias por UF e por TRF.
--  7. O backfill disparava sino do admin e notificação ao cliente por linha.
--     Agora silencia os dois gatilhos, como manda o precedente de 20260813000000.
--  8. O backfill em massa virou laço linha a linha com EXCEPTION: uma linha
--     problemática não derruba mais a transação inteira.
--  9. O carimbo em massa do cofre pelo estado ATUAL do cliente rotularia como
--     "do estado novo" certidão emitida no estado antigo. Foi retirado: no
--     cofre só é carimbado o que o próprio código do documento já declara.
--     NULL não bloqueia nada, então não carimbar é o lado seguro.
--
-- ─── ALCANCE (COMPORTAMENTO COMPARTILHADO — LEIA ANTES DE APLICAR) ───────────
--
-- Dois pontos desta migration mexem em regra que vale para TODOS os tipos de
-- documento, não só certidão:
--
--  (a) qa_doc_hub_satisfaz_exigencias_processo passa a NÃO escrever em processo
--      cujo relógio está parado (pós-protocolo sem exigência aberta). Efeito
--      para os demais documentos: um documento aprovado no cofre deixa de
--      reescrever, sozinho, o dossiê que já foi entregue ao órgão. É a mesma
--      regra da Lei 9.784/99 que 20260821010000 já aplicou aos prazos.
--  (b) o mesmo gatilho passa a recusar certidão TERRITORIAL de estado diferente
--      do estado do cliente. Documento que não é certidão territorial não é
--      afetado — a função devolve FALSE e o filtro nem entra.
--
-- Reexecutável. Duas transações: a segunda mexe em dado e não deve segurar
-- lock de DDL.
-- =============================================================================

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ TRANSAÇÃO 1 — estrutura e regra                                           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
BEGIN;

-- ─── 1) Que certidões dependem do estado ─────────────────────────────────────
-- Justiça Eleitoral e Justiça Militar da UNIÃO valem no país inteiro e ficam de
-- fora: nunca são travadas por estado.
--
-- Além dos códigos genéricos (que significam "do estado onde o cliente mora
-- HOJE"), reconhece as famílias que carregam a UF no próprio nome — são elas
-- que a migration 20260821080000 usa para a residência ANTERIOR.
CREATE OR REPLACE FUNCTION public.qa_certidao_e_territorial(p_tipo text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN btrim(lower(coalesce(p_tipo, ''))) IN (
      'antecedentes_federal_trf3_regional',   -- Justiça Federal, região do cliente
      'antecedentes_federal_sjsp_jef',        -- Seção Judiciária do estado + JEF
      'antecedentes_estadual_distribuicao',   -- Tribunal de Justiça do estado
      'antecedentes_estadual_execucoes',      -- Tribunal de Justiça do estado
      'antecedentes_criminais',               -- Polícia Civil do estado
      'antecedentes_militar_estadual',        -- Tribunal de Justiça Militar
      'antecedentes_estadual',                -- genérico legado do cofre
      'antecedentes_federal'                  -- genérico legado do cofre
    ) THEN true
    -- Famílias que já trazem a UF no código (residência anterior). As 27
    -- siglas vão por extenso, nunca [a-z]{2}: 'antecedentes_criminais_zz' não
    -- é documento nenhum e não pode virar exigência nem carimbo de estado.
    WHEN btrim(lower(coalesce(p_tipo, ''))) ~
         '^antecedentes_(estadual_(distribuicao|execucoes)|criminais|militar_estadual|federal_secao_judiciaria)_(ac|al|am|ap|ba|ce|df|es|go|ma|mg|ms|mt|pa|pb|pe|pi|pr|rj|rn|ro|rr|rs|sc|se|sp|to)$'
      THEN true
    WHEN btrim(lower(coalesce(p_tipo, ''))) ~ '^antecedentes_estadual_(ac|al|am|ap|ba|ce|df|es|go|ma|mg|ms|mt|pa|pb|pe|pi|pr|rj|rn|ro|rr|rs|sc|se|sp|to)$' THEN true
    WHEN btrim(lower(coalesce(p_tipo, ''))) ~ '^antecedentes_federal_trf[1-6]_regional$' THEN true
    WHEN btrim(lower(coalesce(p_tipo, ''))) ~ '^antecedentes_federal_regional_trf[1-6]$' THEN true
    ELSE false
  END;
$$;

COMMENT ON FUNCTION public.qa_certidao_e_territorial(text) IS
  'TRUE quando a certidão depende de um estado. As da União (Justiça Eleitoral, '
  'Justiça Militar da União) devolvem FALSE — valem no país inteiro. Reconhece '
  'tanto os códigos genéricos (estado ATUAL do cliente) quanto as famílias que '
  'trazem a UF no nome (residência ANTERIOR).';

GRANT EXECUTE ON FUNCTION public.qa_certidao_e_territorial(text) TO authenticated, service_role;

-- ─── 1.1) De que estado é a certidão, quando o próprio código diz ────────────
-- 'antecedentes_estadual_distribuicao_mg' → 'MG'. Código genérico → NULL, e
-- NULL aqui significa "é do estado onde o cliente mora hoje".
CREATE OR REPLACE FUNCTION public.qa_certidao_uf_do_tipo(p_tipo text)
RETURNS char(2)
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN btrim(lower(coalesce(p_tipo, ''))) ~
         '^antecedentes_(estadual_(distribuicao|execucoes)|criminais|militar_estadual|federal_secao_judiciaria)_(ac|al|am|ap|ba|ce|df|es|go|ma|mg|ms|mt|pa|pb|pe|pi|pr|rj|rn|ro|rr|rs|sc|se|sp|to)$'
      THEN upper(right(btrim(lower(p_tipo)), 2))::char(2)
    WHEN btrim(lower(coalesce(p_tipo, ''))) ~ '^antecedentes_estadual_(ac|al|am|ap|ba|ce|df|es|go|ma|mg|ms|mt|pa|pb|pe|pi|pr|rj|rn|ro|rr|rs|sc|se|sp|to)$'
      THEN upper(right(btrim(lower(p_tipo)), 2))::char(2)
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.qa_certidao_uf_do_tipo(text) IS
  'Extrai a UF do código do documento quando ela está no próprio nome '
  '(residência anterior). NULL para os códigos genéricos, que se referem ao '
  'estado atual do cliente. A família federal por região devolve NULL de '
  'propósito: ela é por TRF, não por UF.';

GRANT EXECUTE ON FUNCTION public.qa_certidao_uf_do_tipo(text) TO authenticated, service_role;

-- ─── 2) O estado a que a certidão se refere ──────────────────────────────────
-- NULL significa "não sei" e é tratado como PERMITIDO em todos os pontos: quem
-- já está no cofre hoje não passa a ser bloqueado por falta de carimbo. Só
-- documento novo nasce carimbado, e o cofre vai ficando exato com o tempo.
ALTER TABLE public.qa_documentos_cliente
  ADD COLUMN IF NOT EXISTS uf_referencia char(2);

ALTER TABLE public.qa_processo_documentos
  ADD COLUMN IF NOT EXISTS uf_referencia char(2);

COMMENT ON COLUMN public.qa_documentos_cliente.uf_referencia IS
  'Estado a que a certidão territorial se refere (o tribunal que a emitiu). '
  'NULL = desconhecido, e desconhecido NÃO bloqueia reaproveitamento. Lido por '
  'qa_reaproveitar_documentos_hub_processo e por qa_doc_hub_satisfaz_exigencias_processo.';
COMMENT ON COLUMN public.qa_processo_documentos.uf_referencia IS
  'Estado a que a exigência se refere. Nos códigos genéricos é o estado onde o '
  'cliente mora hoje; nos códigos por UF (residência anterior) é o estado do '
  'próprio código.';

-- ─── 3) O espelho: certidão aprovada no processo entra no cofre ──────────────
-- Sem copiar arquivo. O cofre aponta para o mesmo caminho do storage e guarda
-- em metadados o bucket de origem — padrão que qa-hub-doc-signed-url e os
-- painéis do portal já leem (metadados_documento_json.bucket).
--
-- REGRA DE OURO: este gatilho NUNCA pode derrubar a aprovação do documento.
-- Se o INSERT falhar por qualquer motivo, ele avisa no log e devolve NEW.
CREATE OR REPLACE FUNCTION public.qa_espelha_certidao_do_checklist_no_cofre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_arquivo text;
  v_nome    text;
  v_cli     public.qa_clientes%ROWTYPE;
  v_uf      char(2);
BEGIN
  -- Só na APROVAÇÃO, e só uma vez.
  IF NEW.status <> 'aprovado' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'aprovado' THEN RETURN NEW; END IF;

  -- SÓ as certidões de antecedentes. Laudo, GRU, comprovante de pagamento,
  -- juntada e contrato NÃO entram no cofre — o cofre é monitorado por
  -- vencimento e não é lugar de documento de processo.
  IF NEW.tipo_documento NOT LIKE 'antecedentes\_%' THEN RETURN NEW; END IF;

  v_arquivo := coalesce(nullif(NEW.arquivo_storage_key,''), nullif(NEW.arquivo_url,''));
  IF v_arquivo IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_cli FROM public.qa_clientes WHERE id = NEW.cliente_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- LGPD: cliente excluído não recebe documento novo no cofre.
  IF COALESCE(v_cli.status,'') = 'excluido_lgpd' OR COALESCE(v_cli.excluido,false) THEN
    RETURN NEW;
  END IF;

  -- Carimbo do estado: primeiro o que o próprio código do documento diz
  -- (residência anterior), depois o da linha, depois o do cadastro.
  IF public.qa_certidao_e_territorial(NEW.tipo_documento) THEN
    v_uf := COALESCE(
              public.qa_certidao_uf_do_tipo(NEW.tipo_documento),
              NEW.uf_referencia,
              public.qa_uf_normalizar(v_cli.estado));
  ELSE
    v_uf := NULL;   -- certidão da União não tem estado
  END IF;

  -- Já está no cofre? Então não faz nada.
  IF EXISTS (
    SELECT 1 FROM public.qa_documentos_cliente dc
     WHERE dc.qa_cliente_id = NEW.cliente_id
       AND dc.arquivo_storage_path = v_arquivo
       AND dc.tipo_documento = NEW.tipo_documento
  ) THEN
    RETURN NEW;
  END IF;

  -- Nome do arquivo: qa_processo_documentos não guarda arquivo_nome. Sai do
  -- próprio caminho, que é o que a tela mostra quando não há nome melhor.
  v_nome := NULLIF(split_part(v_arquivo, '/',
              array_length(string_to_array(v_arquivo, '/'), 1)), '');

  BEGIN
    INSERT INTO public.qa_documentos_cliente (
      qa_cliente_id, customer_id, tipo_documento, nome_documento,
      arquivo_storage_path, arquivo_nome,
      data_emissao, data_validade, orgao_emissor,
      status, validado_admin, aprovado_em, origem,
      ia_dados_extraidos, uf_referencia, escopo_documental,
      metadados_documento_json
    ) VALUES (
      NEW.cliente_id, v_cli.customer_id, NEW.tipo_documento, NEW.nome_documento,
      v_arquivo, v_nome,
      NEW.data_emissao, NEW.data_validade, NEW.orgao_emissor,
      'aprovado', true, now(), 'sistema',
      NEW.dados_extraidos_json, v_uf, 'permanente',
      jsonb_build_object(
        -- O arquivo continua no bucket do processo; o cofre só aponta.
        'bucket', 'qa-processo-docs',
        'origem_detalhada', 'checklist_do_processo',
        'espelhado_do_checklist', true,
        'processo_id', NEW.processo_id,
        'processo_documento_id', NEW.id,
        'espelhado_em', now()
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- O espelho é um GANHO, não uma condição. Se falhar, a aprovação do
    -- documento no processo continua valendo.
    RAISE WARNING 'espelho cofre falhou para processo_documento % (tipo %): %',
      NEW.id, NEW.tipo_documento, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.qa_espelha_certidao_do_checklist_no_cofre() IS
  'Certidão de antecedentes aprovada dentro de um processo passa a existir '
  'também no cofre do cliente, apontando para o MESMO arquivo. É o que faltava '
  'para o motor de reaproveitamento enxergar o que foi entregue no checklist. '
  'Nunca derruba a aprovação: falha vira WARNING.';

DROP TRIGGER IF EXISTS qa_trg_espelha_certidao_no_cofre ON public.qa_processo_documentos;
CREATE TRIGGER qa_trg_espelha_certidao_no_cofre
  AFTER INSERT OR UPDATE OF status
  ON public.qa_processo_documentos
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_espelha_certidao_do_checklist_no_cofre();

-- ─── 4) O carimbo do estado nas certidões do processo ────────────────────────
-- Toda certidão territorial que entra num processo nasce sabendo de que estado
-- é: do código, quando ele traz a UF; do cadastro, quando é genérica.
CREATE OR REPLACE FUNCTION public.qa_carimba_uf_da_certidao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_estado  text;
  v_do_tipo char(2);
BEGIN
  IF NOT public.qa_certidao_e_territorial(NEW.tipo_documento) THEN RETURN NEW; END IF;

  -- Código que traz a UF manda sempre — inclusive corrigindo carimbo errado.
  v_do_tipo := public.qa_certidao_uf_do_tipo(NEW.tipo_documento);
  IF v_do_tipo IS NOT NULL THEN
    NEW.uf_referencia := v_do_tipo;
    RETURN NEW;
  END IF;

  IF NEW.uf_referencia IS NOT NULL THEN RETURN NEW; END IF;

  -- Genérica: só carimba quando o documento de fato chegou. Slot vazio não
  -- ganha estado — senão a exigência ficaria presa a um endereço antigo.
  IF coalesce(nullif(NEW.arquivo_storage_key,''), nullif(NEW.arquivo_url,'')) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT cl.estado INTO v_estado
    FROM public.qa_clientes cl WHERE cl.id = NEW.cliente_id;
  NEW.uf_referencia := public.qa_uf_normalizar(v_estado);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS qa_trg_carimba_uf_da_certidao ON public.qa_processo_documentos;
CREATE TRIGGER qa_trg_carimba_uf_da_certidao
  BEFORE INSERT OR UPDATE OF arquivo_storage_key, arquivo_url, status, tipo_documento
  ON public.qa_processo_documentos
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_carimba_uf_da_certidao();

-- ─── 5) O motor deixa de aceitar certidão de outro estado ────────────────────
-- ATENÇÃO: a definição VIVA de qa_reaproveitar_documentos_hub_processo NÃO
-- existe inteira em nenhum arquivo. A migration 20260813000000 a alterou por
-- SUBSTITUIÇÃO DE TEXTO sobre pg_get_functiondef (taxonomia reaproveitado x
-- entregue_pelo_hub). Recriar do arquivo reverteria aquilo em silêncio.
-- Por isso aqui se usa a MESMA técnica: patch textual, que preserva o que
-- estiver vivo e ABORTA se não encontrar o alvo.
--
-- A trava só morde os códigos GENÉRICOS (os que significam "estado atual").
-- Código que traz a UF no nome é auto-explicativo: só encontra slot do mesmo
-- código, então não precisa — e não pode — ser comparado ao estado atual,
-- senão a certidão da residência anterior nunca seria reaproveitada.
DO $motor$
DECLARE
  d        text;
  novo     text;
  oid_alvo oid;
  alvo     text := 'AND NOT public.qa_comprovante_terceiro_pendente(dc.id)';
  v_qtd    int;
BEGIN
  SELECT p.oid INTO oid_alvo
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public'
     AND p.proname = 'qa_reaproveitar_documentos_hub_processo';
  IF oid_alvo IS NULL THEN
    RAISE EXCEPTION 'ABORTADO: motor de reaproveitamento nao encontrado';
  END IF;
  d := pg_get_functiondef(oid_alvo);

  -- Já tem a trava? Então não faz nada (idempotência).
  IF position('qa_certidao_e_territorial' in d) > 0 THEN
    RAISE NOTICE 'Trava de estado ja presente no motor — nada a fazer.';
    RETURN;
  END IF;

  -- Quantas vezes o alvo aparece. A revisão mostrou que são DUAS (o motor tem
  -- dois caminhos de elegibilidade); as duas recebem a trava, e o número fica
  -- registrado no log para conferência.
  v_qtd := (length(d) - length(replace(d, alvo, ''))) / length(alvo);
  IF v_qtd = 0 THEN
    RAISE EXCEPTION 'ABORTADO: filtro de elegibilidade do cofre nao encontrado no motor';
  END IF;
  RAISE NOTICE 'Trava de estado aplicada em % ocorrencia(s) do filtro.', v_qtd;

  novo := replace(d, alvo, alvo || '
       -- TRAVA DE ESTADO (21/08/2026): certidao territorial GENERICA so serve
       -- se for do estado onde o cliente mora HOJE. Codigo que ja traz a UF
       -- (residencia anterior) passa direto. Sem carimbo (NULL) nao bloqueia.
       AND (NOT public.qa_certidao_e_territorial(dc.tipo_documento)
            OR public.qa_certidao_uf_do_tipo(dc.tipo_documento) IS NOT NULL
            OR dc.uf_referencia IS NULL
            OR dc.uf_referencia = public.qa_uf_normalizar(v_cli.estado))');

  EXECUTE novo;
END
$motor$;

-- ─── 6) O gatilho do cofre também respeita o estado ──────────────────────────
-- Existe um SEGUNDO caminho, mais frouxo, que fecha exigência sem passar pelo
-- motor: o gatilho de aprovação no cofre. Ele precisa da mesma trava — e passa
-- a respeitar o congelamento pós-protocolo pelo portão canônico
-- qa_processo_relogio_parado (uma definição, vários usuários).
CREATE OR REPLACE FUNCTION public.qa_doc_hub_satisfaz_exigencias_processo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cliente_id integer;
  v_ano_doc    smallint;
  v_uf_cliente char(2);
  v_uf_doc     char(2);
BEGIN
  IF NEW.status <> 'aprovado' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'aprovado' THEN RETURN NEW; END IF;
  IF NEW.data_validade IS NOT NULL AND NEW.data_validade < CURRENT_DATE THEN RETURN NEW; END IF;

  v_cliente_id := NEW.qa_cliente_id;
  IF v_cliente_id IS NULL AND NEW.customer_id IS NOT NULL THEN
    SELECT id INTO v_cliente_id FROM public.qa_clientes WHERE customer_id = NEW.customer_id LIMIT 1;
  END IF;
  IF v_cliente_id IS NULL THEN RETURN NEW; END IF;

  SELECT public.qa_uf_normalizar(cl.estado) INTO v_uf_cliente
    FROM public.qa_clientes cl WHERE cl.id = v_cliente_id;

  -- TRAVA DE ESTADO: certidão territorial GENÉRICA de outro estado não fecha
  -- exigência. Código que traz a UF no nome é da residência anterior e só casa
  -- com slot do mesmo código — passa direto.
  v_uf_doc := public.qa_certidao_uf_do_tipo(NEW.tipo_documento);
  IF public.qa_certidao_e_territorial(NEW.tipo_documento)
     AND v_uf_doc IS NULL
     AND NEW.uf_referencia IS NOT NULL
     AND v_uf_cliente IS NOT NULL
     AND NEW.uf_referencia <> v_uf_cliente THEN
    RETURN NEW;
  END IF;

  -- Ano do documento: emissão quando houver, senão o envio.
  v_ano_doc := EXTRACT(YEAR FROM COALESCE(NEW.data_emissao, NEW.created_at, now()))::smallint;

  UPDATE public.qa_processo_documentos pd
  SET status='aprovado', arquivo_url=NEW.arquivo_storage_path, arquivo_storage_key=NEW.arquivo_storage_path,
      data_envio=COALESCE(NEW.created_at,now()), data_validacao=now(), dados_extraidos_json=NEW.ia_dados_extraidos,
      uf_referencia=COALESCE(pd.uf_referencia, NEW.uf_referencia)
  FROM public.qa_processos p
  WHERE p.id = pd.processo_id
    AND pd.cliente_id=v_cliente_id AND pd.status IN ('pendente','enviado','em_analise','revisao_humana')
    -- NOVO: dossiê já entregue ao órgão não é reescrito por documento do cofre.
    -- Notificação e recurso administrativo religam o relógio e voltam a aceitar.
    AND NOT public.qa_processo_relogio_parado(p.id)
    AND (pd.tipo_documento=NEW.tipo_documento OR pd.tipo_documento IN (
      SELECT processo_tipo FROM public.qa_tipo_documento_aliases WHERE hub_tipo=NEW.tipo_documento))
    -- Exigência por ano (CR / autorização CAC): só fecha o ano correspondente.
    AND (pd.ano_competencia IS NULL OR pd.ano_competencia = v_ano_doc);

  RETURN NEW;
END;$$;

COMMENT ON FUNCTION public.qa_doc_hub_satisfaz_exigencias_processo() IS
  'Documento aprovado no cofre fecha a exigência equivalente nos processos do '
  'cliente. Duas travas: certidão territorial genérica de outro estado não '
  'fecha nada, e processo com relógio parado (pós-protocolo sem exigência '
  'aberta) não é reescrito.';

COMMIT;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ TRANSAÇÃO 2 — o que já existe                                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
BEGIN;

-- Silencia os dois gatilhos de "documento mudou de status" durante o backfill.
-- Sem isso, cada linha espelhada vira aviso no sino do Admin e notificação ao
-- cliente, para documento que ninguém acabou de enviar. Mesmo padrão de
-- 20260813000000. O gatilho de log de evento continua ligado — é a auditoria.
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

-- 8.1 Carimba o estado nas certidões territoriais que JÁ estão nos processos.
--     Onde o código traz a UF, é ele que manda. Onde é genérico, usa o estado
--     atual do cadastro — é o único testemunho que existe, já que até hoje o
--     sistema não registrava mudança de endereço — e só em linha que já tem
--     arquivo, para não prender slot vazio a um endereço antigo.
UPDATE public.qa_processo_documentos pd
   SET uf_referencia = public.qa_certidao_uf_do_tipo(pd.tipo_documento)
 WHERE public.qa_certidao_uf_do_tipo(pd.tipo_documento) IS NOT NULL
   AND pd.uf_referencia IS DISTINCT FROM public.qa_certidao_uf_do_tipo(pd.tipo_documento);

UPDATE public.qa_processo_documentos pd
   SET uf_referencia = public.qa_uf_normalizar(cl.estado)
  FROM public.qa_clientes cl
 WHERE cl.id = pd.cliente_id
   AND pd.uf_referencia IS NULL
   AND public.qa_certidao_e_territorial(pd.tipo_documento)
   AND public.qa_certidao_uf_do_tipo(pd.tipo_documento) IS NULL
   AND coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,'')) IS NOT NULL
   AND public.qa_uf_normalizar(cl.estado) IS NOT NULL;

-- 8.2 No cofre, carimba SOMENTE o que o próprio código do documento declara.
--     Carimbar o cofre inteiro com o estado atual do cliente rotularia como "do
--     estado novo" certidão emitida no estado antigo — e aí a trava passaria a
--     aceitar exatamente o que deveria recusar. NULL não bloqueia nada, então
--     não carimbar é o lado seguro.
UPDATE public.qa_documentos_cliente dc
   SET uf_referencia = public.qa_certidao_uf_do_tipo(dc.tipo_documento)
 WHERE public.qa_certidao_uf_do_tipo(dc.tipo_documento) IS NOT NULL
   AND dc.uf_referencia IS DISTINCT FROM public.qa_certidao_uf_do_tipo(dc.tipo_documento);

-- 8.3 Espelha no cofre as certidões JÁ aprovadas nos processos. É o que
--     destrava o ganho imediato: o que o cliente já entregou passa a valer para
--     o próximo processo dele.
--
--     Linha a linha, com EXCEPTION por linha: um tipo que o CHECK do cofre não
--     conheça faz aquela linha ser pulada, não a migration inteira cair.
DO $backfill$
DECLARE
  r       record;
  v_nome  text;
  v_ok    integer := 0;
  v_pulou integer := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (pd.cliente_id,
                        coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,'')),
                        pd.tipo_documento)
           pd.id, pd.cliente_id, pd.processo_id, pd.tipo_documento, pd.nome_documento,
           coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,'')) AS arquivo,
           pd.data_emissao, pd.data_validade, pd.orgao_emissor,
           pd.dados_extraidos_json, pd.uf_referencia,
           cl.customer_id
      FROM public.qa_processo_documentos pd
      JOIN public.qa_clientes cl ON cl.id = pd.cliente_id
     WHERE pd.tipo_documento LIKE 'antecedentes\_%'
       AND pd.status IN ('aprovado','validado','conforme')
       AND coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,'')) IS NOT NULL
       AND COALESCE(cl.status,'') <> 'excluido_lgpd'
       AND COALESCE(cl.excluido,false) = false
       AND NOT EXISTS (
         SELECT 1 FROM public.qa_documentos_cliente dc
          WHERE dc.qa_cliente_id = pd.cliente_id
            AND dc.arquivo_storage_path = coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,''))
            AND dc.tipo_documento = pd.tipo_documento
       )
     ORDER BY pd.cliente_id,
              coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,'')),
              pd.tipo_documento,
              pd.data_validade DESC NULLS LAST,
              pd.updated_at DESC
  LOOP
    v_nome := NULLIF(split_part(r.arquivo, '/',
                array_length(string_to_array(r.arquivo, '/'), 1)), '');
    BEGIN
      INSERT INTO public.qa_documentos_cliente (
        qa_cliente_id, customer_id, tipo_documento, nome_documento,
        arquivo_storage_path, arquivo_nome,
        data_emissao, data_validade, orgao_emissor,
        status, validado_admin, aprovado_em, origem,
        ia_dados_extraidos, uf_referencia, escopo_documental,
        metadados_documento_json
      ) VALUES (
        r.cliente_id, r.customer_id, r.tipo_documento, r.nome_documento,
        r.arquivo, v_nome,
        r.data_emissao, r.data_validade, r.orgao_emissor,
        'aprovado', true, now(), 'sistema',
        r.dados_extraidos_json, r.uf_referencia, 'permanente',
        jsonb_build_object(
          'bucket', 'qa-processo-docs',
          'origem_detalhada', 'checklist_do_processo',
          'espelhado_do_checklist', true,
          'espelhado_no_backfill', true,
          'processo_id', r.processo_id,
          'processo_documento_id', r.id,
          'espelhado_em', now()
        )
      );
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_pulou := v_pulou + 1;
      RAISE WARNING 'backfill do espelho pulou processo_documento % (tipo %): %',
        r.id, r.tipo_documento, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Espelho no cofre: % linha(s) criada(s), % pulada(s).', v_ok, v_pulou;
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

-- Gatilho da primeira versão desta leva, que reabria certidão apagando o
-- ponteiro do arquivo e disparava até no primeiro preenchimento do estado.
-- Substituído pelo tratamento não destrutivo de 20260821080000.
DROP TRIGGER IF EXISTS qa_trg_mudanca_de_estado_reabre_certidoes ON public.qa_clientes;
DROP FUNCTION IF EXISTS public.qa_mudanca_de_estado_reabre_certidoes();

COMMIT;

-- =============================================================================
-- CONFERÊNCIA (rodar depois, UMA DE CADA VEZ)
--
-- A) Quantas certidões do checklist entraram no cofre pelo backfill.
--
-- SELECT count(*) AS espelhadas
--   FROM public.qa_documentos_cliente
--  WHERE metadados_documento_json ->> 'origem_detalhada' = 'checklist_do_processo';
--
-- B) O cofre por tipo, agora: quantas existem e quantas têm o estado carimbado.
--
-- SELECT tipo_documento,
--        count(*) AS no_cofre,
--        count(*) FILTER (WHERE uf_referencia IS NOT NULL) AS com_estado,
--        count(*) FILTER (WHERE data_validade >= current_date OR data_validade IS NULL) AS validas
--   FROM public.qa_documentos_cliente
--  WHERE tipo_documento LIKE 'antecedentes%'
--  GROUP BY tipo_documento
--  ORDER BY no_cofre DESC;
--
-- C) A trava de estado entrou no motor. Esperado: 1 linha.
--
-- SELECT count(*) AS motor_com_trava
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--    AND p.proname = 'qa_reaproveitar_documentos_hub_processo'
--    AND pg_get_functiondef(p.oid) LIKE '%qa_certidao_e_territorial%';
--
-- D) Os dois gatilhos novos existem e o destrutivo sumiu. Esperado: 2 linhas,
--    nenhuma delas 'qa_trg_mudanca_de_estado_reabre_certidoes'.
--
-- SELECT tgname FROM pg_trigger
--  WHERE tgname IN ('qa_trg_espelha_certidao_no_cofre',
--                   'qa_trg_carimba_uf_da_certidao',
--                   'qa_trg_mudanca_de_estado_reabre_certidoes')
--  ORDER BY tgname;
--
-- E) O ganho, medido: por cliente, quantas certidões válidas ele tem no cofre
--    que passam a servir a um próximo processo.
--
-- SELECT cl.nome_completo, cl.estado,
--        count(*) FILTER (WHERE dc.data_validade >= current_date OR dc.data_validade IS NULL)
--          AS certidoes_reaproveitaveis
--   FROM public.qa_documentos_cliente dc
--   JOIN public.qa_clientes cl ON cl.id = dc.qa_cliente_id
--  WHERE dc.tipo_documento LIKE 'antecedentes%'
--    AND dc.status = 'aprovado'
--  GROUP BY cl.id, cl.nome_completo, cl.estado
--  ORDER BY certidoes_reaproveitaveis DESC;
-- =============================================================================
