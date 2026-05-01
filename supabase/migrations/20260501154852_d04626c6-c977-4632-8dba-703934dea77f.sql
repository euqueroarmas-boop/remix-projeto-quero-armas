-- 1) Colunas de matching em qa_gte_documentos
ALTER TABLE public.qa_gte_documentos
  ADD COLUMN IF NOT EXISTS armas_vinculadas_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS matching_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS matching_resumo_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS matching_em timestamptz;

ALTER TABLE public.qa_gte_documentos
  DROP CONSTRAINT IF EXISTS qa_gte_documentos_matching_status_check;
ALTER TABLE public.qa_gte_documentos
  ADD CONSTRAINT qa_gte_documentos_matching_status_check
  CHECK (matching_status IN ('pendente','parcial','completo','sem_armas','erro'));

-- 2) Tabela de alertas enviados (antiduplicidade)
CREATE TABLE IF NOT EXISTS public.qa_gte_alertas_enviados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id integer NOT NULL,
  gte_documento_id uuid NOT NULL REFERENCES public.qa_gte_documentos(id) ON DELETE CASCADE,
  marco_dias integer NOT NULL,
  canal text NOT NULL,
  destinatario text,
  data_referencia date,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'enviado',
  erro_mensagem text,
  detalhes jsonb,
  CONSTRAINT qa_gte_alertas_marco_check
    CHECK (marco_dias IN (90,60,30,15,7,1,0,-1,-7,-30)),
  CONSTRAINT qa_gte_alertas_canal_check
    CHECK (canal IN ('email_cliente','email_equipe','dashboard'))
);

CREATE UNIQUE INDEX IF NOT EXISTS qa_gte_alertas_unq
  ON public.qa_gte_alertas_enviados (gte_documento_id, marco_dias, canal);
CREATE INDEX IF NOT EXISTS qa_gte_alertas_cliente_idx
  ON public.qa_gte_alertas_enviados (cliente_id, enviado_em DESC);

ALTER TABLE public.qa_gte_alertas_enviados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qa_gte_alertas_staff_all ON public.qa_gte_alertas_enviados;
CREATE POLICY qa_gte_alertas_staff_all ON public.qa_gte_alertas_enviados
  FOR ALL TO authenticated
  USING (qa_has_qa_perfil(auth.uid(), ARRAY['administrador','operacional','financeiro']))
  WITH CHECK (qa_has_qa_perfil(auth.uid(), ARRAY['administrador','operacional','financeiro']));

DROP POLICY IF EXISTS qa_gte_alertas_owner_select ON public.qa_gte_alertas_enviados;
CREATE POLICY qa_gte_alertas_owner_select ON public.qa_gte_alertas_enviados
  FOR SELECT TO authenticated
  USING (cliente_id = qa_current_cliente_id(auth.uid()));

