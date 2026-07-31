-- =============================================================================
-- Peça 3 — a certidão federal só cumpre a exigência do TRF que cobre o cliente
--
-- Problema: a certidão da Justiça Federal é REGIONAL. A do TRF3 cobre SP e MS
-- e não cobre quem mora na Bahia — os processos federais de lá correm no TRF1
-- e não aparecem nela. Até aqui o motor casava qualquer certidão federal com
-- a exigência, sem olhar região nenhuma, e um documento passaria a cumprir a
-- exigência de quem ele não cobre. Isso é indeferimento na PF.
--
-- A UF de referência é a do COMPROVANTE DE ENDEREÇO, não a do cadastro (regra
-- do usuário, 31/07/2026): o cadastro envelhece, o comprovante é o documento.
-- Ela vem da faixa de CEP lida pelo parser, gravada em
-- ia_dados_extraidos.uf_comprovante.
--
-- Regra de dado ausente: NÃO PASSA. Sem região declarada na certidão ou sem
-- UF no comprovante, a exigência continua pendente. Decidido com a base
-- vazia (só Gilson e Willian, ambos em validação) — não há histórico a
-- proteger, então o motor nasce rigoroso em vez de nascer permissivo.
--
-- Consequência prática: documentos gravados ANTES desta mudança não têm os
-- campos e deixam de casar. São dois ou três arquivos, reenviados pelo Hub.
--
-- Escopo: só a certidão federal. As estaduais têm o mesmo problema
-- territorial, mas hoje só existe parser de São Paulo — 26 tribunais ainda
-- sem leitura própria. Mapear isso agora seria inventar cobertura que não
-- temos.
-- =============================================================================

BEGIN;

-- ─── TRF competente por UF ───────────────────────────────────────────────
-- O TRF6 foi criado em 2022, desmembrando Minas Gerais do TRF1.
CREATE OR REPLACE FUNCTION public.qa_trf_por_uf(p_uf text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE upper(btrim(coalesce(p_uf, '')))
    WHEN 'AC' THEN 1 WHEN 'AM' THEN 1 WHEN 'AP' THEN 1 WHEN 'BA' THEN 1
    WHEN 'DF' THEN 1 WHEN 'GO' THEN 1 WHEN 'MA' THEN 1 WHEN 'MT' THEN 1
    WHEN 'PA' THEN 1 WHEN 'PI' THEN 1 WHEN 'RO' THEN 1 WHEN 'RR' THEN 1
    WHEN 'TO' THEN 1
    WHEN 'RJ' THEN 2 WHEN 'ES' THEN 2
    WHEN 'SP' THEN 3 WHEN 'MS' THEN 3
    WHEN 'RS' THEN 4 WHEN 'SC' THEN 4 WHEN 'PR' THEN 4
    WHEN 'AL' THEN 5 WHEN 'CE' THEN 5 WHEN 'PB' THEN 5 WHEN 'PE' THEN 5
    WHEN 'RN' THEN 5 WHEN 'SE' THEN 5
    WHEN 'MG' THEN 6
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.qa_trf_por_uf(text) IS
  'Número do Tribunal Regional Federal competente para a UF de residência (1..6). NULL para UF inválida ou ausente.';

-- ─── UF do cliente, lida do comprovante de endereço ──────────────────────
-- Resolve o cliente pelos dois vínculos que o motor já usa: qa_cliente_id
-- direto e customer_id herdado. Pega o comprovante APROVADO e vigente mais
-- recente — o endereço atual é o último que ele comprovou.
CREATE OR REPLACE FUNCTION public.qa_uf_do_cliente(p_cliente_id bigint)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT upper(btrim(dc.ia_dados_extraidos->>'uf_comprovante'))
    FROM public.qa_documentos_cliente dc
   WHERE dc.tipo_documento = 'comprovante_residencia'
     AND dc.status = 'aprovado'
     AND (dc.data_validade IS NULL OR dc.data_validade >= CURRENT_DATE)
     AND coalesce(dc.ia_dados_extraidos->>'uf_comprovante', '') <> ''
     AND (
       dc.qa_cliente_id = p_cliente_id
       OR EXISTS (
         SELECT 1 FROM public.qa_clientes qc
          WHERE qc.id = p_cliente_id AND qc.customer_id = dc.customer_id
       )
     )
   ORDER BY dc.data_emissao DESC NULLS LAST, dc.created_at DESC
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.qa_uf_do_cliente(bigint) IS
  'UF do comprovante de residência aprovado mais recente do cliente, lida da faixa de CEP pelo parser. NULL quando não há comprovante com UF.';

-- É SECURITY DEFINER e recebe o id do cliente por parâmetro: aberta ao
-- público, qualquer autenticado descobriria em que estado mora qualquer
-- cliente. Só o backend precisa dela.
REVOKE ALL ON FUNCTION public.qa_uf_do_cliente(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qa_uf_do_cliente(bigint) TO service_role;

-- ─── Motor de reaproveitamento, com a conferência territorial ────────────
-- Corpo idêntico ao de 20260729010000, com UMA condição acrescentada ao
-- casamento documento × exigência (marcada abaixo).
CREATE OR REPLACE FUNCTION public.qa_processo_rever_exigencias(p_cliente_id integer DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_updated integer := 0;
BEGIN
  UPDATE public.qa_processo_documentos pd
  SET status='aprovado', arquivo_url=doc.arquivo_storage_path, arquivo_storage_key=doc.arquivo_storage_path,
      data_envio=COALESCE(doc.created_at,now()), data_validacao=now(), dados_extraidos_json=doc.ia_dados_extraidos
  FROM (
    SELECT DISTINCT ON (pd2.id) pd2.id AS slot_id, dc.arquivo_storage_path, dc.created_at, dc.ia_dados_extraidos
    FROM public.qa_processo_documentos pd2
    JOIN public.qa_documentos_cliente dc
      ON dc.status='aprovado' AND (dc.data_validade IS NULL OR dc.data_validade>=CURRENT_DATE)
      AND (dc.qa_cliente_id=pd2.cliente_id OR EXISTS (
        SELECT 1 FROM public.qa_clientes qc WHERE qc.id=pd2.cliente_id AND qc.customer_id=dc.customer_id))
      AND (dc.tipo_documento=pd2.tipo_documento OR pd2.tipo_documento IN (
        SELECT processo_tipo FROM public.qa_tipo_documento_aliases WHERE hub_tipo=dc.tipo_documento))
      -- Slot com ano exigido só aceita documento emitido naquele ano.
      AND (pd2.ano_competencia IS NULL
           OR pd2.ano_competencia = EXTRACT(YEAR FROM COALESCE(dc.data_emissao, dc.created_at))::smallint)
      -- ▼▼ NOVO: certidão federal só vale para a região que cobre o cliente.
      -- Qualquer outro tipo de documento passa por aqui sem ser afetado.
      AND (
        dc.tipo_documento <> 'antecedentes_federal_trf3_regional'
        OR (
          coalesce(dc.ia_dados_extraidos->>'trf_regiao', '') ~ '^[1-6]$'
          AND (dc.ia_dados_extraidos->>'trf_regiao')::int
              = public.qa_trf_por_uf(public.qa_uf_do_cliente(pd2.cliente_id))
        )
      )
      -- ▲▲ FIM DO NOVO
    WHERE pd2.status IN ('pendente','enviado','em_analise','revisao_humana')
      AND (p_cliente_id IS NULL OR pd2.cliente_id=p_cliente_id)
    ORDER BY pd2.id, dc.created_at DESC
  ) doc WHERE pd.id=doc.slot_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;$$;

COMMIT;
