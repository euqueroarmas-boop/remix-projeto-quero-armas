-- =============================================================================
-- A RESPOSTA DOS 5 ANOS VIAJA DO CADASTRO PÚBLICO ATÉ O CHECKLIST
-- -----------------------------------------------------------------------------
-- A migration 20260821080000 criou a régua: cada estado declarado em
-- qa_cliente_enderecos_anteriores vira um bloco de certidões no checklist.
-- Falta a porta de entrada mais importante — o formulário público, que é onde o
-- titular pediu que a pergunta ficasse:
--
--   "Deve haver uma pergunta no momento do cadastro se nos últimos 5 anos o
--    cliente morou no mesmo endereço que ele está declarando no comprovante.
--    Primeiro deve receber o comprovante e depois que receber, perguntar."
--
-- No formulário público o cliente ainda NÃO EXISTE como cliente: o que existe é
-- uma linha em qa_cadastro_publico. Por isso a declaração fica lá, em duas
-- colunas novas, e é copiada para o cadastro definitivo no momento em que a
-- ficha vira cliente — sem ninguém precisar lembrar de fazer isso.
--
-- Reexecutável. Puro acréscimo: nenhuma coluna, regra ou dado existente muda.
-- =============================================================================

BEGIN;

-- ─── 1) Onde a declaração fica enquanto não há cliente ───────────────────────
ALTER TABLE public.qa_cadastro_publico
  ADD COLUMN IF NOT EXISTS residiu_mesmo_endereco_5_anos boolean,
  ADD COLUMN IF NOT EXISTS enderecos_anteriores_json     jsonb;

COMMENT ON COLUMN public.qa_cadastro_publico.residiu_mesmo_endereco_5_anos IS
  'Resposta do formulário público: morou nos últimos 5 anos no mesmo endereço '
  'do comprovante? NULL = não respondeu.';
COMMENT ON COLUMN public.qa_cadastro_publico.enderecos_anteriores_json IS
  'Lista declarada no formulário público: [{"uf":"MG","cidade":"..."}]. Só o '
  'estado decide as certidões; a cidade é registro.';

