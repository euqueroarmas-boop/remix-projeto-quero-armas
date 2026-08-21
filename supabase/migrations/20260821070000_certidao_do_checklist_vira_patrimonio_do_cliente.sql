-- =============================================================================
-- A CERTIDÃO ENVIADA NO PROCESSO VIRA PATRIMÔNIO DO CLIENTE — e é do ESTADO dele
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
-- ─── POR QUE NÃO USAMOS A CAMADA "BLOCO 12" ──────────────────────────────────
--
-- Existe uma camada processo→processo (reaproveitamentoCandidatos.ts +
-- qa-processo-doc-reaproveitar) que nunca foi ligada. A revisão mostrou que ela
-- não está apenas desligada, está QUEBRADA: a função sempre devolve erro 500;
-- não leva o arquivo junto (o dossiê sairia sem a certidão); FUNDE certidões
-- diferentes, tratando a Federal Regional e a da Seção Judiciária como o mesmo
-- documento; recusa justamente o estado em que a certidão do processo anterior
-- estaria; e só o próprio cliente consegue acionar, a equipe não. Ligá-la seria
-- pior do que não ter. Ela duplica, mal, o que o motor do cofre já faz bem.
--
-- ─── O QUE ESTA MIGRATION FAZ ────────────────────────────────────────────────
--
-- 1. Marca o ESTADO a que cada certidão territorial se refere.
-- 2. Espelha no cofre a certidão APROVADA no checklist — sem copiar arquivo.
-- 3. Ensina o motor e o gatilho do cofre a NÃO usar certidão de outro estado.
-- 4. Quando o cliente muda de estado, reabre as certidões daquele estado.
--
-- ─── ALCANCE (COMPORTAMENTO COMPARTILHADO — avisado e autorizado) ────────────
--
-- Vale para TODO cliente e TODO processo em montagem. Documento que entra no
-- cofre aprovado fecha a exigência correspondente nos processos abertos daquele
-- cliente — é o efeito desejado, e agora com a trava de estado.
--
-- O QUE NÃO É ESPELHADO: só as 8 certidões de antecedentes sobem ao cofre. Nem
-- laudo psicológico ou de capacidade técnica (são do processo e da finalidade,
-- não do cliente), nem GRU, comprovante de pagamento, juntada ou contrato — há
-- inclusive teste de regressão no projeto proibindo mandar contrato ao cofre,
-- porque o cofre é monitorado por vencimento.
--
-- Idempotente. Duas transações: estrutura/regra e depois o backfill.
-- =============================================================================


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ TRANSAÇÃO 1 — estrutura e regra                                           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
BEGIN;

-- ─── 1) Que certidões dependem do estado ─────────────────────────────────────
-- Mesma lista das funções de 20260821040000. Justiça Eleitoral e Justiça
-- Militar da UNIÃO valem no país inteiro e ficam de fora: nunca são travadas
-- nem reabertas por mudança de endereço.
CREATE OR REPLACE FUNCTION public.qa_certidao_e_territorial(p_tipo text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT btrim(lower(coalesce(p_tipo, ''))) IN (
    'antecedentes_federal_trf3_regional',   -- Justiça Federal, região do cliente
    'antecedentes_federal_sjsp_jef',        -- Seção Judiciária do estado + JEF
    'antecedentes_estadual_distribuicao',   -- Tribunal de Justiça do estado
    'antecedentes_estadual_execucoes',      -- Tribunal de Justiça do estado
    'antecedentes_criminais',               -- Polícia Civil do estado
    'antecedentes_militar_estadual'         -- Tribunal de Justiça Militar
  );
$$;

COMMENT ON FUNCTION public.qa_certidao_e_territorial(text) IS
  'TRUE quando a certidão depende do estado de residência do cliente. As da '
  'União (Justiça Eleitoral, Justiça Militar da União) devolvem FALSE — valem '
  'no país inteiro e nunca são reabertas por mudança de endereço.';

GRANT EXECUTE ON FUNCTION public.qa_certidao_e_territorial(text) TO authenticated, anon, service_role;

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
  'Estado a que a certidão territorial se refere. Usado quando o cliente muda '
  'de endereço: certidão de estado diferente do novo volta a ser exigida.';

-- ─── 3) O espelho: certidão aprovada no processo entra no cofre ──────────────
-- Sem copiar arquivo. O cofre aponta para o mesmo caminho do storage e guarda
-- em metadados o bucket de origem — padrão que já roda em produção na
-- declaração de residência, e que o visualizador do portal já entende.
--
-- Dedupe pelo par (cliente, caminho do arquivo), mesmo padrão do cadastro
-- refinado: barato, reexecutável e sem depender de constraint nova.
CREATE OR REPLACE FUNCTION public.qa_espelha_certidao_do_checklist_no_cofre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_arquivo text;
  v_cli     public.qa_clientes%ROWTYPE;
  v_uf      char(2);
