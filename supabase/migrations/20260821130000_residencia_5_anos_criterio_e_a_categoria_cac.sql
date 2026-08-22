-- =============================================================================
-- O CRITÉRIO DOS 5 ANOS PASSA A SER A CATEGORIA DO SERVIÇO, NÃO UMA LISTA
-- -----------------------------------------------------------------------------
-- Regra do titular: a residência dos últimos 5 anos vale para CLIENTES CAC.
-- "Autorização de compra / posse de arma de fogo não usa comprovante de 5 anos
-- de endereço. Só o atual."
--
-- ─── POR QUE A LISTA ANTERIOR ESTAVA ERRADA ──────────────────────────────────
--
-- Em 20260821120000 eu escrevi o critério como IN (31, 44, 50, 51), copiando a
-- lista de qa_seed_endereco_5_anos. A conferência contra o banco derrubou os
-- dois apoios dessa escolha:
--
--   1. O SERVIÇO 31 NÃO EXISTE. Não há linha dele em qa_servicos_catalogo —
--      só sobraram documentos de catálogo órfãos apontando para esse id.
--   2. A lista VIVA de qa_seed_endereco_5_anos é (31, 44), não (31, 44, 50, 51):
--      a migration de 18/06 que a estenderia nunca chegou ao banco. Ancorar
--      numa função que está desatualizada em produção é ancorar no vazio.
--
-- O catálogo já diz o que precisamos, com todas as letras, na coluna
-- `categoria`: SINARM CAC contra POLÍCIA FEDERAL. É essa a régua — ela não
-- envelhece, não precisa ser mantida em dois lugares, e é exatamente o que o
-- titular disse.
--
-- ─── O ALCANCE, CONFERIDO ANTES DE APLICAR ───────────────────────────────────
--
--   31  (fora do catálogo)                              PERDE a pergunta
--   32  RENOVAÇÃO DE CR                                 GANHA
--   33  REGISTRO E APOSTILAMENTO DE ARMA DE FOGO (CAC)  GANHA
--   34  GUIA DE TRAFEGO ESPECIAL (CAC)                  não entra
--   44  CONCESSÃO DE CR — ATIRADOR ESPORTIVO            já tem
--   45  APOSTILAMENTO — ATUALIZAÇÃO DE ACERVO           não entra
--   50  AUTORIZAÇÃO DE COMPRA ATIRADOR (CAC)            já tem
--   51  AUTORIZAÇÃO DE COMPRA CAÇADOR (CAC)             não entra
--   59  CRAF E GT / POSSE            (POLÍCIA FEDERAL)  fora
--   60  AUTORIZAÇÃO DE COMPRA / POSSE (POLÍCIA FEDERAL) fora
--
-- A DUPLA TRAVA continua: além de ser CAC, o serviço precisa JÁ pedir a certidão
-- estadual de antecedentes. É por isso que 34 e 45 ficam de fora sozinhos —
-- nenhum serviço passa a exigir documento que não exigia.
--
-- (O 51 não entrar é um buraco do catálogo DELE, não desta regra: ele é o gêmeo
-- do 50 para caçador e não pede certidão estadual. Fica anotado, não corrigido
-- aqui — não é o que foi pedido.)
--
-- Reexecutável.
-- =============================================================================

BEGIN;

-- ─── 1) A régua: é CAC? ──────────────────────────────────────────────────────
-- Passa de IMMUTABLE para STABLE porque agora lê tabela. Serviço que não existe
-- no catálogo devolve FALSE — é o que resolve o id 31 órfão.
CREATE OR REPLACE FUNCTION public.qa_servico_usa_residencia_5_anos(p_servico_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.qa_servicos_catalogo c
     WHERE c.servico_id = p_servico_id
       AND c.ativo
       AND upper(btrim(coalesce(c.categoria, ''))) = 'SINARM CAC'
  );
$$;

COMMENT ON FUNCTION public.qa_servico_usa_residencia_5_anos(integer) IS
  'TRUE quando o serviço é CAC (qa_servicos_catalogo.categoria = SINARM CAC). '
  'É a régua da residência dos últimos 5 anos, por decisão do titular em '
  '21/08/2026. Os serviços da POLÍCIA FEDERAL (Autorização de compra / Posse e '
  'CRAF/GT) usam só o endereço ATUAL. Serviço inexistente ou inativo devolve '
  'FALSE.';

