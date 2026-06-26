
-- Função que propaga dados extraídos do CIN/RG aprovado para qa_clientes
CREATE OR REPLACE FUNCTION public.qa_propagar_dados_identidade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dados JSONB;
  v_old JSONB;
  v_changes JSONB := '{}'::jsonb;
  v_parse_date DATE;
BEGIN
  -- Só processa quando passa a 'aprovado' e é CIN/RG/CNH
  IF NEW.status::text <> 'aprovado' THEN RETURN NEW; END IF;
  IF lower(coalesce(NEW.tipo_documento::text,'')) NOT IN ('cin','rg','cnh') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status::text = 'aprovado' THEN RETURN NEW; END IF;
  IF NEW.qa_cliente_id IS NULL THEN RETURN NEW; END IF;

  v_dados := COALESCE(NEW.ia_dados_extraidos->'camposExtraidos', NEW.ia_dados_extraidos);
  IF v_dados IS NULL OR jsonb_typeof(v_dados) <> 'object' THEN RETURN NEW; END IF;

  SELECT to_jsonb(c) INTO v_old FROM qa_clientes c WHERE id = NEW.qa_cliente_id;

  -- Helper inline: tenta converter DD/MM/YYYY ou YYYY-MM-DD
  -- nome_completo
  IF v_dados ? 'nome_completo' AND length(coalesce(v_dados->>'nome_completo','')) > 0 THEN
    UPDATE qa_clientes SET nome_completo = upper(v_dados->>'nome_completo')
      WHERE id = NEW.qa_cliente_id
        AND upper(coalesce(nome_completo,'')) <> upper(v_dados->>'nome_completo');
  END IF;

  -- nome da mãe
  IF v_dados ? 'filiacao_mae' AND length(coalesce(v_dados->>'filiacao_mae','')) > 0 THEN
    UPDATE qa_clientes SET nome_mae = upper(v_dados->>'filiacao_mae')
      WHERE id = NEW.qa_cliente_id
        AND upper(coalesce(nome_mae,'')) <> upper(v_dados->>'filiacao_mae');
  END IF;

  -- nome do pai
  IF v_dados ? 'filiacao_pai' AND length(coalesce(v_dados->>'filiacao_pai','')) > 0 THEN
    UPDATE qa_clientes SET nome_pai = upper(v_dados->>'filiacao_pai')
      WHERE id = NEW.qa_cliente_id
        AND upper(coalesce(nome_pai,'')) <> upper(v_dados->>'filiacao_pai');
  END IF;

  -- data de nascimento
  IF v_dados ? 'data_nascimento' AND length(coalesce(v_dados->>'data_nascimento','')) > 0 THEN
    BEGIN
      IF v_dados->>'data_nascimento' ~ '^\d{2}/\d{2}/\d{4}$' THEN
        v_parse_date := to_date(v_dados->>'data_nascimento','DD/MM/YYYY');
      ELSIF v_dados->>'data_nascimento' ~ '^\d{4}-\d{2}-\d{2}' THEN
        v_parse_date := (v_dados->>'data_nascimento')::date;
      ELSE
        v_parse_date := NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN v_parse_date := NULL;
    END;
    IF v_parse_date IS NOT NULL THEN
      UPDATE qa_clientes SET data_nascimento = v_parse_date
        WHERE id = NEW.qa_cliente_id AND coalesce(data_nascimento, DATE '1900-01-01') <> v_parse_date;
    END IF;
  END IF;

  -- naturalidade (formato "MUNICIPIO/UF")
  IF v_dados ? 'naturalidade' AND length(coalesce(v_dados->>'naturalidade','')) > 0 THEN
    UPDATE qa_clientes SET
      naturalidade = upper(v_dados->>'naturalidade'),
      naturalidade_municipio = COALESCE(NULLIF(split_part(v_dados->>'naturalidade','/',1),''), naturalidade_municipio),
      naturalidade_uf = COALESCE(NULLIF(upper(split_part(v_dados->>'naturalidade','/',2)),''), naturalidade_uf)
    WHERE id = NEW.qa_cliente_id;
  END IF;

  -- nacionalidade
  IF v_dados ? 'nacionalidade' AND length(coalesce(v_dados->>'nacionalidade','')) > 0 THEN
    UPDATE qa_clientes SET nacionalidade = upper(v_dados->>'nacionalidade')
      WHERE id = NEW.qa_cliente_id AND coalesce(nacionalidade,'') <> upper(v_dados->>'nacionalidade');
  END IF;

  -- sexo
  IF v_dados ? 'sexo' AND length(coalesce(v_dados->>'sexo','')) > 0 THEN
    UPDATE qa_clientes SET sexo = upper(left(v_dados->>'sexo',1))
      WHERE id = NEW.qa_cliente_id AND coalesce(sexo,'') <> upper(left(v_dados->>'sexo',1));
  END IF;

  -- órgão emissor RG (somente quando RG/CIN)
  IF v_dados ? 'orgao_emissor' AND length(coalesce(v_dados->>'orgao_emissor','')) > 0 THEN
    UPDATE qa_clientes SET emissor_rg = upper(v_dados->>'orgao_emissor')
      WHERE id = NEW.qa_cliente_id AND coalesce(emissor_rg,'') <> upper(v_dados->>'orgao_emissor');
  END IF;

  -- Log de auditoria
  INSERT INTO qa_cliente_historico_atualizacoes (cliente_id, campo, valor_anterior, valor_novo, origem, observacao)
  VALUES (
    NEW.qa_cliente_id,
    'identidade_propagada',
    coalesce(v_old->>'nome_completo',''),
    coalesce(v_dados->>'nome_completo',''),
    'trigger_cin_rg_aprovado',
    'Documento '||NEW.tipo_documento||' id '||NEW.id||' aprovado'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- nunca bloquear a aprovação do documento
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_propagar_dados_identidade ON qa_documentos_cliente;
CREATE TRIGGER trg_qa_propagar_dados_identidade
AFTER INSERT OR UPDATE OF status ON qa_documentos_cliente
FOR EACH ROW EXECUTE FUNCTION public.qa_propagar_dados_identidade();
