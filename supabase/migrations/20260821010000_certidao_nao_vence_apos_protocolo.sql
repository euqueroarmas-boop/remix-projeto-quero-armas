-- ============================================================================
-- CERTIDÃO NÃO VENCE DEPOIS DO PROTOCOLO — Lei 9.784/99
-- ----------------------------------------------------------------------------
-- Regra do titular (20/08/2026): depois que o processo é PROTOCOLADO, a
-- certidão não vence mais — a demora passa a ser da Administração, não do
-- requerente. O relógio SÓ volta a correr se a delegacia obrigar, por
-- NOTIFICAÇÃO (exigência) ou RECURSO ADMINISTRATIVO. Vale para SIGMA e SINARM.
--
-- O FURO: `qa_recalcular_prazos_processo` calculava o prazo crítico (menor
-- validade entre os documentos) para TODO processo, protocolado ou não. Com o
-- deferimento levando de 5 a 8 meses (medido nos três dossiês deferidos), o
-- cliente passava meses vendo "prazo crítico" e recebendo cobrança de renovar
-- certidão de um processo que já estava na mão do órgão.
--
-- O QUE ESTE BLOCO FAZ
--   1. a função ganha o portão: processo pós-protocolo SEM exigência aberta
--      fica com prazo_critico_* NULO — relógio parado. Notificação ou recurso
--      religa (o cálculo volta ao normal);
--   2. gatilho em qa_processos: mudou status ou protocolo_data, recalcula —
--      o congelamento e o descongelamento acontecem sozinhos;
--   3. acerto dos processos que JÁ estão protocolados hoje.
--
-- O front e o robô de e-mails aplicam a mesma regra pelo espelho
-- `instrucaoAindaExigida` — esta migration alinha o banco a eles.
--
-- Reexecutável.
-- ============================================================================

BEGIN;