DROP POLICY IF EXISTS qa_gte_alertas_service_all ON public.qa_gte_alertas_enviados;
CREATE POLICY qa_gte_alertas_service_all ON public.qa_gte_alertas_enviados
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3) Função de matching GTE x Arsenal
CREATE OR REPLACE FUNCTION public.qa_gte_match_armas(_gte_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id integer;
  v_armas_extraidas jsonb;
  v_resultado jsonb := '[]'::jsonb;
  v_arma jsonb;
  v_match record;
  v_match_count integer;
  v_status text;
  v_criterio text;
  v_confianca text;
  v_arma_id text;
  v_motivo text;
  v_total integer := 0;
  v_vinculadas integer := 0;
  v_revisao integer := 0;
  v_nao_encontradas integer := 0;
  v_serie text;
  v_sigma text;
  v_marca text;
  v_modelo text;
  v_calibre text;
BEGIN
  SELECT cliente_id, armas_json INTO v_cliente_id, v_armas_extraidas
  FROM qa_gte_documentos WHERE id = _gte_id;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('error','gte_nao_encontrada');
  END IF;

  IF v_armas_extraidas IS NULL OR jsonb_array_length(v_armas_extraidas) = 0 THEN
    UPDATE qa_gte_documentos SET
      armas_vinculadas_json = '[]'::jsonb,
      matching_status = 'sem_armas',
      matching_resumo_json = jsonb_build_object('total',0,'vinculadas',0,'revisao',0,'nao_encontradas',0),
      matching_em = now()
    WHERE id = _gte_id;
    RETURN jsonb_build_object('total',0);
  END IF;

  FOR v_arma IN SELECT * FROM jsonb_array_elements(v_armas_extraidas) LOOP
    v_total := v_total + 1;
    v_status := 'nao_encontrada';
    v_criterio := NULL;
    v_confianca := NULL;
    v_arma_id := NULL;
    v_motivo := NULL;

    v_serie  := NULLIF(regexp_replace(coalesce(v_arma->>'numero_serie',''), '\s+', '', 'g'), '');
    v_sigma  := NULLIF(regexp_replace(coalesce(v_arma->>'numero_sigma',''), '\s+', '', 'g'), '');
    v_marca  := upper(trim(coalesce(v_arma->>'marca','')));
    v_modelo := upper(trim(coalesce(v_arma->>'modelo','')));
    v_calibre:= upper(trim(coalesce(v_arma->>'calibre','')));

    -- 1º: número de série
    IF v_serie IS NOT NULL THEN
      SELECT arma_uid, count(*) OVER () AS c INTO v_match
      FROM qa_cliente_armas
      WHERE qa_cliente_id = v_cliente_id
        AND upper(regexp_replace(coalesce(numero_serie,''), '\s+', '', 'g')) = upper(v_serie)
      LIMIT 2;
      IF FOUND THEN
        v_arma_id := v_match.arma_uid;
        v_criterio := 'numero_serie';
        v_confianca := 'alta';
        v_status := 'vinculada';
      END IF;
    END IF;

    -- 2º: SIGMA/SINARM
    IF v_status = 'nao_encontrada' AND v_sigma IS NOT NULL THEN
      SELECT arma_uid, count(*) OVER () AS c INTO v_match
      FROM qa_cliente_armas
      WHERE qa_cliente_id = v_cliente_id
        AND (
          upper(regexp_replace(coalesce(numero_sigma,''), '\s+', '', 'g')) = upper(v_sigma)
          OR upper(regexp_replace(coalesce(numero_sinarm,''), '\s+', '', 'g')) = upper(v_sigma)
        )
      LIMIT 2;
      IF FOUND THEN
        v_arma_id := v_match.arma_uid;
        v_criterio := 'sigma_sinarm';
        v_confianca := 'alta';
        v_status := 'vinculada';
      END IF;
    END IF;

    -- 3º: CRAF (se presente nos dados extraídos)
    IF v_status = 'nao_encontrada' AND coalesce(v_arma->>'numero_craf','') <> '' THEN
      SELECT arma_uid INTO v_match
      FROM qa_cliente_armas
      WHERE qa_cliente_id = v_cliente_id
        AND upper(regexp_replace(coalesce(numero_craf,''), '\s+', '', 'g'))
            = upper(regexp_replace(v_arma->>'numero_craf', '\s+', '', 'g'))
      LIMIT 1;
      IF FOUND THEN
        v_arma_id := v_match.arma_uid;
        v_criterio := 'craf';
        v_confianca := 'alta';
        v_status := 'vinculada';
      END IF;
    END IF;

    -- 4º: fallback fraco marca + modelo + calibre → revisão manual
    IF v_status = 'nao_encontrada' AND v_marca <> '' AND v_modelo <> '' AND v_calibre <> '' THEN
      SELECT count(*) INTO v_match_count
      FROM qa_cliente_armas
      WHERE qa_cliente_id = v_cliente_id
        AND upper(coalesce(marca,''))   = v_marca
        AND upper(coalesce(modelo,''))  = v_modelo
        AND upper(coalesce(calibre,'')) = v_calibre;
      IF v_match_count = 1 THEN
        SELECT arma_uid INTO v_arma_id FROM qa_cliente_armas
        WHERE qa_cliente_id = v_cliente_id
          AND upper(coalesce(marca,''))   = v_marca
          AND upper(coalesce(modelo,''))  = v_modelo
          AND upper(coalesce(calibre,'')) = v_calibre
        LIMIT 1;
        v_criterio := 'fallback_marca_modelo_calibre';
        v_confianca := 'baixa';
        v_status := 'revisao_manual';
        v_motivo := 'match único por marca/modelo/calibre — confirme manualmente';
      ELSIF v_match_count > 1 THEN
        v_criterio := 'fallback_marca_modelo_calibre';
        v_confianca := 'baixa';
        v_status := 'revisao_manual';
        v_motivo := 'múltiplas armas compatíveis — selecione manualmente';
      END IF;
    END IF;

    IF v_status = 'vinculada' THEN v_vinculadas := v_vinculadas + 1;
    ELSIF v_status = 'revisao_manual' THEN v_revisao := v_revisao + 1;
    ELSE v_nao_encontradas := v_nao_encontradas + 1;
    END IF;

    v_resultado := v_resultado || jsonb_build_object(
      'extraida', v_arma,
      'arma_id', v_arma_id,
      'criterio', v_criterio,
      'confianca', v_confianca,
      'status', v_status,
      'motivo', v_motivo,
      'revisado_manualmente', false
    );
  END LOOP;

  UPDATE qa_gte_documentos SET
    armas_vinculadas_json = v_resultado,
    matching_status = CASE
      WHEN v_revisao = 0 AND v_nao_encontradas = 0 THEN 'completo'
      WHEN v_vinculadas = 0 AND v_revisao = 0 THEN 'pendente'
      ELSE 'parcial'
    END,
    matching_resumo_json = jsonb_build_object(
      'total', v_total,
      'vinculadas', v_vinculadas,
      'revisao', v_revisao,
      'nao_encontradas', v_nao_encontradas
    ),
    matching_em = now()
  WHERE id = _gte_id;

  RETURN jsonb_build_object(
    'total', v_total, 'vinculadas', v_vinculadas,
    'revisao', v_revisao, 'nao_encontradas', v_nao_encontradas
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.qa_gte_match_armas(uuid) TO authenticated, service_role;