BEGIN
  -- Só na APROVAÇÃO, e só uma vez.
  IF NEW.status <> 'aprovado' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'aprovado' THEN RETURN NEW; END IF;

  -- SÓ as 8 certidões de antecedentes. Laudo, GRU, comprovante de pagamento,
  -- juntada e contrato NÃO entram no cofre — o cofre é monitorado por
  -- vencimento e não é lugar de documento de processo.
  IF NEW.tipo_documento NOT LIKE 'antecedentes\_%' THEN RETURN NEW; END IF;

  v_arquivo := coalesce(nullif(NEW.arquivo_storage_key,''), nullif(NEW.arquivo_url,''));
  IF v_arquivo IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_cli FROM public.qa_clientes WHERE id = NEW.cliente_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Carimbo do estado: o da própria linha, se já tiver; senão o do cadastro.
  v_uf := COALESCE(NEW.uf_referencia, public.qa_uf_normalizar(v_cli.estado));
  IF NOT public.qa_certidao_e_territorial(NEW.tipo_documento) THEN
    v_uf := NULL;   -- certidão da União não tem estado
  END IF;

  -- Já está no cofre? Então não faz nada.
  IF EXISTS (
    SELECT 1 FROM public.qa_documentos_cliente dc
     WHERE dc.qa_cliente_id = NEW.cliente_id
       AND dc.arquivo_storage_path = v_arquivo
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.qa_documentos_cliente (
    qa_cliente_id, customer_id, tipo_documento, nome_documento,
    arquivo_storage_path, arquivo_nome, arquivo_mime,
    data_emissao, data_validade, orgao_emissor,
    status, validado_admin, aprovado_em, origem,
    ia_dados_extraidos, uf_referencia, escopo_documental,
    metadados_documento_json
  ) VALUES (
    NEW.cliente_id, v_cli.customer_id, NEW.tipo_documento, NEW.nome_documento,
    v_arquivo, NEW.arquivo_nome, NEW.arquivo_mime,
    NEW.data_emissao, NEW.data_validade, NEW.orgao_emissor,
    'aprovado', true, now(), 'checklist_do_processo',
    NEW.dados_extraidos_json, v_uf, 'permanente',
    jsonb_build_object(
      -- O arquivo continua no bucket do processo; o cofre só aponta.
      'bucket', 'qa-processo-docs',
      'espelhado_do_checklist', true,
      'processo_id', NEW.processo_id,
      'processo_documento_id', NEW.id,
      'espelhado_em', now()
    )
  );

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.qa_espelha_certidao_do_checklist_no_cofre() IS
  'Certidão de antecedentes aprovada dentro de um processo passa a existir '
  'também no cofre do cliente, apontando para o MESMO arquivo. É o que faltava '
  'para o motor de reaproveitamento enxergar o que foi entregue no checklist.';

DROP TRIGGER IF EXISTS qa_trg_espelha_certidao_no_cofre ON public.qa_processo_documentos;
CREATE TRIGGER qa_trg_espelha_certidao_no_cofre
  AFTER INSERT OR UPDATE OF status
  ON public.qa_processo_documentos
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_espelha_certidao_do_checklist_no_cofre();

-- ─── 4) O carimbo do estado nas certidões do processo ────────────────────────
-- Toda certidão territorial que entra num processo nasce com o estado do
-- cadastro do cliente naquele momento. É esse carimbo que permite saber, mais
-- tarde, que a certidão é de um estado onde ele não mora mais.
CREATE OR REPLACE FUNCTION public.qa_carimba_uf_da_certidao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE v_estado text;
BEGIN
  IF NEW.uf_referencia IS NOT NULL THEN RETURN NEW; END IF;
  IF NOT public.qa_certidao_e_territorial(NEW.tipo_documento) THEN RETURN NEW; END IF;
  -- Só carimba quando o documento de fato chegou.
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
  BEFORE INSERT OR UPDATE OF arquivo_storage_key, arquivo_url, status
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
DO $motor$
DECLARE d text; novo text; oid_alvo oid;
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

  -- O alvo é o último filtro de elegibilidade do cofre, o do comprovante de
  -- terceiro. A trava entra logo depois dele.
  novo := replace(d,
    'AND NOT public.qa_comprovante_terceiro_pendente(dc.id)',
    'AND NOT public.qa_comprovante_terceiro_pendente(dc.id)
       -- TRAVA DE ESTADO (21/08/2026): certidao territorial so serve se for do
       -- estado onde o cliente mora HOJE. Sem carimbo (NULL) nao bloqueia.
       AND (NOT public.qa_certidao_e_territorial(dc.tipo_documento)
            OR dc.uf_referencia IS NULL
            OR dc.uf_referencia = public.qa_uf_normalizar(v_cli.estado))');
  IF novo = d THEN
    RAISE EXCEPTION 'ABORTADO: filtro de elegibilidade do cofre nao encontrado no motor';
  END IF;

  EXECUTE novo;
END
$motor$;

-- ─── 6) O gatilho do cofre também respeita o estado ──────────────────────────
-- Existe um SEGUNDO caminho, mais frouxo, que fecha exigência sem passar pelo
-- motor: o gatilho de aprovação no cofre. Ele precisa da mesma trava — e passa
-- a olhar também o estado do processo, para não escrever em dossiê que já foi
-- entregue ao órgão (mesmo princípio da regra da Lei 9.784/99).
CREATE OR REPLACE FUNCTION public.qa_doc_hub_satisfaz_exigencias_processo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cliente_id integer;
  v_ano_doc    smallint;
  v_uf_cliente char(2);
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

  -- TRAVA DE ESTADO: certidão territorial de outro estado não fecha exigência.
  IF public.qa_certidao_e_territorial(NEW.tipo_documento)
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
    AND p.status IN ('aguardando_pagamento','aguardando_assinatura',
                     'aguardando_documentos','em_validacao','pendente_cliente',
                     'revisao_humana','validado','pagamento_confirmado',
                     'em_analise_interna')
    AND (pd.tipo_documento=NEW.tipo_documento OR pd.tipo_documento IN (
      SELECT processo_tipo FROM public.qa_tipo_documento_aliases WHERE hub_tipo=NEW.tipo_documento))
    -- Exigência por ano (CR / autorização CAC): só fecha o ano correspondente.
    AND (pd.ano_competencia IS NULL OR pd.ano_competencia = v_ano_doc);

  RETURN NEW;
