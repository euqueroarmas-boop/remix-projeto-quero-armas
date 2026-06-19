-- Sincroniza dados extraídos pela IA dos documentos aprovados → qa_clientes.
-- Regra: só preenche campos que estão NULL/vazios no perfil (nunca sobrescreve).
-- Acionado AFTER UPDATE OF status quando o novo status = 'aprovado'.

-- ── Helper: parse de data em DD/MM/YYYY ou YYYY-MM-DD ─────────────────────
CREATE OR REPLACE FUNCTION public.qa_parse_date_safe(v text)
RETURNS date
LANGUAGE plpgsql
AS $$
BEGIN
  IF v IS NULL OR TRIM(v) = '' THEN RETURN NULL; END IF;
  BEGIN
    IF v ~ '^\d{4}-\d{2}-\d{2}' THEN
      RETURN TRIM(v)::date;
    ELSIF v ~ '^\d{2}/\d{2}/\d{4}' THEN
      RETURN TO_DATE(TRIM(v), 'DD/MM/YYYY');
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.qa_parse_date_safe(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_parse_date_safe(text) TO authenticated, service_role;

-- ── Trigger function ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_doc_sync_to_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campos  jsonb;
  v_tipo    text;
  v_nat     text;
  v_parts   text[];
  v_dt      date;
BEGIN
  -- Só processa quando o status muda PARA 'aprovado'
  IF NEW.status IS DISTINCT FROM 'aprovado' OR OLD.status = 'aprovado' THEN
    RETURN NEW;
  END IF;
  IF NEW.cliente_id IS NULL THEN RETURN NEW; END IF;

  v_campos := NEW.ia_dados_extraidos->'camposExtraidos';
  v_tipo   := NEW.tipo_documento;
  IF v_campos IS NULL THEN RETURN NEW; END IF;

  -- ── Dados pessoais (todos os tipos com extração pessoal) ────────────────

  v_dt := public.qa_parse_date_safe(v_campos->>'data_nascimento');
  IF v_dt IS NOT NULL THEN
    UPDATE public.qa_clientes SET data_nascimento = v_dt
    WHERE id = NEW.cliente_id AND data_nascimento IS NULL;
  END IF;

  IF TRIM(v_campos->>'sexo') <> '' AND v_campos->>'sexo' IS NOT NULL THEN
    UPDATE public.qa_clientes SET sexo = UPPER(LEFT(TRIM(v_campos->>'sexo'), 1))
    WHERE id = NEW.cliente_id AND (sexo IS NULL OR sexo = '');
  END IF;

  IF TRIM(COALESCE(v_campos->>'filiacao_mae','')) <> '' THEN
    UPDATE public.qa_clientes SET nome_mae = INITCAP(TRIM(v_campos->>'filiacao_mae'))
    WHERE id = NEW.cliente_id AND (nome_mae IS NULL OR nome_mae = '');
  END IF;

  IF TRIM(COALESCE(v_campos->>'filiacao_pai','')) <> '' THEN
    UPDATE public.qa_clientes SET nome_pai = INITCAP(TRIM(v_campos->>'filiacao_pai'))
    WHERE id = NEW.cliente_id AND (nome_pai IS NULL OR nome_pai = '');
  END IF;

  -- Naturalidade → municipio + uf  (ex: "Jacareí – SP" ou "JACAREÍ/SP")
  v_nat := TRIM(COALESCE(v_campos->>'naturalidade', ''));
  IF v_nat <> '' THEN
    v_parts := regexp_split_to_array(v_nat, '\s*[/–\-]\s*');
    IF array_length(v_parts, 1) >= 2 THEN
      UPDATE public.qa_clientes
      SET
        naturalidade_municipio = COALESCE(NULLIF(naturalidade_municipio,''), INITCAP(TRIM(v_parts[1]))),
        naturalidade_uf        = COALESCE(NULLIF(naturalidade_uf,''), UPPER(TRIM(v_parts[array_length(v_parts,1)])))
      WHERE id = NEW.cliente_id AND (naturalidade_municipio IS NULL OR naturalidade_municipio = '');
    ELSE
      UPDATE public.qa_clientes
      SET naturalidade_municipio = COALESCE(NULLIF(naturalidade_municipio,''), INITCAP(v_nat))
      WHERE id = NEW.cliente_id AND (naturalidade_municipio IS NULL OR naturalidade_municipio = '');
    END IF;
  END IF;

  -- ── Documento de identidade → rg, emissor, expedição ────────────────────
  IF v_tipo IN ('cin', 'rg_com_cpf', 'cnh') THEN
    UPDATE public.qa_clientes
    SET
      rg           = COALESCE(NULLIF(rg,''),         NULLIF(TRIM(COALESCE(v_campos->>'numero_documento','')),'')),
      emissor_rg   = COALESCE(NULLIF(emissor_rg,''), NULLIF(TRIM(COALESCE(v_campos->>'orgao_emissor','')),'')),
      expedicao_rg = CASE WHEN expedicao_rg IS NULL
                     THEN public.qa_parse_date_safe(v_campos->>'data_emissao')
                     ELSE expedicao_rg END
    WHERE id = NEW.cliente_id;
  END IF;

  -- ── Comprovante de residência → cep + endereço ──────────────────────────
  IF v_tipo = 'comprovante_residencia' THEN
    UPDATE public.qa_clientes
    SET
      cep      = COALESCE(NULLIF(cep,''),      NULLIF(REGEXP_REPLACE(COALESCE(v_campos->>'cep',''),'[^0-9]','','g'),'')),
      endereco = COALESCE(NULLIF(endereco,''), NULLIF(TRIM(COALESCE(v_campos->>'endereco_completo','')),  ''))
    WHERE id = NEW.cliente_id AND (cep IS NULL OR cep = '');
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.qa_doc_sync_to_cliente() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_doc_sync_to_cliente() TO authenticated, service_role;

DROP TRIGGER IF EXISTS qa_doc_sync_to_cliente_trigger ON public.qa_documentos_cliente;
CREATE TRIGGER qa_doc_sync_to_cliente_trigger
  AFTER UPDATE OF status ON public.qa_documentos_cliente
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_doc_sync_to_cliente();

-- ── Backfill: aplica sync para todos os docs já aprovados ─────────────────
-- Processa em ordem de confiança (tier 1 primeiro: cin, rg, cnh)
-- para que dados de maior confiança sejam escritos primeiro e não
-- sejam sobrescritos pelos de menor confiança (COALESCE garante isso).
DO $$
DECLARE
  r record;
  v_campos  jsonb;
  v_nat     text;
  v_parts   text[];
  v_dt      date;
BEGIN
  FOR r IN
    SELECT d.id, d.cliente_id, d.tipo_documento, d.ia_dados_extraidos
    FROM public.qa_documentos_cliente d
    WHERE d.status = 'aprovado'
      AND d.cliente_id IS NOT NULL
      AND d.ia_dados_extraidos IS NOT NULL
    ORDER BY
      CASE d.tipo_documento
        WHEN 'cin'        THEN 1
        WHEN 'rg_com_cpf' THEN 1
        WHEN 'cnh'        THEN 1
        WHEN 'comprovante_residencia' THEN 3
        ELSE 2
      END,
      d.created_at ASC
  LOOP
    v_campos := r.ia_dados_extraidos->'camposExtraidos';
    IF v_campos IS NULL THEN CONTINUE; END IF;

    v_dt := public.qa_parse_date_safe(v_campos->>'data_nascimento');
    IF v_dt IS NOT NULL THEN
      UPDATE public.qa_clientes SET data_nascimento = v_dt
      WHERE id = r.cliente_id AND data_nascimento IS NULL;
    END IF;

    IF TRIM(COALESCE(v_campos->>'sexo','')) <> '' THEN
      UPDATE public.qa_clientes SET sexo = UPPER(LEFT(TRIM(v_campos->>'sexo'),1))
      WHERE id = r.cliente_id AND (sexo IS NULL OR sexo = '');
    END IF;

    IF TRIM(COALESCE(v_campos->>'filiacao_mae','')) <> '' THEN
      UPDATE public.qa_clientes SET nome_mae = INITCAP(TRIM(v_campos->>'filiacao_mae'))
      WHERE id = r.cliente_id AND (nome_mae IS NULL OR nome_mae = '');
    END IF;

    IF TRIM(COALESCE(v_campos->>'filiacao_pai','')) <> '' THEN
      UPDATE public.qa_clientes SET nome_pai = INITCAP(TRIM(v_campos->>'filiacao_pai'))
      WHERE id = r.cliente_id AND (nome_pai IS NULL OR nome_pai = '');
    END IF;

    v_nat := TRIM(COALESCE(v_campos->>'naturalidade',''));
    IF v_nat <> '' THEN
      v_parts := regexp_split_to_array(v_nat, '\s*[/–\-]\s*');
      IF array_length(v_parts,1) >= 2 THEN
        UPDATE public.qa_clientes
        SET
          naturalidade_municipio = COALESCE(NULLIF(naturalidade_municipio,''), INITCAP(TRIM(v_parts[1]))),
          naturalidade_uf        = COALESCE(NULLIF(naturalidade_uf,''), UPPER(TRIM(v_parts[array_length(v_parts,1)])))
        WHERE id = r.cliente_id AND (naturalidade_municipio IS NULL OR naturalidade_municipio = '');
      ELSE
        UPDATE public.qa_clientes
        SET naturalidade_municipio = COALESCE(NULLIF(naturalidade_municipio,''), INITCAP(v_nat))
        WHERE id = r.cliente_id AND (naturalidade_municipio IS NULL OR naturalidade_municipio = '');
      END IF;
    END IF;

    IF r.tipo_documento IN ('cin','rg_com_cpf','cnh') THEN
      UPDATE public.qa_clientes
      SET
        rg           = COALESCE(NULLIF(rg,''),         NULLIF(TRIM(COALESCE(v_campos->>'numero_documento','')),'')),
        emissor_rg   = COALESCE(NULLIF(emissor_rg,''), NULLIF(TRIM(COALESCE(v_campos->>'orgao_emissor','')),'')),
        expedicao_rg = CASE WHEN expedicao_rg IS NULL
                       THEN public.qa_parse_date_safe(v_campos->>'data_emissao')
                       ELSE expedicao_rg END
      WHERE id = r.cliente_id;
    END IF;

    IF r.tipo_documento = 'comprovante_residencia' THEN
      UPDATE public.qa_clientes
      SET
        cep      = COALESCE(NULLIF(cep,''),      NULLIF(REGEXP_REPLACE(COALESCE(v_campos->>'cep',''),'[^0-9]','','g'),'')),
        endereco = COALESCE(NULLIF(endereco,''), NULLIF(TRIM(COALESCE(v_campos->>'endereco_completo','')),  ''))
      WHERE id = r.cliente_id AND (cep IS NULL OR cep = '');
    END IF;

  END LOOP;
END;
$$;