-- ── 1) O portão, em função própria (uma definição, três usuários) ───────────
CREATE OR REPLACE FUNCTION public.qa_processo_relogio_parado(p_processo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- true = pós-protocolo sem exigência aberta: certidão não vence (Lei
  -- 9.784/99). Notificação ou recurso administrativo religam o relógio.
  SELECT EXISTS (
    SELECT 1 FROM public.qa_processos p
     WHERE p.id = p_processo_id
       AND (
             p.protocolo_data IS NOT NULL
          OR lower(coalesce(p.status, '')) IN (
               'protocolado','enviado_ao_orgao','enviado_orgao',
               'em_analise_orgao','em_analise_pf',
               'deferido','indeferido','concluido','finalizado',
               'arquivado','cancelado','desistiu','restituido'
             )
       )
       AND lower(coalesce(p.status, '')) NOT IN (
             'em_exigencia','exigencia','exigencia_emitida',
             'cumprindo_exigencia','notificado',
             'recurso_administrativo','em_recurso'
       )
  );
$$;

COMMENT ON FUNCTION public.qa_processo_relogio_parado(uuid) IS
  'Lei 9.784/99: TRUE quando o processo está pós-protocolo sem exigência '
  'aberta — as validades dos documentos param de contar. Notificação ou '
  'recurso administrativo devolvem FALSE (o relógio volta). Espelha '
  'instrucaoAindaExigida do front/robô de e-mails.';

-- ── 2) A função de prazos ganha o portão ────────────────────────────────────
-- Cópia da versão vigente (migration 20260801201135) com UMA mudança: o
-- cálculo do prazo crítico é pulado — e o campo LIMPO — quando o relógio está
-- parado. Validade por documento e avanço de etapa continuam iguais.
CREATE OR REPLACE FUNCTION public.qa_recalcular_prazos_processo(p_processo_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec_doc              record;
  v_validade_efet      date;
  v_validade_dias_efet integer;
  v_min_data           date;
  v_min_doc_id         uuid;
  v_min_doc_nome       text;
  v_primeiro_end       timestamptz;
  v_etapa_atual        smallint;
  v_etapa_nova         smallint;
  v_pendentes_etapa    integer;
  v_respostas          jsonb;
  v_relogio_parado     boolean;
BEGIN
  SELECT coalesce(respostas_questionario_json, '{}'::jsonb)
    INTO v_respostas
    FROM public.qa_processos
   WHERE id = p_processo_id;

  v_relogio_parado := public.qa_processo_relogio_parado(p_processo_id);

  FOR rec_doc IN
    SELECT id, tipo_documento, data_emissao, proxima_leitura,
           validade_dias, status
      FROM public.qa_processo_documentos
     WHERE processo_id = p_processo_id
  LOOP
    IF rec_doc.tipo_documento IN (
         'renda_ccmei','ccmei','renda_contrato_social','contrato_social',
         'renda_requerimento_empresario','requerimento_empresario'
       ) THEN
      UPDATE public.qa_processo_documentos
         SET data_validade_efetiva = NULL, data_validade = NULL
       WHERE id = rec_doc.id;
      CONTINUE;
    END IF;

    v_validade_dias_efet := rec_doc.validade_dias;
    IF v_validade_dias_efet IS NULL THEN
      SELECT validade_dias INTO v_validade_dias_efet
        FROM public.qa_validade_documentos
       WHERE tipo_documento = rec_doc.tipo_documento;
    END IF;

    v_validade_efet := NULL;
    IF rec_doc.data_emissao IS NOT NULL AND v_validade_dias_efet IS NOT NULL AND v_validade_dias_efet > 0 THEN
      v_validade_efet := rec_doc.data_emissao + (v_validade_dias_efet || ' days')::interval;
    END IF;
    IF rec_doc.proxima_leitura IS NOT NULL THEN
      v_validade_efet := LEAST(coalesce(v_validade_efet, rec_doc.proxima_leitura), rec_doc.proxima_leitura);
    END IF;

    UPDATE public.qa_processo_documentos
       SET data_validade_efetiva = v_validade_efet
     WHERE id = rec_doc.id;
  END LOOP;

  -- ── Lei 9.784/99: relógio parado = SEM prazo crítico ──────────────────────
  IF v_relogio_parado THEN
    v_min_data     := NULL;
    v_min_doc_id   := NULL;
    v_min_doc_nome := NULL;
  ELSE
    WITH docs_ativos AS (
      SELECT d.*
        FROM public.qa_processo_documentos d
       WHERE d.processo_id = p_processo_id
         AND d.data_validade_efetiva IS NOT NULL
         AND d.status IN (
               'enviado','em_analise','aprovado','validado',
               'divergente','revisao_humana','em_revisao_humana','pendente_aprovacao'
             )
         AND d.tipo_documento NOT IN (
               'certidao_nascimento','certidao_casamento','certidao_alteracao_nome'
             )
    ),
    serie_endereco_max AS (
      SELECT MAX(NULLIF(regexp_replace(tipo_documento, '^comprovante_endereco_ano_', ''), '')::int) AS ano_max
        FROM public.qa_processo_documentos
       WHERE processo_id = p_processo_id
         AND tipo_documento ~ '^comprovante_endereco_ano_\d{4}$'
         AND status IN ('aprovado','validado')
    )
    SELECT d.data_validade_efetiva, d.id, d.nome_documento
      INTO v_min_data, v_min_doc_id, v_min_doc_nome
      FROM docs_ativos d
     WHERE NOT (
             d.tipo_documento ~ '^comprovante_endereco_ano_\d{4}$'
             AND (SELECT ano_max FROM serie_endereco_max) IS NOT NULL
             AND regexp_replace(d.tipo_documento, '^comprovante_endereco_ano_', '')::int
                 < (SELECT ano_max FROM serie_endereco_max)
           )
     ORDER BY d.data_validade_efetiva ASC
     LIMIT 1;
  END IF;

  SELECT MIN(data_validacao) INTO v_primeiro_end
    FROM public.qa_processo_documentos
   WHERE processo_id = p_processo_id
     AND status = 'aprovado'
     AND public.qa_categoria_documento(tipo_documento) = 'endereco';

  SELECT etapa_liberada_ate INTO v_etapa_atual
    FROM public.qa_processos
   WHERE id = p_processo_id;
  v_etapa_atual := coalesce(v_etapa_atual, 1);
  v_etapa_nova  := v_etapa_atual;

  SELECT count(*) INTO v_pendentes_etapa
    FROM public.qa_processo_documentos
   WHERE processo_id = p_processo_id
     AND status IN ('pendente','divergente','rejeitado');

  IF v_pendentes_etapa = 0 AND v_etapa_atual < 5 THEN
    v_etapa_nova := v_etapa_atual + 1;
  END IF;

  UPDATE public.qa_processos
     SET prazo_critico_data = v_min_data,
         prazo_critico_doc_id = v_min_doc_id,
         prazo_critico_doc_nome = v_min_doc_nome,
         primeiro_endereco_validado_em = coalesce(primeiro_endereco_validado_em, v_primeiro_end),
         etapa_liberada_ate = v_etapa_nova,
         updated_at = now()
   WHERE id = p_processo_id;
END;
$function$;

-- ── 3) Gatilho: protocolou ou saiu da exigência, o prazo se acerta sozinho ──
CREATE OR REPLACE FUNCTION public.qa_trg_prazo_apos_mudanca_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.qa_recalcular_prazos_processo(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_qa_prazo_apos_mudanca_status ON public.qa_processos;
CREATE TRIGGER trg_qa_prazo_apos_mudanca_status
AFTER UPDATE OF status, protocolo_data ON public.qa_processos
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status
      OR OLD.protocolo_data IS DISTINCT FROM NEW.protocolo_data)
EXECUTE FUNCTION public.qa_trg_prazo_apos_mudanca_status();

COMMIT;

-- ── 4) Acerto dos processos que JÁ estão com o relógio parado ───────────────
-- Fora da transação: um processo problemático não derruba os demais.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.id FROM public.qa_processos p
     WHERE p.prazo_critico_data IS NOT NULL
       AND public.qa_processo_relogio_parado(p.id)
  LOOP
    BEGIN
      PERFORM public.qa_recalcular_prazos_processo(r.id);
      RAISE NOTICE 'Processo %: prazo crítico limpo (pós-protocolo)', r.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Processo % falhou: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- 1) Nenhum processo com relógio parado pode ter prazo crítico (esperado: 0):
--
-- SELECT p.id, p.servico_nome, p.status, p.protocolo_data, p.prazo_critico_data
--   FROM public.qa_processos p
--  WHERE p.prazo_critico_data IS NOT NULL
--    AND public.qa_processo_relogio_parado(p.id);
--
-- 2) O Carlos Renato (protocolado em 30/05) deve aparecer SEM prazo crítico:
--
-- SELECT p.id, cl.nome_completo, p.status, p.protocolo_data, p.prazo_critico_data
--   FROM public.qa_processos p
--   JOIN public.qa_clientes cl ON cl.id = p.cliente_id
--  WHERE p.protocolo_data IS NOT NULL;
--
-- 3) O gatilho está instalado:
--
-- SELECT tgname, tgenabled FROM pg_trigger
--  WHERE tgname = 'trg_qa_prazo_apos_mudanca_status';
