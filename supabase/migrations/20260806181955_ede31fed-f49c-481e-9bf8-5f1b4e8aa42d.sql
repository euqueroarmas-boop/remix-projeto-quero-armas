CREATE TABLE IF NOT EXISTS public.qa_identidades_funcionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qa_cliente_id uuid NOT NULL,
  documento_id uuid,
  corporacao text,
  orgao_emissor text,
  posto_graduacao text,
  quadro text,
  re_matricula text,
  unidade text,
  situacao_funcional text,
  data_admissao date,
  numero_documento text,
  data_emissao date,
  data_validade date,
  nome_completo text,
  cpf text,
  rg text,
  data_nascimento date,
  nome_mae text,
  nome_pai text,
  dados_extraidos jsonb NOT NULL DEFAULT '{}'::jsonb,
  origem text NOT NULL DEFAULT 'hub_documental',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS qa_identidades_funcionais_uniq
  ON public.qa_identidades_funcionais (qa_cliente_id, coalesce(numero_documento,''), coalesce(corporacao,''));
CREATE INDEX IF NOT EXISTS qa_identidades_funcionais_cliente_idx
  ON public.qa_identidades_funcionais (qa_cliente_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_identidades_funcionais TO authenticated;
GRANT ALL ON public.qa_identidades_funcionais TO service_role;

ALTER TABLE public.qa_identidades_funcionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equipe_le_identidades_funcionais"
  ON public.qa_identidades_funcionais FOR SELECT TO authenticated USING (true);
CREATE POLICY "equipe_mantem_identidades_funcionais"
  ON public.qa_identidades_funcionais FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_qa_identidades_funcionais_updated_at
  BEFORE UPDATE ON public.qa_identidades_funcionais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.qa_sync_identidade_funcional()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d jsonb;
  v_num text;
  v_corp text;
  f_data date;
BEGIN
  IF NEW.tipo_documento NOT IN ('renda_carteira_funcional','identidade_funcional','identidade_funcional_digital','carteira_funcional') THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM 'aprovado' THEN
    RETURN NEW;
  END IF;
  IF NEW.qa_cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  d := coalesce(NEW.ia_dados_extraidos, '{}'::jsonb)
       || coalesce(NEW.campos_complementares_json, '{}'::jsonb);

  v_num  := coalesce(nullif(d->>'numero_documento',''), NEW.numero_documento, '');
  v_corp := upper(coalesce(nullif(d->>'corporacao',''), nullif(d->>'orgao_emissor',''), NEW.orgao_emissor, ''));

  INSERT INTO public.qa_identidades_funcionais AS t (
    qa_cliente_id, documento_id, corporacao, orgao_emissor, posto_graduacao, quadro,
    re_matricula, unidade, situacao_funcional, data_admissao, numero_documento,
    data_emissao, data_validade, nome_completo, cpf, rg, data_nascimento,
    nome_mae, nome_pai, dados_extraidos
  ) VALUES (
    NEW.qa_cliente_id, NEW.id, nullif(v_corp,''), coalesce(nullif(d->>'orgao_emissor',''), NEW.orgao_emissor),
    upper(nullif(coalesce(d->>'posto_graduacao', d->>'patente', d->>'graduacao'),'')),
    upper(nullif(d->>'quadro','')),
    nullif(coalesce(d->>'re_matricula', d->>'matricula', d->>'re'),''),
    upper(nullif(coalesce(d->>'unidade', d->>'lotacao', d->>'opm'),'')),
    upper(nullif(coalesce(d->>'situacao_funcional', d->>'situacao'),'')),
    (nullif(d->>'data_admissao',''))::date,
    nullif(v_num,''),
    coalesce((nullif(d->>'data_emissao',''))::date, NEW.data_emissao),
    coalesce((nullif(d->>'data_validade',''))::date, NEW.data_validade),
    upper(nullif(d->>'nome_completo','')),
    regexp_replace(coalesce(d->>'cpf',''), '\D', '', 'g'),
    nullif(coalesce(d->>'rg', d->>'numero_rg'),''),
    (nullif(d->>'data_nascimento',''))::date,
    upper(nullif(coalesce(d->>'filiacao_mae', d->>'nome_mae'),'')),
    upper(nullif(coalesce(d->>'filiacao_pai', d->>'nome_pai'),'')),
    d
  )
  ON CONFLICT (qa_cliente_id, coalesce(numero_documento,''), coalesce(corporacao,''))
  DO UPDATE SET
    documento_id = EXCLUDED.documento_id,
    orgao_emissor = coalesce(EXCLUDED.orgao_emissor, t.orgao_emissor),
    posto_graduacao = coalesce(EXCLUDED.posto_graduacao, t.posto_graduacao),
    quadro = coalesce(EXCLUDED.quadro, t.quadro),
    re_matricula = coalesce(EXCLUDED.re_matricula, t.re_matricula),
    unidade = coalesce(EXCLUDED.unidade, t.unidade),
    situacao_funcional = coalesce(EXCLUDED.situacao_funcional, t.situacao_funcional),
    data_admissao = coalesce(EXCLUDED.data_admissao, t.data_admissao),
    data_emissao = coalesce(EXCLUDED.data_emissao, t.data_emissao),
    data_validade = coalesce(EXCLUDED.data_validade, t.data_validade),
    nome_completo = coalesce(EXCLUDED.nome_completo, t.nome_completo),
    cpf = coalesce(nullif(EXCLUDED.cpf,''), t.cpf),
    rg = coalesce(EXCLUDED.rg, t.rg),
    data_nascimento = coalesce(EXCLUDED.data_nascimento, t.data_nascimento),
    nome_mae = coalesce(EXCLUDED.nome_mae, t.nome_mae),
    nome_pai = coalesce(EXCLUDED.nome_pai, t.nome_pai),
    dados_extraidos = EXCLUDED.dados_extraidos,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_doc_identidade_funcional ON public.qa_documentos_cliente;
CREATE TRIGGER trg_qa_doc_identidade_funcional
  AFTER INSERT OR UPDATE OF status, ia_dados_extraidos, campos_complementares_json
  ON public.qa_documentos_cliente
  FOR EACH ROW EXECUTE FUNCTION public.qa_sync_identidade_funcional();