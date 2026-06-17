-- Corrige a verificacao pre-contratacao apos a remocao da coluna qa_clientes.cliente_legado.
-- A contratacao logada deve depender apenas de cliente ativo/vinculado; a criacao
-- da venda continua sendo feita por qa_cliente_criar_contratacao.

CREATE OR REPLACE FUNCTION public.qa_verificar_cliente_pode_contratar(
  p_cliente_id integer,
  p_catalogo_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cli record;
BEGIN
  IF p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'cliente_id obrigatorio';
  END IF;

  SELECT
    id,
    homologacao_status,
    recadastramento_status,
    tipo_cliente,
    excluido,
    status
  INTO v_cli
  FROM public.qa_clientes
  WHERE id = p_cliente_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente nao encontrado.';
  END IF;

  IF COALESCE(v_cli.excluido, false) = true OR v_cli.status = 'excluido_lgpd' THEN
    RAISE EXCEPTION 'Cliente excluido.';
  END IF;

  RETURN jsonb_build_object(
    'pode_contratar', true,
    'motivo', 'ok',
    'requires_recadastramento', false,
    'cliente_legado', false,
    'homologacao_status', v_cli.homologacao_status,
    'recadastramento_status', v_cli.recadastramento_status,
    'cliente_id', p_cliente_id,
    'catalogo_slug', p_catalogo_slug
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.qa_verificar_cliente_pode_contratar(integer, text)
TO authenticated, service_role;