GRANT EXECUTE ON FUNCTION public.qa_servico_usa_residencia_5_anos(integer)
  TO authenticated, service_role;

-- ─── 2) A pergunta sai de quem não é CAC ─────────────────────────────────────
-- Alcança o id 31 órfão, que só existia como documento de catálogo.
DELETE FROM public.qa_servicos_documentos
 WHERE tipo_documento = 'pergunta_residencia_5_anos'
   AND NOT public.qa_servico_usa_residencia_5_anos(servico_id);

-- ─── 3) A pergunta entra nos serviços CAC que já pedem a certidão estadual ───
-- Mesma linha de 20260821080000, já sem a condição inerte que a 100000 retirou.
INSERT INTO public.qa_servicos_documentos (
  servico_id, tipo_documento, nome_documento, etapa, ordem, obrigatorio,
  obrigatorio_etapa02, ativo, emissor, escopo, formato_aceito,
  validade_dias, instrucoes, observacoes_cliente, regra_validacao
)
SELECT c.servico_id,
       'pergunta_residencia_5_anos',
       'Nos últimos 5 anos você morou sempre no endereço do comprovante que enviou?',
       'complementar', 205, true,
       false, true, 'cliente', 'processo', ARRAY[]::text[],
       NULL,
       'O SINARM e o SIGMA exigem certidão de antecedentes de CADA estado onde '
       || 'você morou nos últimos cinco anos.',
       'Se você mudou de estado nesse período, vamos pedir as certidões dos '
       || 'estados anteriores também.',
       jsonb_build_object(
         'grupo_checklist',       'endereco',
         'ordem_grupo_checklist', 45,
         'tipo',  'pergunta',
         'chave', 'residencia_5_anos',
         'opcoes', jsonb_build_array(
           jsonb_build_object('valor','sim','label','SIM, morei sempre neste mesmo endereço'),
           jsonb_build_object('valor','nao','label','NÃO, morei em outro estado nos últimos 5 anos')
         ))
  FROM public.qa_servicos_catalogo c
 WHERE public.qa_servico_usa_residencia_5_anos(c.servico_id)
   -- A SEGUNDA TRAVA: só onde a certidão estadual já é exigida. Nenhum serviço
   -- passa a pedir documento que não pedia.
   AND EXISTS (
     SELECT 1 FROM public.qa_servicos_documentos sd
      WHERE sd.servico_id = c.servico_id
        AND sd.ativo
        AND sd.tipo_documento = 'antecedentes_estadual_distribuicao'
   )
   AND NOT EXISTS (
     SELECT 1 FROM public.qa_servicos_documentos sd
      WHERE sd.servico_id = c.servico_id
        AND sd.tipo_documento = 'pergunta_residencia_5_anos'
   );

COMMIT;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ TRANSAÇÃO 2 — os processos abertos acompanham                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
BEGIN;

-- Silencia os avisos: mexer no checklist não é "documento recebido".
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

-- 4.1 Quem deixou de valer: linha com rastro vira não-aplicável, com a razão.
UPDATE public.qa_processo_documentos pd
   SET status = 'nao_aplicavel',
       observacoes = COALESCE(pd.observacoes,'') ||
         CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
         '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
         '] Este serviço usa apenas o endereço atual — a regra dos 5 anos vale ' ||
         'para os serviços CAC.',
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

-- 4.2 Linha intocada de serviço que não vale mais: some.
DELETE FROM public.qa_processo_documentos pd
 USING public.qa_processos p
 WHERE p.id = pd.processo_id
   AND pd.tipo_documento = 'pergunta_residencia_5_anos'
   AND NOT public.qa_servico_usa_residencia_5_anos(p.servico_id)
   AND pd.status = 'pendente'
   AND NULLIF(btrim(COALESCE(pd.observacoes,'')), '') IS NULL
   AND coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,'')) IS NULL
   AND NOT (COALESCE(p.respostas_questionario_json, '{}'::jsonb) ? 'residencia_5_anos');