-- ─── 2) A cópia, em um lugar só ──────────────────────────────────────────────
-- Chamada pelos dois gatilhos abaixo. Idempotente: reexecutar não duplica nada
-- (o índice único da tabela cuida disso) e nunca apaga endereço já declarado.
CREATE OR REPLACE FUNCTION public.qa_copia_residencia_5_anos_do_cadastro(
  p_cliente_id integer, p_cadastro_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cad   record;
  v_rows  integer := 0;
BEGIN
  IF p_cliente_id IS NULL OR p_cadastro_id IS NULL THEN RETURN 0; END IF;

  SELECT residiu_mesmo_endereco_5_anos, enderecos_anteriores_json
    INTO v_cad
    FROM public.qa_cadastro_publico
   WHERE id = p_cadastro_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- A resposta vai para o cadastro definitivo. Só escreve se mudar, para não
  -- religar o gatilho de qa_clientes à toa.
  IF v_cad.residiu_mesmo_endereco_5_anos IS NOT NULL THEN
    UPDATE public.qa_clientes
       SET residiu_mesmo_endereco_5_anos = v_cad.residiu_mesmo_endereco_5_anos,
           updated_at = now()
     WHERE id = p_cliente_id
       AND residiu_mesmo_endereco_5_anos IS DISTINCT FROM v_cad.residiu_mesmo_endereco_5_anos;
  END IF;

  -- Os estados declarados. UF que não existe é ignorada em silêncio: o
  -- formulário já valida, e um dado torto não pode travar a virada da ficha.
  IF jsonb_typeof(COALESCE(v_cad.enderecos_anteriores_json, 'null'::jsonb)) = 'array' THEN
    INSERT INTO public.qa_cliente_enderecos_anteriores
      (qa_cliente_id, uf, cidade, origem, observacao)
    SELECT p_cliente_id,
           c.uf,
           NULLIF(btrim(COALESCE(e ->> 'cidade','')), ''),
           'cliente',
           'Declarado pelo titular no formulário público.'
      FROM jsonb_array_elements(v_cad.enderecos_anteriores_json) AS e
      JOIN public.qa_uf_certidao c
        ON c.uf = public.qa_uf_normalizar(e ->> 'uf')
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  END IF;

  RETURN v_rows;
END;
$function$;

COMMENT ON FUNCTION public.qa_copia_residencia_5_anos_do_cadastro(integer, uuid) IS
  'Copia a declaração de residência dos últimos 5 anos do formulário público '
  'para o cadastro do cliente. Nunca apaga endereço já declarado; o gatilho de '
  'qa_cliente_enderecos_anteriores cuida de semear as certidões.';

REVOKE ALL ON FUNCTION public.qa_copia_residencia_5_anos_do_cadastro(integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_copia_residencia_5_anos_do_cadastro(integer, uuid)
  TO authenticated, service_role;

-- ─── 3) Quando a ficha vira cliente ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_trg_cliente_puxa_residencia_5_anos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.cadastro_publico_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.cadastro_publico_id IS NOT DISTINCT FROM NEW.cadastro_publico_id THEN
    RETURN NEW;
  END IF;
  PERFORM public.qa_copia_residencia_5_anos_do_cadastro(NEW.id, NEW.cadastro_publico_id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS qa_trg_cliente_puxa_residencia_5_anos ON public.qa_clientes;
CREATE TRIGGER qa_trg_cliente_puxa_residencia_5_anos
  AFTER INSERT OR UPDATE OF cadastro_publico_id
  ON public.qa_clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_trg_cliente_puxa_residencia_5_anos();

-- ─── 4) Quando o titular reenvia o formulário depois de já ser cliente ───────
CREATE OR REPLACE FUNCTION public.qa_trg_cadastro_publico_empurra_residencia_5_anos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  IF NEW.residiu_mesmo_endereco_5_anos IS NOT DISTINCT FROM OLD.residiu_mesmo_endereco_5_anos
     AND NEW.enderecos_anteriores_json IS NOT DISTINCT FROM OLD.enderecos_anteriores_json THEN
    RETURN NEW;
  END IF;
  FOR r IN SELECT id FROM public.qa_clientes WHERE cadastro_publico_id = NEW.id LOOP
    PERFORM public.qa_copia_residencia_5_anos_do_cadastro(r.id, NEW.id);
  END LOOP;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS qa_trg_cadastro_publico_empurra_residencia_5_anos ON public.qa_cadastro_publico;
CREATE TRIGGER qa_trg_cadastro_publico_empurra_residencia_5_anos
  AFTER UPDATE OF residiu_mesmo_endereco_5_anos, enderecos_anteriores_json
  ON public.qa_cadastro_publico
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_trg_cadastro_publico_empurra_residencia_5_anos();

COMMIT;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ TRANSAÇÃO 2 — fichas que já viraram cliente                               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Hoje ninguém respondeu a pergunta ainda, então isto não move nada. Fica aqui
-- porque a migration precisa ser reexecutável depois que houver resposta.
BEGIN;

DO $backfill$
DECLARE r record; v_total integer := 0;
BEGIN
  FOR r IN
    SELECT cl.id AS cliente_id, cl.cadastro_publico_id
      FROM public.qa_clientes cl
      JOIN public.qa_cadastro_publico cp ON cp.id = cl.cadastro_publico_id
     WHERE COALESCE(cl.status,'') <> 'excluido_lgpd'
       AND COALESCE(cl.excluido,false) = false
       AND (cp.residiu_mesmo_endereco_5_anos IS NOT NULL
            OR cp.enderecos_anteriores_json IS NOT NULL)
  LOOP
    v_total := v_total +
      COALESCE(public.qa_copia_residencia_5_anos_do_cadastro(r.cliente_id, r.cadastro_publico_id), 0);
  END LOOP;
  RAISE NOTICE 'Residencia 5 anos: % endereco(s) anterior(es) copiado(s) do cadastro publico.', v_total;
END
$backfill$;

COMMIT;

-- =============================================================================
-- CONFERÊNCIA (rodar depois, UMA DE CADA VEZ)
--
-- A) As colunas nasceram no formulário público. Esperado: 2 linhas.
--
-- SELECT column_name, data_type
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND table_name   = 'qa_cadastro_publico'
--    AND column_name IN ('residiu_mesmo_endereco_5_anos','enderecos_anteriores_json')
--  ORDER BY column_name;
--
-- B) Os dois gatilhos existem. Esperado: 2 linhas.
--
-- SELECT tgname FROM pg_trigger
--  WHERE tgname IN ('qa_trg_cliente_puxa_residencia_5_anos',
--                   'qa_trg_cadastro_publico_empurra_residencia_5_anos')
--  ORDER BY tgname;
--
-- C) Quem já respondeu, e o que foi declarado.
--
-- SELECT cp.nome_completo,
--        cp.residiu_mesmo_endereco_5_anos AS morou_sempre_no_mesmo,
--        cp.enderecos_anteriores_json     AS declarou
--   FROM public.qa_cadastro_publico cp
--  WHERE cp.residiu_mesmo_endereco_5_anos IS NOT NULL
--  ORDER BY cp.created_at DESC;
--
-- D) O que chegou ao cadastro definitivo.
--
-- SELECT cl.nome_completo, cl.estado AS estado_atual,
--        ea.uf AS estado_anterior, ea.cidade, ea.origem
--   FROM public.qa_cliente_enderecos_anteriores ea
--   JOIN public.qa_clientes cl ON cl.id = ea.qa_cliente_id
--  ORDER BY cl.nome_completo, ea.uf;
-- =============================================================================
