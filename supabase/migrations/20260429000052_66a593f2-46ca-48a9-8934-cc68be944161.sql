CREATE OR REPLACE FUNCTION public.qa_load_staging_admin(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_batch  text := p_payload->>'batch';
  v_kind   text := p_payload->>'kind';
  v_reset  bool := COALESCE((p_payload->>'reset')::bool, false);
  v_rows   jsonb := COALESCE(p_payload->'rows', '[]'::jsonb);
  v_count  int := 0;
  v_row    jsonb;
BEGIN
  IF v_batch IS NULL OR v_kind IS NULL THEN
    RAISE EXCEPTION 'payload requires batch and kind';
  END IF;

  IF v_reset THEN
    EXECUTE format('DELETE FROM public.staging_access_%s WHERE import_batch = $1',
                   CASE v_kind WHEN 'senhas' THEN 'senhas_gov' ELSE v_kind END)
       USING v_batch;
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(v_rows) LOOP
    IF v_kind = 'clientes' THEN
      INSERT INTO public.staging_access_clientes
        (id_access, nome, cpf, email, telefone, observacoes, import_batch)
      VALUES (v_row->>'id', v_row->>'nome', v_row->>'cpf',
              v_row->>'email', v_row->>'tel', v_row->>'obs', v_batch);
    ELSIF v_kind = 'crs' THEN
      INSERT INTO public.staging_access_crs
        (id_access, cliente_id_access, numero_cr, validade, import_batch)
      VALUES (v_row->>'id', v_row->>'cli', v_row->>'cr', v_row->>'val', v_batch);
    ELSIF v_kind = 'senhas' THEN
      INSERT INTO public.staging_access_senhas_gov
        (id_access, cliente_id_access, cr_id_access, numero_cr, senha_plaintext, import_batch)
      VALUES (v_row->>'id', v_row->>'cli', v_row->>'crid',
              v_row->>'cr', v_row->>'p', v_batch);
    ELSIF v_kind = 'crafs' THEN
      INSERT INTO public.staging_access_crafs
        (id_access, cliente_id_access, numero_craf, arma, import_batch)
      VALUES (v_row->>'id', v_row->>'cli', v_row->>'craf', v_row->>'arma', v_batch);
    ELSE
      RAISE EXCEPTION 'unknown kind: %', v_kind;
    END IF;
    v_count := v_count + 1;
  END LOOP;

  IF v_kind IN ('clientes','senhas') THEN
    UPDATE public.staging_access_senhas_gov s
       SET cpf = c.cpf, email = c.email
      FROM public.staging_access_clientes c
     WHERE s.cliente_id_access = c.id_access
       AND s.import_batch = v_batch;
  END IF;

  RETURN jsonb_build_object('inserted', v_count, 'kind', v_kind, 'batch', v_batch);
END $$;

REVOKE ALL ON FUNCTION public.qa_load_staging_admin(jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.qa_load_staging_admin(jsonb) TO postgres, service_role;