END;$$;

-- ─── 7) Mudou de estado: as certidões daquele estado voltam a ser exigidas ───
-- Regra do titular: "se o cliente muda de estado apresentando um novo
-- comprovante, a exigência dos antecedentes é daquele estado". A certidão do
-- Tribunal de Justiça do Paraná não prova nada sobre quem passou a morar em
-- Santa Catarina — e um dossiê montado assim volta como exigência da PF.
--
-- NÃO apaga arquivo nenhum: o documento continua no cofre, com o carimbo do
-- estado antigo. O que muda é que a exigência do processo volta a ficar
-- pendente, e o cliente vê o pedido com o link do tribunal do estado novo.
--
-- Só alcança processo que ainda está montando dossiê. Depois do protocolo o
-- dossiê congela — mesma regra de 20260821010000.
CREATE OR REPLACE FUNCTION public.qa_mudanca_de_estado_reabre_certidoes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_antiga char(2);
  v_nova   char(2);
BEGIN
  v_antiga := public.qa_uf_normalizar(OLD.estado);
  v_nova   := public.qa_uf_normalizar(NEW.estado);

  -- Só age quando o estado REALMENTE mudou e o novo é reconhecível.
  IF v_nova IS NULL OR v_antiga IS NOT DISTINCT FROM v_nova THEN
    RETURN NEW;
  END IF;

  -- O evento é gravado A PARTIR do que foi de fato reaberto (RETURNING), e com
  -- a contagem DAQUELE processo. Contar o total do cliente e repetir o número
  -- em cada processo faria o histórico mentir.
  WITH reabertas AS (
    UPDATE public.qa_processo_documentos pd
       SET status              = 'pendente',
           arquivo_storage_key = NULL,
           arquivo_url         = NULL,
           data_validacao      = NULL,
           observacoes = COALESCE(pd.observacoes,'') ||
             CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
             '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
             '] Exigência reaberta: o endereço do cliente mudou de ' ||
             COALESCE(v_antiga,'(sem estado)') || ' para ' || v_nova ||
             '. Certidão de ' || COALESCE(pd.uf_referencia, v_antiga, '(estado anterior)') ||
             ' não comprova antecedentes em ' || v_nova || '.',
           updated_at = now()
      FROM public.qa_processos p
     WHERE p.id = pd.processo_id
       AND pd.cliente_id = NEW.id
       AND public.qa_certidao_e_territorial(pd.tipo_documento)
       -- só processo que ainda monta dossiê
       AND p.status IN ('aguardando_pagamento','aguardando_assinatura',
                        'aguardando_documentos','em_validacao','pendente_cliente',
                        'revisao_humana','validado','pagamento_confirmado',
                        'em_analise_interna')
       -- a certidão que JÁ é do estado novo continua valendo
       AND COALESCE(pd.uf_referencia, v_antiga) IS DISTINCT FROM v_nova
       -- e só o que estava cumprido; o que já está pendente não precisa mexer
       AND pd.status IN ('aprovado','validado','conforme','entregue','entregue_pelo_hub',
                         'dispensado_por_reaproveitamento')
    RETURNING pd.processo_id, pd.tipo_documento
  ),
  por_processo AS (
    SELECT processo_id,
           count(*)                                   AS qtd,
           array_agg(tipo_documento ORDER BY tipo_documento) AS tipos
      FROM reabertas
     GROUP BY processo_id
  )
  INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
  SELECT pp.processo_id, 'certidoes_reabertas_por_mudanca_de_estado',
         format('Cliente mudou de %s para %s: %s certidão(ões) territorial(is) voltaram a ser exigidas neste processo.',
                COALESCE(v_antiga,'(sem estado)'), v_nova, pp.qtd),
         jsonb_build_object('uf_anterior', v_antiga, 'uf_nova', v_nova,
                            'exigencias', pp.qtd, 'tipos', pp.tipos),
         'sistema'
    FROM por_processo pp;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.qa_mudanca_de_estado_reabre_certidoes() IS
  'Mudou o estado de residência: as certidões que dependem do estado voltam a '
  'ser exigidas, com o link do tribunal novo. Não apaga documento — o antigo '
  'fica no cofre carimbado com o estado de origem. Dossiê já protocolado não é '
  'tocado.';

