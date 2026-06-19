-- qa_doc_sync_to_cliente v2: corrige campos ausentes e parsing
-- Novidades vs v1:
--   • Tier 1: lê uf_emissao → uf_emissor_rg; faz split de orgao_emissor como fallback
--   • Tier 1: lê nacionalidade do documento; defaults 'Brasileiro(a)' se ausente
--   • filiacao_mae/filiacao_pai: agora também aceita nome_mae/nome_pai (certidões usam esse nome)
--   • comprovante_residencia: lê logradouro, numero, bairro, cidade, uf separados

CREATE OR REPLACE FUNCTION public.qa_doc_sync_to_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campos     jsonb;
  v_tipo       text;
  v_nat        text;
  v_parts      text[];
  v_dt         date;
  v_is_t1      boolean;
  v_emissor    text;
  v_uf_emit    text;
  v_emit_match text[];
  v_mae        text;
  v_pai        text;
  v_nac        text;
  v_log        text;
  v_num        text;
  v_bairro     text;
  v_cidade     text;
  v_estado     text;
  v_cep        text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'aprovado' OR OLD.status = 'aprovado' THEN
    RETURN NEW;
  END IF;
  IF NEW.cliente_id IS NULL THEN RETURN NEW; END IF;

  v_campos := NEW.ia_dados_extraidos->'camposExtraidos';
  v_tipo   := NEW.tipo_documento;
  IF v_campos IS NULL THEN RETURN NEW; END IF;

  v_is_t1 := v_tipo IN ('cin', 'rg_com_cpf', 'cnh');

  -- ── data_nascimento ──────────────────────────────────────────────────────
  v_dt := public.qa_parse_date_safe(v_campos->>'data_nascimento');
  IF v_dt IS NOT NULL THEN
    IF v_is_t1 THEN
      UPDATE public.qa_clientes SET data_nascimento = v_dt WHERE id = NEW.cliente_id;
    ELSE
      UPDATE public.qa_clientes SET data_nascimento = v_dt WHERE id = NEW.cliente_id AND data_nascimento IS NULL;
    END IF;
  END IF;

  -- ── sexo ─────────────────────────────────────────────────────────────────
  IF TRIM(COALESCE(v_campos->>'sexo','')) <> '' THEN
    IF v_is_t1 THEN
      UPDATE public.qa_clientes SET sexo = UPPER(LEFT(TRIM(v_campos->>'sexo'), 1)) WHERE id = NEW.cliente_id;
    ELSE
      UPDATE public.qa_clientes SET sexo = UPPER(LEFT(TRIM(v_campos->>'sexo'), 1)) WHERE id = NEW.cliente_id AND (sexo IS NULL OR sexo = '');
    END IF;
  END IF;

  -- ── filiação (aceita filiacao_mae/filiacao_pai ou nome_mae/nome_pai) ─────
  v_mae := NULLIF(TRIM(COALESCE(v_campos->>'filiacao_mae', v_campos->>'nome_mae', '')), '');
  v_pai := NULLIF(TRIM(COALESCE(v_campos->>'filiacao_pai', v_campos->>'nome_pai', '')), '');

  IF v_mae IS NOT NULL THEN
    IF v_is_t1 THEN
      UPDATE public.qa_clientes SET nome_mae = INITCAP(v_mae) WHERE id = NEW.cliente_id;
    ELSE
      UPDATE public.qa_clientes SET nome_mae = INITCAP(v_mae) WHERE id = NEW.cliente_id AND (nome_mae IS NULL OR nome_mae = '');
    END IF;
  END IF;

  IF v_pai IS NOT NULL THEN
    IF v_is_t1 THEN
      UPDATE public.qa_clientes SET nome_pai = INITCAP(v_pai) WHERE id = NEW.cliente_id;
    ELSE
      UPDATE public.qa_clientes SET nome_pai = INITCAP(v_pai) WHERE id = NEW.cliente_id AND (nome_pai IS NULL OR nome_pai = '');
    END IF;
  END IF;

  -- ── naturalidade → municipio + uf ────────────────────────────────────────
  v_nat := TRIM(COALESCE(v_campos->>'naturalidade', ''));
  IF v_nat <> '' THEN
    v_parts := regexp_split_to_array(v_nat, '\s*[/–\-]\s*');
    IF v_is_t1 THEN
      IF array_length(v_parts, 1) >= 2 THEN
        UPDATE public.qa_clientes
        SET naturalidade_municipio = INITCAP(TRIM(v_parts[1])),
            naturalidade_uf        = UPPER(TRIM(v_parts[array_length(v_parts,1)]))
        WHERE id = NEW.cliente_id;
      ELSE
        UPDATE public.qa_clientes SET naturalidade_municipio = INITCAP(v_nat) WHERE id = NEW.cliente_id;
      END IF;
    ELSE
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
  END IF;

  -- ── nacionalidade: lê do doc; Tier 1 defaults 'Brasileiro(a)' ────────────
  v_nac := NULLIF(TRIM(COALESCE(v_campos->>'nacionalidade', '')), '');
  IF v_nac IS NULL AND v_is_t1 THEN
    v_nac := 'Brasileiro(a)';
  END IF;
  IF v_nac IS NOT NULL THEN
    IF v_is_t1 THEN
      UPDATE public.qa_clientes SET nacionalidade = INITCAP(v_nac) WHERE id = NEW.cliente_id;
    ELSE
      UPDATE public.qa_clientes SET nacionalidade = INITCAP(v_nac) WHERE id = NEW.cliente_id AND (nacionalidade IS NULL OR nacionalidade = '');
    END IF;
  END IF;

  -- ── Documento de identidade (Tier 1): rg, emissor, uf emissor, expedição ─
  IF v_is_t1 THEN
    -- orgao_emissor: a IA deveria extrair uf_emissao separadamente.
    -- Como fallback, detecta sufixo " -UF" ou "-UF" no orgao_emissor.
    v_emissor := TRIM(COALESCE(v_campos->>'orgao_emissor', ''));
    v_uf_emit := NULLIF(TRIM(COALESCE(v_campos->>'uf_emissao', '')), '');

    IF v_uf_emit IS NULL AND v_emissor <> '' THEN
      -- Detecta padrão "IIRGD -SP" ou "SSP-SP" ou "SSP/SP" → extrai UF
      v_emit_match := regexp_match(v_emissor, '^(.*?)[\s\-/]+([A-Z]{2})\s*$');
      IF v_emit_match IS NOT NULL THEN
        v_emissor := TRIM(v_emit_match[1]);
        v_uf_emit := v_emit_match[2];
      END IF;
    END IF;

    UPDATE public.qa_clientes
    SET
      rg           = NULLIF(TRIM(COALESCE(v_campos->>'numero_documento', '')), ''),
      emissor_rg   = NULLIF(v_emissor, ''),
      uf_emissor_rg = COALESCE(NULLIF(v_uf_emit, ''), uf_emissor_rg),
      expedicao_rg = public.qa_parse_date_safe(v_campos->>'data_emissao')
    WHERE id = NEW.cliente_id;
  END IF;

  -- ── Comprovante de residência: endereço completo + campos individuais ─────
  IF v_tipo = 'comprovante_residencia' THEN
    v_cep := NULLIF(REGEXP_REPLACE(COALESCE(v_campos->>'cep',''),'[^0-9]','','g'), '');
    -- Logradouro: prefere campo separado; cai em endereco_completo como fallback
    v_log    := NULLIF(TRIM(COALESCE(v_campos->>'logradouro', v_campos->>'endereco_completo', '')), '');
    v_num    := NULLIF(TRIM(COALESCE(v_campos->>'numero',  '')), '');
    v_bairro := NULLIF(TRIM(COALESCE(v_campos->>'bairro',  '')), '');
    v_cidade := NULLIF(TRIM(COALESCE(v_campos->>'cidade',  '')), '');
    v_estado := NULLIF(UPPER(TRIM(COALESCE(v_campos->>'uf', v_campos->>'estado', ''))), '');

    UPDATE public.qa_clientes
    SET
      cep      = COALESCE(NULLIF(cep,''), v_cep),
      endereco = COALESCE(NULLIF(endereco,''), v_log),
      numero   = COALESCE(NULLIF(numero,''),   v_num),
      bairro   = COALESCE(NULLIF(bairro,''),   v_bairro),
      cidade   = COALESCE(NULLIF(cidade,''),   v_cidade),
      estado   = COALESCE(NULLIF(estado,''),   v_estado)
    WHERE id = NEW.cliente_id AND (cep IS NULL OR cep = '');
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.qa_doc_sync_to_cliente() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_doc_sync_to_cliente() TO authenticated, service_role;

