-- =============================================================================
-- CNH NUNCA SOBRESCREVE OS CAMPOS DE RG (22/08/2026)
-- -----------------------------------------------------------------------------
-- Caso real (cliente 235 — IGOR ANTONINO FERREIRA DA SILVA): ele digitou o RG
-- 508303291 expedido em 02/03/2016; horas depois aprovou a CNH no Hub e o
-- gatilho qa_doc_sync_to_cliente gravou por cima o NÚMERO DE REGISTRO DA CNH
-- (2639248691) e a DATA DE EMISSÃO DA CNH (17/06/2023) em rg/expedicao_rg,
-- sem aviso. O numero_documento extraído de uma CNH é o registro da CNH —
-- nunca é RG.
--
-- Correção cirúrgica: no bloco de identidade do gatilho, a CNH deixa de
-- escrever em rg / emissor_rg / expedicao_rg. Nada mais muda:
--   • CIN e RG-com-CPF continuam atualizando os campos de RG como hoje;
--   • a CNH continua sincronizando os demais campos Tier 1 (nascimento,
--     sexo, filiação, naturalidade) exatamente como antes;
--   • comprovante_residencia e renda_ccmei intocados.
-- Função reescrita a partir da versão viva (migration 20260812155942).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.qa_doc_sync_to_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_campos jsonb;
  v_tipo   text;
  v_nat    text;
  v_parts  text[];
  v_dt     date;
  v_is_t1  boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM 'aprovado'
     OR (TG_OP = 'UPDATE' AND OLD.status = 'aprovado') THEN
    RETURN NEW;
  END IF;
  IF NEW.qa_cliente_id IS NULL THEN RETURN NEW; END IF;

  v_campos := NEW.ia_dados_extraidos->'camposExtraidos';
  v_tipo   := NEW.tipo_documento;
  IF v_campos IS NULL THEN RETURN NEW; END IF;

  v_is_t1 := v_tipo IN ('cin','rg_com_cpf','cnh');

  v_dt := public.qa_parse_date_safe(v_campos->>'data_nascimento');
  IF v_dt IS NOT NULL THEN
    IF v_is_t1 THEN
      UPDATE public.qa_clientes SET data_nascimento = v_dt WHERE id = NEW.qa_cliente_id;
    ELSE
      UPDATE public.qa_clientes SET data_nascimento = v_dt
      WHERE id = NEW.qa_cliente_id AND data_nascimento IS NULL;
    END IF;
  END IF;

  IF TRIM(COALESCE(v_campos->>'sexo','')) <> '' THEN
    IF v_is_t1 THEN
      UPDATE public.qa_clientes SET sexo = UPPER(LEFT(TRIM(v_campos->>'sexo'),1))
      WHERE id = NEW.qa_cliente_id;
    ELSE
      UPDATE public.qa_clientes SET sexo = UPPER(LEFT(TRIM(v_campos->>'sexo'),1))
      WHERE id = NEW.qa_cliente_id AND (sexo IS NULL OR sexo = '');
    END IF;
  END IF;

  IF TRIM(COALESCE(v_campos->>'filiacao_mae','')) <> '' THEN
    IF v_is_t1 THEN
      UPDATE public.qa_clientes SET nome_mae = INITCAP(TRIM(v_campos->>'filiacao_mae'))
      WHERE id = NEW.qa_cliente_id;
    ELSE
      UPDATE public.qa_clientes SET nome_mae = INITCAP(TRIM(v_campos->>'filiacao_mae'))
      WHERE id = NEW.qa_cliente_id AND (nome_mae IS NULL OR nome_mae = '');
    END IF;
  END IF;

  IF TRIM(COALESCE(v_campos->>'filiacao_pai','')) <> '' THEN
    IF v_is_t1 THEN
      UPDATE public.qa_clientes SET nome_pai = INITCAP(TRIM(v_campos->>'filiacao_pai'))
      WHERE id = NEW.qa_cliente_id;
    ELSE
      UPDATE public.qa_clientes SET nome_pai = INITCAP(TRIM(v_campos->>'filiacao_pai'))
      WHERE id = NEW.qa_cliente_id AND (nome_pai IS NULL OR nome_pai = '');
    END IF;
  END IF;

  v_nat := TRIM(COALESCE(v_campos->>'naturalidade',''));
  IF v_nat <> '' THEN
    v_parts := regexp_split_to_array(v_nat, '\s*[/–\-]\s*');
    IF array_length(v_parts,1) >= 2 THEN
      IF v_is_t1 THEN
        UPDATE public.qa_clientes
        SET naturalidade_municipio = INITCAP(TRIM(v_parts[1])),
            naturalidade_uf        = UPPER(TRIM(v_parts[array_length(v_parts,1)]))
        WHERE id = NEW.qa_cliente_id;
      ELSE
        UPDATE public.qa_clientes
        SET naturalidade_municipio = COALESCE(NULLIF(naturalidade_municipio,''), INITCAP(TRIM(v_parts[1]))),
            naturalidade_uf        = COALESCE(NULLIF(naturalidade_uf,''), UPPER(TRIM(v_parts[array_length(v_parts,1)])))
        WHERE id = NEW.qa_cliente_id AND (naturalidade_municipio IS NULL OR naturalidade_municipio = '');
      END IF;
    ELSE
      IF v_is_t1 THEN
        UPDATE public.qa_clientes SET naturalidade_municipio = INITCAP(v_nat)
        WHERE id = NEW.qa_cliente_id;
      ELSE
        UPDATE public.qa_clientes SET naturalidade_municipio = COALESCE(NULLIF(naturalidade_municipio,''), INITCAP(v_nat))
        WHERE id = NEW.qa_cliente_id AND (naturalidade_municipio IS NULL OR naturalidade_municipio = '');
      END IF;
    END IF;
  END IF;

  -- Campos de RG: a CNH fica de fora — numero_documento de CNH é o registro
  -- da CNH e data_emissao é a da CNH; gravar isso aqui troca o RG do cliente.
  IF v_is_t1 AND v_tipo <> 'cnh' THEN
    UPDATE public.qa_clientes
    SET
      rg           = COALESCE(NULLIF(TRIM(COALESCE(v_campos->>'numero_documento','')),''), rg),
      emissor_rg   = COALESCE(NULLIF(TRIM(COALESCE(v_campos->>'orgao_emissor','')),''), emissor_rg),
      expedicao_rg = COALESCE(public.qa_parse_date_safe(v_campos->>'data_emissao'), expedicao_rg)
    WHERE id = NEW.qa_cliente_id;
  END IF;

  IF v_tipo = 'comprovante_residencia' THEN
    UPDATE public.qa_clientes
    SET
      cep      = COALESCE(NULLIF(cep,''),      NULLIF(REGEXP_REPLACE(COALESCE(v_campos->>'cep',''),'[^0-9]','','g'),'')),
      endereco = COALESCE(NULLIF(endereco,''), NULLIF(TRIM(COALESCE(v_campos->>'endereco_completo','')),''))
    WHERE id = NEW.qa_cliente_id AND (cep IS NULL OR cep = '');
  END IF;

  IF v_tipo = 'renda_ccmei' THEN
    UPDATE public.qa_clientes
    SET
      ocupacao_licita_cnpj = COALESCE(
        NULLIF(REGEXP_REPLACE(COALESCE(v_campos->>'cnpj',''),'[^0-9]','','g'),''),
        ocupacao_licita_cnpj
      ),
      ocupacao_licita_razao_social = COALESCE(
        NULLIF(TRIM(COALESCE(v_campos->>'razao_social', v_campos->>'nome_empresarial')),''),
        ocupacao_licita_razao_social
      ),
      ocupacao_licita_atividade = COALESCE(
        NULLIF(TRIM(COALESCE(v_campos->>'cnae_principal', v_campos->>'atividade_principal', v_campos->>'ocupacao_principal')),''),
        ocupacao_licita_atividade
      )
    WHERE id = NEW.qa_cliente_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- =============================================================================
-- Restauro do cliente 235 — devolve o RG digitado por ele em 15/08 e guarda o
-- número da CNH no campo próprio (hoje vazio). Só roda se o RG ainda estiver
-- com o número da CNH, para não passar por cima de correção manual posterior.
-- =============================================================================

UPDATE public.qa_clientes
   SET rg           = '508303291',
       emissor_rg   = 'SSP',
       expedicao_rg = DATE '2016-03-02',
       cnh          = COALESCE(cnh, '2639248691')
 WHERE id = 235
   AND rg = '2639248691';
