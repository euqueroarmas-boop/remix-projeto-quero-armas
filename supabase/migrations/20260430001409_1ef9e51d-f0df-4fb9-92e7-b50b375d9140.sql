
-- =============================================================
-- FASE 14 — Idempotência no cadastro de armas
-- =============================================================
-- Função auxiliar de normalização (alfanumérico maiúsculo)
CREATE OR REPLACE FUNCTION public.qa_arma_norm(s text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(UPPER(REGEXP_REPLACE(COALESCE(s,''),'[^A-Za-z0-9]','','g')),'')
$$;

-- Índices únicos parciais (por cliente, valor não nulo/não vazio)
CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_armas_manual_cliente_serie
  ON public.qa_cliente_armas_manual (qa_cliente_id, public.qa_arma_norm(numero_serie))
  WHERE public.qa_arma_norm(numero_serie) IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_armas_manual_cliente_craf
  ON public.qa_cliente_armas_manual (qa_cliente_id, public.qa_arma_norm(numero_craf))
  WHERE public.qa_arma_norm(numero_craf) IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_armas_manual_cliente_sinarm
  ON public.qa_cliente_armas_manual (qa_cliente_id, public.qa_arma_norm(numero_sinarm))
  WHERE public.qa_arma_norm(numero_sinarm) IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_armas_manual_cliente_sigma
  ON public.qa_cliente_armas_manual (qa_cliente_id, public.qa_arma_norm(numero_sigma))
  WHERE public.qa_arma_norm(numero_sigma) IS NOT NULL;

-- Combinação marca+modelo+calibre apenas quando nenhum número confiável existe
CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_armas_manual_cliente_mmc
  ON public.qa_cliente_armas_manual (
    qa_cliente_id,
    UPPER(btrim(marca)),
    UPPER(btrim(modelo)),
    UPPER(btrim(calibre))
  )
  WHERE marca IS NOT NULL
    AND modelo IS NOT NULL
    AND calibre IS NOT NULL
    AND numero_serie IS NULL
    AND numero_craf IS NULL
    AND numero_sinarm IS NULL
    AND numero_sigma IS NULL;

-- =============================================================
-- Função idempotente para uso pelo OCR/IA
-- Retorna { id, created, updated_fields }
-- - Se arma existe: preenche apenas campos NULL (não sobrescreve revisado)
-- - Se não existe: insere novo registro
-- =============================================================
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
  p_dados_extraidos_json jsonb DEFAULT NULL
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
  v_updated text[] := ARRAY[]::text[];
BEGIN
  IF p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'qa_cliente_id é obrigatório';
  END IF;

  -- Procura existente por chaves fortes (na ordem de confiança)
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
       AND public.qa_arma_norm(numero_sinarm) = v_sinarm
     LIMIT 1;
  END IF;
  IF v_existing_id IS NULL AND v_sigma IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.qa_cliente_armas_manual
     WHERE qa_cliente_id = p_cliente_id
       AND public.qa_arma_norm(numero_sigma) = v_sigma
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
       AND numero_sinarm IS NULL AND numero_sigma IS NULL
     LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    -- Preenche apenas campos faltantes (NUNCA sobrescreve)
    UPDATE public.qa_cliente_armas_manual SET
      tipo_arma                 = COALESCE(tipo_arma, NULLIF(UPPER(btrim(p_tipo_arma)),'')),
      marca                     = COALESCE(marca, v_marca),
      modelo                    = COALESCE(modelo, v_modelo),
      calibre                   = COALESCE(calibre, v_calibre),
      numero_serie              = COALESCE(numero_serie, NULLIF(UPPER(btrim(p_numero_serie)),'')),
      numero_craf               = COALESCE(numero_craf,  NULLIF(UPPER(btrim(p_numero_craf)),'')),
      numero_sinarm             = COALESCE(numero_sinarm,NULLIF(UPPER(btrim(p_numero_sinarm)),'')),
      numero_sigma              = COALESCE(numero_sigma, NULLIF(UPPER(btrim(p_numero_sigma)),'')),
      numero_autorizacao_compra = COALESCE(numero_autorizacao_compra, NULLIF(UPPER(btrim(p_numero_autorizacao_compra)),''))
    WHERE id = v_existing_id
    RETURNING ARRAY[]::text[] INTO v_updated;

    RETURN jsonb_build_object('id', v_existing_id, 'created', false, 'message','Arma já cadastrada — campos faltantes preenchidos.');
  END IF;

  -- Insere novo
  INSERT INTO public.qa_cliente_armas_manual (
    qa_cliente_id, user_id, origem, sistema, tipo_arma, marca, modelo, calibre,
    numero_serie, numero_craf, numero_sinarm, numero_sigma, numero_autorizacao_compra,
    dados_extraidos_json, needs_review
  ) VALUES (
    p_cliente_id, p_user_id, COALESCE(p_origem,'manual'),
    NULLIF(UPPER(btrim(p_sistema)),''),
    NULLIF(UPPER(btrim(p_tipo_arma)),''),
    v_marca, v_modelo, v_calibre,
    NULLIF(UPPER(btrim(p_numero_serie)),''),
    NULLIF(UPPER(btrim(p_numero_craf)),''),
    NULLIF(UPPER(btrim(p_numero_sinarm)),''),
    NULLIF(UPPER(btrim(p_numero_sigma)),''),
    NULLIF(UPPER(btrim(p_numero_autorizacao_compra)),''),
    p_dados_extraidos_json,
    false
  ) RETURNING id INTO v_existing_id;

  RETURN jsonb_build_object('id', v_existing_id, 'created', true, 'message','Arma cadastrada.');
END;
$$;

REVOKE ALL ON FUNCTION public.qa_arma_manual_upsert(integer,uuid,text,text,text,text,text,text,text,text,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qa_arma_manual_upsert(integer,uuid,text,text,text,text,text,text,text,text,text,text,text,jsonb) TO authenticated, service_role;