-- ── Backfill v2: reprocessa docs aprovados com nova lógica ───────────────
-- Ordem: Tier 3 → Tier 2 → Tier 1 (Tier 1 por último, sobrescreve)
DO $$
DECLARE
  r            record;
  v_campos     jsonb;
  v_nat        text;
  v_parts      text[];
  v_dt         date;
  v_is_t1      boolean;
  v_emissor    text;
  v_uf_emit    text;
  v_emit_match text[];
  v_mae        text;
  v_pai        text;
  v_nac        text;
  v_log        text;
  v_num        text;
  v_bairro     text;
  v_cidade     text;
  v_estado     text;
  v_cep        text;
BEGIN
  FOR r IN
    SELECT d.id, d.cliente_id, d.tipo_documento, d.ia_dados_extraidos
    FROM public.qa_documentos_cliente d
    WHERE d.status = 'aprovado'
      AND d.cliente_id IS NOT NULL
      AND d.ia_dados_extraidos IS NOT NULL
    ORDER BY
      CASE d.tipo_documento
        WHEN 'comprovante_residencia' THEN 1
        WHEN 'cin'        THEN 3
        WHEN 'rg_com_cpf' THEN 3
        WHEN 'cnh'        THEN 3
        ELSE 2
      END,
      d.created_at ASC
  LOOP
    v_campos := r.ia_dados_extraidos->'camposExtraidos';
    IF v_campos IS NULL THEN CONTINUE; END IF;

    v_is_t1 := r.tipo_documento IN ('cin', 'rg_com_cpf', 'cnh');

    v_dt := public.qa_parse_date_safe(v_campos->>'data_nascimento');
    IF v_dt IS NOT NULL THEN
      IF v_is_t1 THEN
        UPDATE public.qa_clientes SET data_nascimento = v_dt WHERE id = r.cliente_id;
      ELSE
        UPDATE public.qa_clientes SET data_nascimento = v_dt WHERE id = r.cliente_id AND data_nascimento IS NULL;
      END IF;
    END IF;

    IF TRIM(COALESCE(v_campos->>'sexo','')) <> '' THEN
      IF v_is_t1 THEN
        UPDATE public.qa_clientes SET sexo = UPPER(LEFT(TRIM(v_campos->>'sexo'),1)) WHERE id = r.cliente_id;
      ELSE
        UPDATE public.qa_clientes SET sexo = UPPER(LEFT(TRIM(v_campos->>'sexo'),1)) WHERE id = r.cliente_id AND (sexo IS NULL OR sexo = '');
      END IF;
    END IF;

    v_mae := NULLIF(TRIM(COALESCE(v_campos->>'filiacao_mae', v_campos->>'nome_mae', '')), '');
    v_pai := NULLIF(TRIM(COALESCE(v_campos->>'filiacao_pai', v_campos->>'nome_pai', '')), '');

    IF v_mae IS NOT NULL THEN
      IF v_is_t1 THEN
        UPDATE public.qa_clientes SET nome_mae = INITCAP(v_mae) WHERE id = r.cliente_id;
      ELSE
        UPDATE public.qa_clientes SET nome_mae = INITCAP(v_mae) WHERE id = r.cliente_id AND (nome_mae IS NULL OR nome_mae = '');
      END IF;
    END IF;

    IF v_pai IS NOT NULL THEN
      IF v_is_t1 THEN
        UPDATE public.qa_clientes SET nome_pai = INITCAP(v_pai) WHERE id = r.cliente_id;
      ELSE
        UPDATE public.qa_clientes SET nome_pai = INITCAP(v_pai) WHERE id = r.cliente_id AND (nome_pai IS NULL OR nome_pai = '');
      END IF;
    END IF;

    v_nat := TRIM(COALESCE(v_campos->>'naturalidade',''));
    IF v_nat <> '' THEN
      v_parts := regexp_split_to_array(v_nat, '\s*[/–\-]\s*');
      IF v_is_t1 THEN
        IF array_length(v_parts,1) >= 2 THEN
          UPDATE public.qa_clientes
          SET naturalidade_municipio = INITCAP(TRIM(v_parts[1])),
              naturalidade_uf        = UPPER(TRIM(v_parts[array_length(v_parts,1)]))
          WHERE id = r.cliente_id;
        ELSE
          UPDATE public.qa_clientes SET naturalidade_municipio = INITCAP(v_nat) WHERE id = r.cliente_id;
        END IF;
      ELSE
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
    END IF;

    -- nacionalidade
    v_nac := NULLIF(TRIM(COALESCE(v_campos->>'nacionalidade', '')), '');
    IF v_nac IS NULL AND v_is_t1 THEN v_nac := 'Brasileiro(a)'; END IF;
    IF v_nac IS NOT NULL THEN
      IF v_is_t1 THEN
        UPDATE public.qa_clientes SET nacionalidade = INITCAP(v_nac) WHERE id = r.cliente_id;
      ELSE
        UPDATE public.qa_clientes SET nacionalidade = INITCAP(v_nac) WHERE id = r.cliente_id AND (nacionalidade IS NULL OR nacionalidade = '');
      END IF;
    END IF;

    IF v_is_t1 THEN
      v_emissor := TRIM(COALESCE(v_campos->>'orgao_emissor', ''));
      v_uf_emit := NULLIF(TRIM(COALESCE(v_campos->>'uf_emissao', '')), '');
      IF v_uf_emit IS NULL AND v_emissor <> '' THEN
        v_emit_match := regexp_match(v_emissor, '^(.*?)[\s\-/]+([A-Z]{2})\s*$');
        IF v_emit_match IS NOT NULL THEN
          v_emissor := TRIM(v_emit_match[1]);
          v_uf_emit := v_emit_match[2];
        END IF;
      END IF;
      UPDATE public.qa_clientes
      SET
        rg            = NULLIF(TRIM(COALESCE(v_campos->>'numero_documento', '')), ''),
        emissor_rg    = NULLIF(v_emissor, ''),
        uf_emissor_rg = COALESCE(NULLIF(v_uf_emit, ''), uf_emissor_rg),
        expedicao_rg  = public.qa_parse_date_safe(v_campos->>'data_emissao')
      WHERE id = r.cliente_id;
    END IF;

    IF r.tipo_documento = 'comprovante_residencia' THEN
      v_cep    := NULLIF(REGEXP_REPLACE(COALESCE(v_campos->>'cep',''),'[^0-9]','','g'), '');
      v_log    := NULLIF(TRIM(COALESCE(v_campos->>'logradouro', v_campos->>'endereco_completo', '')), '');
      v_num    := NULLIF(TRIM(COALESCE(v_campos->>'numero',  '')), '');
      v_bairro := NULLIF(TRIM(COALESCE(v_campos->>'bairro',  '')), '');
      v_cidade := NULLIF(TRIM(COALESCE(v_campos->>'cidade',  '')), '');
      v_estado := NULLIF(UPPER(TRIM(COALESCE(v_campos->>'uf', v_campos->>'estado', ''))), '');

      UPDATE public.qa_clientes
      SET
        cep      = COALESCE(NULLIF(cep,''), v_cep),
        endereco = COALESCE(NULLIF(endereco,''), v_log),
        numero   = COALESCE(NULLIF(numero,''),   v_num),
        bairro   = COALESCE(NULLIF(bairro,''),   v_bairro),
        cidade   = COALESCE(NULLIF(cidade,''),   v_cidade),
        estado   = COALESCE(NULLIF(estado,''),   v_estado)
      WHERE id = r.cliente_id AND (cep IS NULL OR cep = '');
    END IF;

  END LOOP;
END;
$$;
