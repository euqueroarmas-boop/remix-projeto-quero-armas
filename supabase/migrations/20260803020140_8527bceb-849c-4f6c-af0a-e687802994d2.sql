-- Trava dura: enquanto houver sessão de suporte ativa para o e-mail logado,
-- a conta opera em modo "somente leitura + envio de documentos".
CREATE OR REPLACE FUNCTION public.qa_suporte_sessao_ativa()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.qa_suporte_sessoes s
    WHERE s.encerrado_em IS NULL
      AND lower(s.cliente_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND s.iniciado_em > now() - interval '12 hours'
  );
$$;

REVOKE ALL ON FUNCTION public.qa_suporte_sessao_ativa() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qa_suporte_sessao_ativa() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.qa_bloqueia_em_suporte()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role (edge functions internas) não é afetado.
  IF current_setting('role', true) = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF public.qa_suporte_sessao_ativa() THEN
    RAISE EXCEPTION 'Ação bloqueada: sessão de suporte é somente leitura + envio de documentos (tabela %)', TG_TABLE_NAME
      USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Contratos e aceites
DROP TRIGGER IF EXISTS qa_suporte_block ON public.qa_contract_signatures;
CREATE TRIGGER qa_suporte_block BEFORE INSERT OR UPDATE OR DELETE ON public.qa_contract_signatures
FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_em_suporte();

DROP TRIGGER IF EXISTS qa_suporte_block ON public.qa_contract_aceites_log;
CREATE TRIGGER qa_suporte_block BEFORE INSERT OR UPDATE OR DELETE ON public.qa_contract_aceites_log
FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_em_suporte();

DROP TRIGGER IF EXISTS qa_suporte_block ON public.qa_contracts;
CREATE TRIGGER qa_suporte_block BEFORE INSERT OR UPDATE OR DELETE ON public.qa_contracts
FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_em_suporte();

-- Cadastro do cliente
DROP TRIGGER IF EXISTS qa_suporte_block ON public.qa_clientes;
CREATE TRIGGER qa_suporte_block BEFORE INSERT OR UPDATE OR DELETE ON public.qa_clientes
FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_em_suporte();

-- Vendas / financeiro
DROP TRIGGER IF EXISTS qa_suporte_block ON public.qa_vendas;
CREATE TRIGGER qa_suporte_block BEFORE INSERT OR UPDATE OR DELETE ON public.qa_vendas
FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_em_suporte();

DROP TRIGGER IF EXISTS qa_suporte_block ON public.qa_itens_venda;
CREATE TRIGGER qa_suporte_block BEFORE INSERT OR UPDATE OR DELETE ON public.qa_itens_venda
FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_em_suporte();

-- Solicitações de serviço
DROP TRIGGER IF EXISTS qa_suporte_block ON public.qa_solicitacoes_servico;
CREATE TRIGGER qa_suporte_block BEFORE INSERT OR UPDATE OR DELETE ON public.qa_solicitacoes_servico
FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_em_suporte();