-- 4.3 Quem passou a valer: a pergunta entra nos processos que ainda montam
--     dossiê. Processo protocolado não é tocado.
INSERT INTO public.qa_processo_documentos (
  processo_id, cliente_id, tipo_documento, nome_documento, etapa,
  status, obrigatorio, validade_dias, formato_aceito, regra_validacao,
  instrucoes, observacoes_cliente, ordem
)
SELECT p.id, p.cliente_id, sd.tipo_documento, sd.nome_documento, sd.etapa,
       'pendente', COALESCE(sd.obrigatorio, true), sd.validade_dias,
       sd.formato_aceito, sd.regra_validacao,
       sd.instrucoes, sd.observacoes_cliente, sd.ordem
  FROM public.qa_processos p
  JOIN public.qa_clientes cl ON cl.id = p.cliente_id
  JOIN public.qa_servicos_documentos sd
    ON sd.servico_id = p.servico_id
   AND sd.tipo_documento = 'pergunta_residencia_5_anos'
   AND sd.ativo
 WHERE NOT public.qa_processo_relogio_parado(p.id)
   AND COALESCE(cl.status,'') <> 'excluido_lgpd'
   AND COALESCE(cl.excluido,false) = false
   AND EXISTS (SELECT 1 FROM public.qa_processo_documentos x WHERE x.processo_id = p.id)
   AND NOT EXISTS (
     SELECT 1 FROM public.qa_processo_documentos x
      WHERE x.processo_id = p.id
        AND x.tipo_documento = 'pergunta_residencia_5_anos'
   );

-- 4.4 Bloco de certidão de estado anterior em serviço que não vale mais. Só o
--     que está VAZIO sai; bloco com documento entregue permanece.
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
-- A) A pergunta ficou exatamente nos serviços CAC que pedem certidão estadual.
--    Esperado: 32, 33, 44, 50 — todos com categoria SINARM CAC.
--
-- SELECT sd.servico_id, c.nome, c.categoria
--   FROM public.qa_servicos_documentos sd
--   LEFT JOIN public.qa_servicos_catalogo c ON c.servico_id = sd.servico_id
--  WHERE sd.tipo_documento = 'pergunta_residencia_5_anos'
--  ORDER BY sd.servico_id;
--
-- B) Nenhum serviço da POLÍCIA FEDERAL nem id órfão sobrou. Esperado: 0.
--
-- SELECT count(*) AS fora_da_regra
--   FROM public.qa_servicos_documentos sd
--  WHERE sd.tipo_documento = 'pergunta_residencia_5_anos'
--    AND NOT public.qa_servico_usa_residencia_5_anos(sd.servico_id);
--
-- C) Onde a pergunta está nos processos, e em que estado.
--
-- SELECT p.servico_id, c.nome, pd.status, count(*) AS linhas
--   FROM public.qa_processo_documentos pd
--   JOIN public.qa_processos p ON p.id = pd.processo_id
--   LEFT JOIN public.qa_servicos_catalogo c ON c.servico_id = p.servico_id
--  WHERE pd.tipo_documento = 'pergunta_residencia_5_anos'
--  GROUP BY p.servico_id, c.nome, pd.status
--  ORDER BY p.servico_id;
--
-- D) A régua responde certo para os serviços que discutimos.
--    Esperado: 44, 50, 51, 32, 33, 34, 45 = true; 59, 60, 31 = false.
--
-- SELECT s AS servico_id, public.qa_servico_usa_residencia_5_anos(s) AS e_cac
--   FROM unnest(ARRAY[31,32,33,34,44,45,50,51,59,60]) AS s
--  ORDER BY s;
--
-- E) Bloco de estado anterior fora da regra. "vazios" tem de ser 0.
--
-- SELECT count(*) FILTER (WHERE coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,'')) IS NULL)     AS vazios,
--        count(*) FILTER (WHERE coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,'')) IS NOT NULL) AS com_documento
--   FROM public.qa_processo_documentos pd
--   JOIN public.qa_processos p ON p.id = pd.processo_id
--  WHERE pd.campos_complementares_json ->> 'gerado_por' = 'estados_anteriores'
--    AND NOT public.qa_servico_usa_residencia_5_anos(p.servico_id);
-- =============================================================================
