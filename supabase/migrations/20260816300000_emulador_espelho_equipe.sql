-- =====================================================================
-- MODO ESPELHO — emulador real da Área do Cliente para a equipe
-- =====================================================================
-- O operador NÃO vira o cliente: ele continua logado na própria conta de
-- staff e a Área do Cliente é renderizada apontada para um cliente-alvo.
-- Consequências (todas desejadas):
--   * auth.uid() continua sendo o do OPERADOR -> toda escrita é atribuída
--     nativamente a ele, sem "senha master" e sem sequestrar a conta.
--   * a sessão de admin do operador não é destruída.
--   * o cliente vê no próprio histórico que quem mexeu foi a equipe.
--   * compras/pagamentos/assinatura ficam bloqueados no banco (não só na tela).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Sessões de espelho
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qa_emu_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id integer NOT NULL,
  cliente_nome text,
  cliente_email text,
  operador_user_id uuid NOT NULL,
  operador_email text NOT NULL,
  operador_nome text,
  motivo text NOT NULL,
  processo_ref text,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL DEFAULT now() + interval '30 minutes',
  encerrado_em timestamptz,
  encerrado_por text,
  acoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  resumo text,
  ip text,
  user_agent text,
  email_inicio_enviado boolean NOT NULL DEFAULT false,
  email_fim_enviado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qa_emu_sessoes_cliente_idx
  ON public.qa_emu_sessoes (cliente_id, iniciado_em DESC);

-- Índice que sustenta a função quente qa_emu_sessao_atual().
CREATE INDEX IF NOT EXISTS qa_emu_sessoes_ativa_idx
  ON public.qa_emu_sessoes (operador_user_id, expira_em DESC)
  WHERE encerrado_em IS NULL;

ALTER TABLE public.qa_emu_sessoes ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.qa_emu_sessoes TO authenticated;
GRANT ALL ON public.qa_emu_sessoes TO service_role;

DROP POLICY IF EXISTS qa_emu_sessoes_staff_select ON public.qa_emu_sessoes;
CREATE POLICY qa_emu_sessoes_staff_select ON public.qa_emu_sessoes
  FOR SELECT TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

-- O cliente enxerga as sessões abertas na PRÓPRIA conta (transparência).
DROP POLICY IF EXISTS qa_emu_sessoes_owner_select ON public.qa_emu_sessoes;
CREATE POLICY qa_emu_sessoes_owner_select ON public.qa_emu_sessoes
  FOR SELECT TO authenticated
  USING (cliente_id = public.qa_current_cliente_id(auth.uid()));

-- Escrita só pela edge function (service_role). Nenhuma policy de INSERT/UPDATE
-- para `authenticated` é criada de propósito: o operador não forja a própria sessão.

-- ---------------------------------------------------------------------
-- 2. Funções de contexto
-- ---------------------------------------------------------------------
-- Sessão de espelho ATIVA do usuário logado. Expira sozinha em `expira_em`,
-- então uma sessão esquecida deixa de produzir efeito sem intervenção.
CREATE OR REPLACE FUNCTION public.qa_emu_sessao_atual()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id
  FROM public.qa_emu_sessoes s
  WHERE s.operador_user_id = auth.uid()
    AND s.encerrado_em IS NULL
    AND s.expira_em > now()
  ORDER BY s.iniciado_em DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.qa_emu_cliente_atual()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.cliente_id
  FROM public.qa_emu_sessoes s
  WHERE s.id = public.qa_emu_sessao_atual()
$$;

CREATE OR REPLACE FUNCTION public.qa_emu_operador_atual()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(s.operador_nome, s.operador_email)
  FROM public.qa_emu_sessoes s
  WHERE s.id = public.qa_emu_sessao_atual()
$$;

REVOKE ALL ON FUNCTION public.qa_emu_sessao_atual() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_emu_cliente_atual() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_emu_operador_atual() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qa_emu_sessao_atual() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.qa_emu_cliente_atual() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.qa_emu_operador_atual() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. ÚNICO BLOQUEIO: compra, pagamento e assinatura
-- ---------------------------------------------------------------------
-- Vender, pagar e assinar são atos do cliente. Em modo espelho a equipe faz
-- tudo, menos isso. Bloqueio no BANCO — burlar a tela não adianta.
CREATE OR REPLACE FUNCTION public.qa_emu_bloqueia_compra()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- service_role (webhooks Asaas, conciliação, jobs) nunca é afetado.
  IF auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF public.qa_emu_sessao_atual() IS NOT NULL THEN
    RAISE EXCEPTION
      'Modo espelho: compra, pagamento e assinatura de contrato só podem ser feitos pelo próprio cliente (tabela %).',
      TG_TABLE_NAME
      USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aqui NÃO passamos batido: se uma dessas relações não for tabela de verdade,
