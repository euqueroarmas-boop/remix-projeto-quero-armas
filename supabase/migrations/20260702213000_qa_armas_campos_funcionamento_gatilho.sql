-- Campos técnicos do dossiê de armamento.
-- Base legal de referência do sistema Quero Armas: Lei 10.826/2003,
-- Decreto 11.615/2023, Decreto 12.345/2024, IN DG/PF 201 e IN DG/PF 311.

ALTER TABLE public.qa_crafs
  ADD COLUMN IF NOT EXISTS funcionamento text,
  ADD COLUMN IF NOT EXISTS gatilho text;

ALTER TABLE public.qa_cliente_armas_manual
  ADD COLUMN IF NOT EXISTS funcionamento text,
  ADD COLUMN IF NOT EXISTS gatilho text;

COMMENT ON COLUMN public.qa_crafs.funcionamento IS
  'Funcionamento mecânico da arma, quando conhecido pelo catálogo/fabricante. Ex.: Blowback.';
COMMENT ON COLUMN public.qa_crafs.gatilho IS
  'Sistema de gatilho/acionamento, quando conhecido pelo catálogo/fabricante. Ex.: SAO (ação simples apenas).';
COMMENT ON COLUMN public.qa_cliente_armas_manual.funcionamento IS
  'Funcionamento mecânico da arma, derivado do CRAF/documento e catálogo/fabricante quando conhecido.';
COMMENT ON COLUMN public.qa_cliente_armas_manual.gatilho IS
  'Sistema de gatilho/acionamento, derivado do CRAF/documento e catálogo/fabricante quando conhecido.';