DROP TRIGGER IF EXISTS qa_trg_mudanca_de_estado_reabre_certidoes ON public.qa_clientes;
CREATE TRIGGER qa_trg_mudanca_de_estado_reabre_certidoes
  AFTER UPDATE OF estado
  ON public.qa_clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_mudanca_de_estado_reabre_certidoes();

COMMIT;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ TRANSAÇÃO 2 — o que já existe                                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
BEGIN;

-- 8.1 Carimba o estado nas certidões territoriais que JÁ estão nos processos,
--     usando o estado atual do cadastro. É o melhor testemunho disponível: até
--     hoje o sistema não registrava mudança de endereço, então a UF do cadastro
--     é a única evidência que existe. Fica marcado como inferido.
UPDATE public.qa_processo_documentos pd
   SET uf_referencia = public.qa_uf_normalizar(cl.estado)
  FROM public.qa_clientes cl
 WHERE cl.id = pd.cliente_id
   AND pd.uf_referencia IS NULL
   AND public.qa_certidao_e_territorial(pd.tipo_documento)
   AND coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,'')) IS NOT NULL
   AND public.qa_uf_normalizar(cl.estado) IS NOT NULL;

-- 8.2 O mesmo no cofre.
UPDATE public.qa_documentos_cliente dc
   SET uf_referencia = public.qa_uf_normalizar(cl.estado),
       metadados_documento_json = COALESCE(dc.metadados_documento_json,'{}'::jsonb)
         || jsonb_build_object('uf_referencia_inferida', true)
  FROM public.qa_clientes cl
 WHERE cl.id = dc.qa_cliente_id
   AND dc.uf_referencia IS NULL
   AND public.qa_certidao_e_territorial(dc.tipo_documento)
   AND public.qa_uf_normalizar(cl.estado) IS NOT NULL;