-- o bloqueio não pegaria e a compra passaria calada. Melhor estourar na hora.
DO $$
DECLARE t text; k "char";
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'qa_vendas', 'qa_itens_venda', 'qa_contract_signatures', 'qa_contract_aceites_log'
  ]
  LOOP
    SELECT c.relkind INTO k
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = t;

    IF k IS NULL OR k NOT IN ('r', 'p') THEN
      RAISE EXCEPTION
        'Bloqueio de compra não pôde ser instalado: public.% não é tabela (relkind=%).',
        t, COALESCE(k::text, 'inexistente');
    END IF;

    EXECUTE format('DROP TRIGGER IF EXISTS qa_emu_block_compra ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER qa_emu_block_compra BEFORE INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.qa_emu_bloqueia_compra()', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 4. Rastro automático — o cliente vê que foi a EQUIPE
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_emu_rotulo_tabela(_t text)
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _t
    WHEN 'qa_clientes'                    THEN 'Dados cadastrais'
    WHEN 'qa_documentos_cliente'          THEN 'Documentos'
    WHEN 'qa_processos'                   THEN 'Processo'
    WHEN 'qa_processo_documentos'         THEN 'Documentos do processo'
    WHEN 'qa_cliente_armas_manual'        THEN 'Acervo (armas)'
    WHEN 'qa_crafs'                       THEN 'CRAF'
    WHEN 'qa_gtes'                        THEN 'Guia de Tráfego'
    WHEN 'qa_filiacoes'                   THEN 'Filiação a clube'
    WHEN 'qa_cadastro_cr'                 THEN 'Cadastro CR'
    WHEN 'qa_exames_cliente'              THEN 'Exames'
    WHEN 'qa_efetiva_necessidade'         THEN 'Efetiva necessidade'
    WHEN 'qa_efetiva_necessidade_provas'  THEN 'Provas de efetiva necessidade'
    WHEN 'qa_procuracoes'                 THEN 'Procuração'
    ELSE _t
  END
$$;

-- Campos de infraestrutura que só poluiriam o histórico do cliente.
CREATE OR REPLACE FUNCTION public.qa_emu_campo_ignorado(_k text)
RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _k IN (
    'updated_at', 'atualizado_em', 'created_at', 'criado_em',
    'embedding', 'search_vector', 'campo_origens'
  )
$$;

CREATE OR REPLACE FUNCTION public.qa_emu_registra_acao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sessao   uuid;
  v_cliente  integer;
  v_operador text;
  v_campos   jsonb := '[]'::jsonb;
  v_rotulo   text;
  v_descr    text;
BEGIN
  v_sessao := public.qa_emu_sessao_atual();
  IF v_sessao IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_cliente  := public.qa_emu_cliente_atual();
  v_operador := public.qa_emu_operador_atual();
  v_rotulo   := public.qa_emu_rotulo_tabela(TG_TABLE_NAME);

  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(
             jsonb_agg(jsonb_build_object(
               'field', n.key,
               'label', v_rotulo || ' · ' || n.key,
               'old',   o.value,
               'new',   n.value
             )),
             '[]'::jsonb)
      INTO v_campos
      FROM jsonb_each(to_jsonb(NEW)) AS n
      JOIN jsonb_each(to_jsonb(OLD)) AS o ON o.key = n.key
     WHERE n.value IS DISTINCT FROM o.value
       AND NOT public.qa_emu_campo_ignorado(n.key);

    -- UPDATE que não mexeu em nada visível não vira evento.
    IF v_campos = '[]'::jsonb THEN
      RETURN NEW;
    END IF;
    v_descr := 'Atualizou ' || lower(v_rotulo);
  ELSIF TG_OP = 'INSERT' THEN
    v_campos := jsonb_build_array(jsonb_build_object(
      'field', TG_TABLE_NAME, 'label', v_rotulo, 'old', NULL, 'new', 'Registro incluído pela equipe'));
    v_descr := 'Incluiu registro em ' || lower(v_rotulo);
  ELSE
    v_campos := jsonb_build_array(jsonb_build_object(
      'field', TG_TABLE_NAME, 'label', v_rotulo, 'old', 'Registro existente', 'new', 'Removido pela equipe'));
    v_descr := 'Removeu registro de ' || lower(v_rotulo);
  END IF;

  -- (a) linha do tempo que o CLIENTE já enxerga no portal
  INSERT INTO public.qa_cliente_historico_atualizacoes
    (cliente_id, changed_fields, snapshot_anterior, snapshot_novo, origem, autor)
  VALUES (
    v_cliente,
    v_campos,
    CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END,
    'equipe_espelho',
    'Equipe Quero Armas · ' || COALESCE(v_operador, 'operador')
  );

  -- (b) rastro dentro da própria sessão de espelho (auditoria interna)
  UPDATE public.qa_emu_sessoes
     SET acoes = acoes || jsonb_build_array(jsonb_build_object(
           'em', now(), 'por', v_operador, 'tabela', TG_TABLE_NAME,
           'op', TG_OP, 'descricao', v_descr))
   WHERE id = v_sessao;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplica o rastro nas tabelas que o cliente enxerga no portal.
--
-- ATENÇÃO ao montar esta lista: `qa_cliente_armas` é uma VIEW (une qa_crafs
-- com qa_cliente_armas_manual) e Postgres não aceita gatilho de linha em view.
-- Por isso entram as duas tabelas de base, não a view. O guard de relkind
-- abaixo protege contra o mesmo tropeço no futuro: view/matview é pulada com
-- aviso em vez de derrubar o bloco inteiro.
DO $$
DECLARE t text; k "char";
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'qa_clientes', 'qa_documentos_cliente', 'qa_processos', 'qa_processo_documentos',
    'qa_cliente_armas_manual', 'qa_crafs', 'qa_gtes', 'qa_filiacoes', 'qa_cadastro_cr',
    'qa_exames_cliente', 'qa_efetiva_necessidade', 'qa_efetiva_necessidade_provas',
    'qa_procuracoes'
  ]
  LOOP
    SELECT c.relkind INTO k
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = t;

    IF k IS NULL THEN
      RAISE NOTICE 'Rastro do espelho: public.% não existe — pulando.', t;
      CONTINUE;
    END IF;
    IF k NOT IN ('r', 'p') THEN
      RAISE NOTICE 'Rastro do espelho: public.% não é tabela (relkind=%) — pulando.', t, k;
      CONTINUE;
    END IF;

    EXECUTE format('DROP TRIGGER IF EXISTS qa_emu_rastro ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER qa_emu_rastro AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.qa_emu_registra_acao()', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 5. Remove a trava antiga que engessava a CONTA DO CLIENTE
-- ---------------------------------------------------------------------
-- O modelo anterior logava o operador COMO o cliente e, enquanto a sessão
-- estivesse aberta, bloqueava toda escrita feita por aquele e-mail — o que
-- travava também o cliente de verdade por até 12h. O modelo novo não precisa
-- disso: o operador nunca assume a identidade do cliente.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'qa_contract_signatures', 'qa_contract_aceites_log', 'qa_contracts',
    'qa_clientes', 'qa_vendas', 'qa_itens_venda', 'qa_solicitacoes_servico'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS qa_suporte_block ON public.%I', t);
    END IF;
  END LOOP;
END $$;

-- Encerra qualquer sessão do modelo antigo que tenha ficado pendurada.
UPDATE public.qa_suporte_sessoes
   SET encerrado_em = now(),
       resumo = COALESCE(resumo, 'Encerrada automaticamente na migração para o Modo Espelho.')
 WHERE encerrado_em IS NULL;

-- ---------------------------------------------------------------------
-- 6. Vínculo com o processo escolhido (não só o nome digitado)
-- ---------------------------------------------------------------------
-- O operador passou a SELECIONAR o processo do cliente em vez de digitar.
-- Guardamos o id junto do nome: nome muda quando o catálogo é editado, o
-- vínculo não — e a auditoria precisa apontar para o processo de verdade.
ALTER TABLE public.qa_emu_sessoes
  ADD COLUMN IF NOT EXISTS processo_id uuid;

CREATE INDEX IF NOT EXISTS qa_emu_sessoes_processo_idx
  ON public.qa_emu_sessoes (processo_id)
  WHERE processo_id IS NOT NULL;