CREATE OR REPLACE FUNCTION public.qa_inferir_tecnica_armamento(
  p_marca text,
  p_modelo text,
  p_calibre text,
  OUT funcionamento text,
  OUT gatilho text
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_busca text := regexp_replace(upper(
    concat_ws(' ', coalesce(p_marca, ''), coalesce(p_modelo, ''), coalesce(p_calibre, ''))
  ), '[^A-Z0-9]+', '', 'g');
BEGIN
  funcionamento := NULL;
  gatilho := NULL;

  IF v_busca LIKE '%TAURUS%' AND v_busca LIKE '%TX22%' THEN
    funcionamento := 'Blowback';
    gatilho := 'SAO (ação simples apenas)';
  END IF;
END;
$$;

UPDATE public.qa_crafs c
SET
  funcionamento = COALESCE(c.funcionamento, tech.funcionamento),
  gatilho = COALESCE(c.gatilho, tech.gatilho)
FROM LATERAL public.qa_inferir_tecnica_armamento(NULL, c.nome_arma, NULL) tech
WHERE (c.funcionamento IS NULL OR c.gatilho IS NULL)
  AND (tech.funcionamento IS NOT NULL OR tech.gatilho IS NOT NULL);

UPDATE public.qa_cliente_armas_manual m
SET
  funcionamento = COALESCE(m.funcionamento, tech.funcionamento),
  gatilho = COALESCE(m.gatilho, tech.gatilho)
FROM LATERAL public.qa_inferir_tecnica_armamento(m.marca, m.modelo, m.calibre) tech
WHERE (m.funcionamento IS NULL OR m.gatilho IS NULL)
  AND (tech.funcionamento IS NOT NULL OR tech.gatilho IS NOT NULL);

DROP VIEW IF EXISTS public.qa_cliente_armas;

CREATE VIEW public.qa_cliente_armas
WITH (security_invoker = true)
AS
WITH crafs AS (
  SELECT
    ('craf:' || c.id::text)                                     AS arma_uid,
    'craf'::text                                                AS fonte,
    c.cliente_id                                                AS qa_cliente_id,
    NULL::uuid                                                  AS user_id,
    CASE
      WHEN c.numero_sigma IS NOT NULL AND btrim(c.numero_sigma) <> '' THEN 'SIGMA'
      ELSE 'SINARM'
    END                                                         AS sistema,
    c.arma_especie                                              AS tipo_arma,
    NULL::text                                                  AS marca,
    CASE
      WHEN c.nome_arma IS NOT NULL
       AND btrim(c.nome_arma) <> ''
       AND btrim(c.nome_arma) !~ '^[0-9]+$'
      THEN c.nome_arma
      ELSE NULL
    END                                                         AS modelo,
    NULL::text                                                  AS calibre,
    c.numero_arma                                               AS numero_serie,
    c.nome_craf                                                 AS numero_craf,
    c.numero_cad_sinarm                                         AS numero_sinarm,
    c.numero_sigma                                              AS numero_sigma,
    NULL::text                                                  AS numero_autorizacao_compra,
    NULL::text                                                  AS status_documental,
    c.funcionamento                                             AS funcionamento,
    c.gatilho                                                   AS gatilho,
    (c.nome_arma IS NULL
       OR btrim(c.nome_arma) = ''
       OR btrim(c.nome_arma) ~ '^[0-9]+$')                     AS needs_review,
    NULL::timestamptz                                           AS created_at,
    NULL::timestamptz                                           AS updated_at
  FROM public.qa_crafs c
  WHERE c.cliente_id IS NOT NULL
),
manual AS (
  SELECT
    ('manual:' || m.id::text)        AS arma_uid,
    'manual'::text                   AS fonte,
    m.qa_cliente_id,
    m.user_id,
    COALESCE(m.sistema_registro, m.sistema) AS sistema,
    m.tipo_arma,
    m.marca,
    m.modelo,
    m.calibre,
    m.numero_serie,
    m.numero_craf,
    COALESCE(m.numero_cad_sinarm, m.numero_sinarm) AS numero_sinarm,
    COALESCE(m.numero_registro_sigma, m.numero_sigma) AS numero_sigma,
    m.numero_autorizacao_compra,
    m.status_documental,
    m.funcionamento,
    m.gatilho,
    m.needs_review,
    m.created_at,
    m.updated_at
  FROM public.qa_cliente_armas_manual m
)
SELECT * FROM crafs
UNION ALL
SELECT * FROM manual;

COMMENT ON VIEW public.qa_cliente_armas IS
  'View unificada de armas (CRAF + manual/IA), incluindo funcionamento e gatilho quando inferidos de CRAF/catalogo/fabricante.';

GRANT SELECT ON public.qa_cliente_armas TO authenticated;

DROP FUNCTION IF EXISTS public.qa_arma_manual_upsert(
  integer, uuid, text, text, text, text, text, text, text, text, text, text, text, jsonb
);

CREATE OR REPLACE FUNCTION public.qa_arma_manual_upsert(
  p_cliente_id integer,
  p_user_id uuid,
  p_origem text,
  p_sistema text,
  p_tipo_arma text,
  p_marca text,
  p_modelo text,
  p_calibre text,
  p_numero_serie text,
  p_numero_craf text,
  p_numero_sinarm text,
  p_numero_sigma text,
  p_numero_autorizacao_compra text,
  p_dados_extraidos_json jsonb DEFAULT NULL,
  p_funcionamento text DEFAULT NULL,
  p_gatilho text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id bigint;
  v_serie text := public.qa_arma_norm(p_numero_serie);
  v_craf  text := public.qa_arma_norm(p_numero_craf);
  v_sinarm text := public.qa_arma_norm(p_numero_sinarm);
  v_sigma  text := public.qa_arma_norm(p_numero_sigma);
  v_marca  text := NULLIF(UPPER(btrim(p_marca)),'');
  v_modelo text := NULLIF(UPPER(btrim(p_modelo)),'');
  v_calibre text := NULLIF(UPPER(btrim(p_calibre)),'');
  v_funcionamento text := NULLIF(btrim(p_funcionamento),'');
  v_gatilho text := NULLIF(btrim(p_gatilho),'');
  v_inferido record;
BEGIN
  IF p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'qa_cliente_id é obrigatório';
  END IF;

  SELECT * INTO v_inferido
  FROM public.qa_inferir_tecnica_armamento(p_marca, p_modelo, p_calibre);

  v_funcionamento := COALESCE(v_funcionamento, v_inferido.funcionamento);
  v_gatilho := COALESCE(v_gatilho, v_inferido.gatilho);

  SELECT id INTO v_existing_id FROM public.qa_cliente_armas_manual
   WHERE qa_cliente_id = p_cliente_id
     AND v_serie IS NOT NULL
     AND public.qa_arma_norm(numero_serie) = v_serie
   LIMIT 1;

  IF v_existing_id IS NULL AND v_craf IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.qa_cliente_armas_manual
     WHERE qa_cliente_id = p_cliente_id
       AND public.qa_arma_norm(numero_craf) = v_craf
     LIMIT 1;
  END IF;
  IF v_existing_id IS NULL AND v_sinarm IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.qa_cliente_armas_manual
     WHERE qa_cliente_id = p_cliente_id
       AND public.qa_arma_norm(COALESCE(numero_cad_sinarm, numero_sinarm)) = v_sinarm
     LIMIT 1;
  END IF;
  IF v_existing_id IS NULL AND v_sigma IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.qa_cliente_armas_manual
     WHERE qa_cliente_id = p_cliente_id
       AND public.qa_arma_norm(COALESCE(numero_registro_sigma, numero_sigma)) = v_sigma
     LIMIT 1;
  END IF;
  IF v_existing_id IS NULL
     AND v_serie IS NULL AND v_craf IS NULL AND v_sinarm IS NULL AND v_sigma IS NULL
     AND v_marca IS NOT NULL AND v_modelo IS NOT NULL AND v_calibre IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.qa_cliente_armas_manual
     WHERE qa_cliente_id = p_cliente_id
       AND UPPER(btrim(marca)) = v_marca
       AND UPPER(btrim(modelo)) = v_modelo
       AND UPPER(btrim(calibre)) = v_calibre
       AND numero_serie IS NULL AND numero_craf IS NULL
       AND COALESCE(numero_cad_sinarm, numero_sinarm) IS NULL
       AND COALESCE(numero_registro_sigma, numero_sigma) IS NULL
     LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.qa_cliente_armas_manual SET
      tipo_arma                 = COALESCE(tipo_arma, NULLIF(UPPER(btrim(p_tipo_arma)),'')),
      marca                     = COALESCE(marca, v_marca),
      modelo                    = COALESCE(modelo, v_modelo),
      calibre                   = COALESCE(calibre, v_calibre),
      numero_serie              = COALESCE(numero_serie, NULLIF(UPPER(btrim(p_numero_serie)),'')),
      numero_craf               = COALESCE(numero_craf,  NULLIF(UPPER(btrim(p_numero_craf)),'')),
      numero_sinarm             = COALESCE(numero_sinarm, NULLIF(UPPER(btrim(p_numero_sinarm)),'')),
      numero_cad_sinarm         = COALESCE(numero_cad_sinarm, NULLIF(UPPER(btrim(p_numero_sinarm)),'')),
      numero_sigma              = COALESCE(numero_sigma, NULLIF(UPPER(btrim(p_numero_sigma)),'')),
      numero_registro_sigma     = COALESCE(numero_registro_sigma, NULLIF(UPPER(btrim(p_numero_sigma)),'')),
      numero_autorizacao_compra = COALESCE(numero_autorizacao_compra, NULLIF(UPPER(btrim(p_numero_autorizacao_compra)),'')),
      funcionamento             = COALESCE(funcionamento, v_funcionamento),
      gatilho                   = COALESCE(gatilho, v_gatilho),
      sistema_registro          = COALESCE(sistema_registro, NULLIF(UPPER(btrim(p_sistema)),''))
    WHERE id = v_existing_id;

    RETURN jsonb_build_object('id', v_existing_id, 'created', false, 'message','Arma já cadastrada — campos faltantes preenchidos.');
  END IF;

  INSERT INTO public.qa_cliente_armas_manual (
    qa_cliente_id, user_id, origem, sistema, sistema_registro, tipo_arma, marca, modelo, calibre,
    numero_serie, numero_craf, numero_sinarm, numero_cad_sinarm, numero_sigma, numero_registro_sigma,
    numero_autorizacao_compra, funcionamento, gatilho, dados_extraidos_json, needs_review
  ) VALUES (
    p_cliente_id, p_user_id, COALESCE(p_origem,'manual'),
    NULLIF(UPPER(btrim(p_sistema)),''),
    NULLIF(UPPER(btrim(p_sistema)),''),
    NULLIF(UPPER(btrim(p_tipo_arma)),''),
    v_marca, v_modelo, v_calibre,
    NULLIF(UPPER(btrim(p_numero_serie)),''),
    NULLIF(UPPER(btrim(p_numero_craf)),''),
    NULLIF(UPPER(btrim(p_numero_sinarm)),''),
    NULLIF(UPPER(btrim(p_numero_sinarm)),''),
    NULLIF(UPPER(btrim(p_numero_sigma)),''),
    NULLIF(UPPER(btrim(p_numero_sigma)),''),
    NULLIF(UPPER(btrim(p_numero_autorizacao_compra)),''),
    v_funcionamento,
    v_gatilho,
    p_dados_extraidos_json,
    false
  ) RETURNING id INTO v_existing_id;

  RETURN jsonb_build_object('id', v_existing_id, 'created', true, 'message','Arma cadastrada.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.qa_arma_manual_upsert(integer,uuid,text,text,text,text,text,text,text,text,text,text,text,jsonb,text,text) TO authenticated, service_role;
