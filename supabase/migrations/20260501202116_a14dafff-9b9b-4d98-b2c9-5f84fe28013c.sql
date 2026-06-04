
-- 1) Estende qa_status_servico (preserva linhas existentes)
ALTER TABLE public.qa_status_servico
  ADD COLUMN IF NOT EXISTS codigo TEXT,
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS cor TEXT,
  ADD COLUMN IF NOT EXISTS finalizador BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS exige_data_protocolo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS exige_numero_protocolo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS visivel_cliente BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS visivel_equipe BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill codigo a partir do nome legado (slug minúsculo, sem acento)
UPDATE public.qa_status_servico
SET codigo = lower(regexp_replace(unaccent(nome), '[^a-zA-Z0-9]+', '_', 'g'))
WHERE codigo IS NULL OR codigo = '';

-- Garante unicidade do codigo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='qa_status_servico_codigo_uniq'
  ) THEN
    CREATE UNIQUE INDEX qa_status_servico_codigo_uniq ON public.qa_status_servico (codigo);
  END IF;
END $$;

ALTER TABLE public.qa_status_servico ALTER COLUMN codigo SET NOT NULL;

-- 2) Upsert dos 15 códigos canônicos (mantém os já existentes pelo codigo)
INSERT INTO public.qa_status_servico (codigo, nome, ordem, ativo, cor, finalizador, exige_data_protocolo, exige_numero_protocolo, visivel_cliente, visivel_equipe)
VALUES
  ('montando_pasta',          'MONTANDO PASTA',          10,  TRUE, '#94a3b8', FALSE, FALSE, FALSE, TRUE, TRUE),
  ('aguardando_documentacao', 'AGUARDANDO DOCUMENTAÇÃO', 20,  TRUE, '#f59e0b', FALSE, FALSE, FALSE, TRUE, TRUE),
  ('documentos_em_analise',   'DOCUMENTOS EM ANÁLISE',   30,  TRUE, '#3b82f6', FALSE, FALSE, FALSE, TRUE, TRUE),
  ('documentos_incompletos',  'DOCUMENTOS INCOMPLETOS',  40,  TRUE, '#f97316', FALSE, FALSE, FALSE, TRUE, TRUE),
  ('documentos_aprovados',    'DOCUMENTOS APROVADOS',    50,  TRUE, '#10b981', FALSE, FALSE, FALSE, TRUE, TRUE),
  ('em_verificacao',          'EM VERIFICAÇÃO',          60,  TRUE, '#6366f1', FALSE, FALSE, FALSE, TRUE, TRUE),
  ('pronto_para_protocolo',   'PRONTO PARA PROTOCOLO',   70,  TRUE, '#8b5cf6', FALSE, FALSE, FALSE, TRUE, TRUE),
  ('enviado_ao_orgao',        'ENVIADO AO ÓRGÃO',        80,  TRUE, '#06b6d4', FALSE, TRUE,  TRUE,  TRUE, TRUE),
  ('em_analise_orgao',        'EM ANÁLISE NO ÓRGÃO',     90,  TRUE, '#0ea5e9', FALSE, TRUE,  TRUE,  TRUE, TRUE),
  ('notificado',              'NOTIFICADO',              100, TRUE, '#eab308', FALSE, TRUE,  TRUE,  TRUE, TRUE),
  ('restituido',              'RESTITUÍDO',              110, TRUE, '#a855f7', TRUE,  FALSE, FALSE, TRUE, TRUE),
  ('recurso_administrativo',  'RECURSO ADMINISTRATIVO',  120, TRUE, '#d946ef', FALSE, TRUE,  TRUE,  TRUE, TRUE),
  ('deferido',                'DEFERIDO',                130, TRUE, '#22c55e', TRUE,  TRUE,  TRUE,  TRUE, TRUE),
  ('indeferido',              'INDEFERIDO',              140, TRUE, '#ef4444', TRUE,  TRUE,  TRUE,  TRUE, TRUE),
  ('finalizado',              'FINALIZADO',              150, TRUE, '#71717a', TRUE,  FALSE, FALSE, TRUE, TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- 3) Remove a CHECK constraint hardcoded
ALTER TABLE public.qa_itens_venda DROP CONSTRAINT IF EXISTS chk_qa_itens_venda_status;

-- 4) Trigger de validação (aceita códigos ativos OU status legado já presente em uso)
CREATE OR REPLACE FUNCTION public.qa_itens_venda_validate_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT := NEW.status;
  v_ok BOOLEAN := FALSE;
BEGIN
  IF v_status IS NULL OR btrim(v_status) = '' THEN
    RETURN NEW; -- itens podem ficar sem status definido
  END IF;

  -- 1) código canônico ativo
  SELECT EXISTS (
    SELECT 1 FROM public.qa_status_servico
    WHERE codigo = v_status AND ativo = TRUE
  ) INTO v_ok;
  IF v_ok THEN RETURN NEW; END IF;

  -- 2) nome legado (qualquer registro em qa_status_servico, ativo ou não)
  SELECT EXISTS (
    SELECT 1 FROM public.qa_status_servico
    WHERE upper(btrim(nome)) = upper(btrim(v_status))
  ) INTO v_ok;
  IF v_ok THEN RETURN NEW; END IF;

  -- 3) status que já existe em registros históricos do próprio qa_itens_venda
  --    (preserva compatibilidade com qualquer rótulo legado já em uso)
  SELECT EXISTS (
    SELECT 1 FROM public.qa_itens_venda
    WHERE upper(btrim(status)) = upper(btrim(v_status))
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) INTO v_ok;
  IF v_ok THEN RETURN NEW; END IF;

  RAISE EXCEPTION 'Status inválido: "%". Cadastre-o em Configurações > Status dos Serviços (Equipe Quero Armas).', v_status
    USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_itens_venda_validate_status ON public.qa_itens_venda;
CREATE TRIGGER trg_qa_itens_venda_validate_status
BEFORE INSERT OR UPDATE OF status ON public.qa_itens_venda
FOR EACH ROW EXECUTE FUNCTION public.qa_itens_venda_validate_status();

-- 5) Trigger anti-exclusão / anti-mudança de codigo quando em uso
CREATE OR REPLACE FUNCTION public.qa_status_servico_protect()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  em_uso BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.qa_itens_venda
      WHERE upper(btrim(status)) IN (upper(btrim(OLD.codigo)), upper(btrim(OLD.nome)))
    ) INTO em_uso;
    IF em_uso THEN
      RAISE EXCEPTION 'Status "%" está em uso em vendas. Desative em vez de excluir.', OLD.nome
        USING ERRCODE = '23503';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.codigo IS DISTINCT FROM OLD.codigo THEN
    SELECT EXISTS (
      SELECT 1 FROM public.qa_itens_venda
      WHERE upper(btrim(status)) IN (upper(btrim(OLD.codigo)), upper(btrim(OLD.nome)))
    ) INTO em_uso;
    IF em_uso THEN
      RAISE EXCEPTION 'Não é possível alterar o código de "%" — já está em uso em vendas.', OLD.nome
        USING ERRCODE = '23503';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_status_servico_protect ON public.qa_status_servico;
CREATE TRIGGER trg_qa_status_servico_protect
BEFORE UPDATE OR DELETE ON public.qa_status_servico
FOR EACH ROW EXECUTE FUNCTION public.qa_status_servico_protect();