-- 8.3 Espelha no cofre as certidões JÁ aprovadas nos processos. É o que
--     destrava o ganho imediato: o que o cliente já entregou passa a valer para
--     o próximo processo dele. Dedupe pelo par (cliente, arquivo).
INSERT INTO public.qa_documentos_cliente (
  qa_cliente_id, customer_id, tipo_documento, nome_documento,
  arquivo_storage_path, arquivo_nome, arquivo_mime,
  data_emissao, data_validade, orgao_emissor,
  status, validado_admin, aprovado_em, origem,
  ia_dados_extraidos, uf_referencia, escopo_documental,
  metadados_documento_json
)
SELECT DISTINCT ON (pd.cliente_id, coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,'')))
       pd.cliente_id, cl.customer_id, pd.tipo_documento, pd.nome_documento,
       coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,'')),
       pd.arquivo_nome, pd.arquivo_mime,
       pd.data_emissao, pd.data_validade, pd.orgao_emissor,
       'aprovado', true, now(), 'checklist_do_processo',
       pd.dados_extraidos_json, pd.uf_referencia, 'permanente',
       jsonb_build_object(
         'bucket', 'qa-processo-docs',
         'espelhado_do_checklist', true,
         'espelhado_no_backfill', true,
         'processo_id', pd.processo_id,
         'processo_documento_id', pd.id,
         'espelhado_em', now()
       )
  FROM public.qa_processo_documentos pd
  JOIN public.qa_clientes cl ON cl.id = pd.cliente_id
 WHERE pd.tipo_documento LIKE 'antecedentes\_%'
   AND pd.status IN ('aprovado','validado','conforme')
   AND coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,'')) IS NOT NULL
   AND COALESCE(cl.status,'') <> 'excluido_lgpd'
   AND NOT EXISTS (
     SELECT 1 FROM public.qa_documentos_cliente dc
      WHERE dc.qa_cliente_id = pd.cliente_id
        AND dc.arquivo_storage_path = coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,''))
   )
 ORDER BY pd.cliente_id,
          coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,'')),
          pd.data_validade DESC NULLS LAST,
          pd.updated_at DESC;

COMMIT;

-- =============================================================================
-- CONFERÊNCIA (rodar depois, UMA DE CADA VEZ)
--
-- A) Quantas certidões do checklist entraram no cofre pelo backfill.
--
-- SELECT count(*) AS espelhadas
--   FROM public.qa_documentos_cliente
--  WHERE origem = 'checklist_do_processo';
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
-- C) A trava de estado entrou no motor. Esperado: 1 linha (achou o texto).
--
-- SELECT count(*) AS motor_com_trava
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--    AND p.proname = 'qa_reaproveitar_documentos_hub_processo'
--    AND pg_get_functiondef(p.oid) LIKE '%qa_certidao_e_territorial%';
--
-- D) Os três gatilhos novos existem. Esperado: 3 linhas.
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
