-- =============================================================================
-- COLAR NO SQL EDITOR — CNH nunca sobrescreve os campos de RG + restauro Igor
-- (idêntico à migration 20260822040000_cnh_nao_sobrescreve_campos_do_rg.sql)
-- 1) Recria o gatilho qa_doc_sync_to_cliente SEM o caminho CNH → campos de RG.
-- 2) Devolve ao cliente 235 o RG digitado (508303291, SSP/SP, 02/03/2016) e
--    guarda o número da CNH (2639248691) no campo próprio.
-- Conferência ao final do arquivo.
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

-- Restauro do cliente 235: devolve o RG digitado e guarda a CNH no campo dela.
-- Só roda se o RG ainda estiver com o número da CNH.
UPDATE public.qa_clientes
   SET rg           = '508303291',
       emissor_rg   = 'SSP',
       expedicao_rg = DATE '2016-03-02',
       cnh          = COALESCE(cnh, '2639248691')
 WHERE id = 235
   AND rg = '2639248691';

-- Conferência: RG de volta ao digitado, CNH no campo próprio.
SELECT id, nome_completo, rg, emissor_rg, uf_emissor_rg, expedicao_rg,
       cnh, tipo_documento_identidade
  FROM public.qa_clientes
 WHERE id = 235;

-- =============================================================================
-- SEÇÃO 2 — Recoloca o seletor de condição profissional no processo do Igor
-- -----------------------------------------------------------------------------
-- O seletor do admin/portal vive dentro do item "Defina sua condição
-- profissional" (renda_definir_condicao), que é apagado quando uma condição é
-- escolhida. Este bloco recoloca o item SÓ no processo do Igor
-- (3c40ff08-… · serviço 60 — Autorização de Compra / Posse de Arma de Fogo).
-- Depois de colar: abrir o processo no admin (ou o Igor no portal), clicar em
-- CLT no seletor amarelo — a função do sistema apaga os itens de segurança
-- pública (todos ainda pendentes) e monta a renda de CLT.
-- =============================================================================

INSERT INTO public.qa_processo_documentos
  (processo_id, cliente_id, tipo_documento, nome_documento, obrigatorio,
   escopo, etapa, ordem, formato_aceito, instrucoes, observacoes_cliente,
   link_emissao, modelo_url, exemplo_url, orgao_emissor,
   prazo_recomendado_dias, validade_dias, regra_validacao, status)
SELECT '3c40ff08-5377-4090-9be2-894a8b04bb43', 235,
       sd.tipo_documento, sd.nome_documento, sd.obrigatorio,
       sd.escopo,
       CASE WHEN sd.etapa IN ('base','complementar','tecnico','final')
            THEN sd.etapa ELSE 'base' END,
       sd.ordem, COALESCE(sd.formato_aceito, '{}'), sd.instrucoes,
       sd.observacoes_cliente, sd.link_emissao, sd.modelo_url, sd.exemplo_url,
       sd.orgao_emissor, sd.prazo_recomendado_dias, sd.validade_dias,
       sd.regra_validacao, 'pendente'
  FROM public.qa_servicos_documentos sd
 WHERE sd.servico_id = 60
   AND sd.tipo_documento = 'renda_definir_condicao'
   AND sd.ativo
   AND NOT EXISTS (SELECT 1 FROM public.qa_processo_documentos pd
                    WHERE pd.processo_id = '3c40ff08-5377-4090-9be2-894a8b04bb43'
                      AND pd.tipo_documento = 'renda_definir_condicao');

-- Conferência: o item deve voltar como PENDENTE no checklist do processo.
SELECT tipo_documento, nome_documento, status, etapa, ordem
  FROM public.qa_processo_documentos
 WHERE processo_id = '3c40ff08-5377-4090-9be2-894a8b04bb43'
   AND tipo_documento = 'renda_definir_condicao';
