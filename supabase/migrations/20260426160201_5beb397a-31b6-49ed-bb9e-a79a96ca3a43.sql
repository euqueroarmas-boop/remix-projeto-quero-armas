
CREATE OR REPLACE FUNCTION public.qa_is_active_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.qa_usuarios_perfis WHERE user_id = _uid AND ativo = true)
$$;

CREATE OR REPLACE FUNCTION public.qa_has_qa_perfil(_uid uuid, _perfis text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.qa_usuarios_perfis WHERE user_id = _uid AND ativo = true AND perfil = ANY(_perfis))
$$;

CREATE OR REPLACE FUNCTION public.qa_current_cliente_id(_uid uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT qa_cliente_id FROM public.cliente_auth_links
  WHERE user_id = _uid AND qa_cliente_id IS NOT NULL
  ORDER BY activated_at DESC NULLS LAST, created_at DESC LIMIT 1
$$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname='public' AND tablename IN (
      'qa_clientes','qa_cadastro_cr','qa_crafs','qa_gtes','qa_filiacoes','qa_clubes',
      'qa_municoes','qa_vendas','qa_itens_venda','qa_casos','qa_documentos_conhecimento',
      'qa_geracoes_pecas','qa_logs_auditoria','qa_documentos_cliente'
    )
    AND (
      policyname ILIKE 'Anon %'
      OR policyname ILIKE 'anon\_%' ESCAPE '\'
      OR policyname ILIKE 'Auth full access%'
      OR policyname ILIKE 'Authenticated users can %'
      OR policyname = 'anon_full_qa_doc_cliente'
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- qa_clientes
ALTER TABLE public.qa_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_clientes_staff_select ON public.qa_clientes FOR SELECT TO authenticated USING (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_clientes_owner_select ON public.qa_clientes FOR SELECT TO authenticated USING (id = public.qa_current_cliente_id(auth.uid()));
CREATE POLICY qa_clientes_staff_insert ON public.qa_clientes FOR INSERT TO authenticated WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_clientes_staff_update ON public.qa_clientes FOR UPDATE TO authenticated USING (public.qa_is_active_staff(auth.uid())) WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_clientes_admin_delete ON public.qa_clientes FOR DELETE TO authenticated USING (public.qa_has_qa_perfil(auth.uid(), ARRAY['administrador']));

-- qa_cadastro_cr
ALTER TABLE public.qa_cadastro_cr ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_cadastro_cr_staff_select ON public.qa_cadastro_cr FOR SELECT TO authenticated USING (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_cadastro_cr_owner_select ON public.qa_cadastro_cr FOR SELECT TO authenticated USING (cliente_id = public.qa_current_cliente_id(auth.uid()));
CREATE POLICY qa_cadastro_cr_staff_insert ON public.qa_cadastro_cr FOR INSERT TO authenticated WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_cadastro_cr_staff_update ON public.qa_cadastro_cr FOR UPDATE TO authenticated USING (public.qa_is_active_staff(auth.uid())) WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_cadastro_cr_admin_delete ON public.qa_cadastro_cr FOR DELETE TO authenticated USING (public.qa_has_qa_perfil(auth.uid(), ARRAY['administrador']));

-- qa_crafs
ALTER TABLE public.qa_crafs ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_crafs_staff_select ON public.qa_crafs FOR SELECT TO authenticated USING (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_crafs_owner_select ON public.qa_crafs FOR SELECT TO authenticated USING (cliente_id = public.qa_current_cliente_id(auth.uid()));
CREATE POLICY qa_crafs_staff_insert ON public.qa_crafs FOR INSERT TO authenticated WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_crafs_staff_update ON public.qa_crafs FOR UPDATE TO authenticated USING (public.qa_is_active_staff(auth.uid())) WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_crafs_admin_delete ON public.qa_crafs FOR DELETE TO authenticated USING (public.qa_has_qa_perfil(auth.uid(), ARRAY['administrador']));

-- qa_gtes
ALTER TABLE public.qa_gtes ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_gtes_staff_select ON public.qa_gtes FOR SELECT TO authenticated USING (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_gtes_owner_select ON public.qa_gtes FOR SELECT TO authenticated USING (cliente_id = public.qa_current_cliente_id(auth.uid()));
CREATE POLICY qa_gtes_staff_insert ON public.qa_gtes FOR INSERT TO authenticated WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_gtes_staff_update ON public.qa_gtes FOR UPDATE TO authenticated USING (public.qa_is_active_staff(auth.uid())) WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_gtes_admin_delete ON public.qa_gtes FOR DELETE TO authenticated USING (public.qa_has_qa_perfil(auth.uid(), ARRAY['administrador']));

-- qa_filiacoes
ALTER TABLE public.qa_filiacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_filiacoes_staff_select ON public.qa_filiacoes FOR SELECT TO authenticated USING (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_filiacoes_owner_select ON public.qa_filiacoes FOR SELECT TO authenticated USING (cliente_id = public.qa_current_cliente_id(auth.uid()));
CREATE POLICY qa_filiacoes_staff_insert ON public.qa_filiacoes FOR INSERT TO authenticated WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_filiacoes_staff_update ON public.qa_filiacoes FOR UPDATE TO authenticated USING (public.qa_is_active_staff(auth.uid())) WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_filiacoes_admin_delete ON public.qa_filiacoes FOR DELETE TO authenticated USING (public.qa_has_qa_perfil(auth.uid(), ARRAY['administrador']));

-- qa_clubes (catálogo geral)
ALTER TABLE public.qa_clubes ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_clubes_auth_select ON public.qa_clubes FOR SELECT TO authenticated USING (true);
CREATE POLICY qa_clubes_staff_insert ON public.qa_clubes FOR INSERT TO authenticated WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_clubes_staff_update ON public.qa_clubes FOR UPDATE TO authenticated USING (public.qa_is_active_staff(auth.uid())) WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_clubes_admin_delete ON public.qa_clubes FOR DELETE TO authenticated USING (public.qa_has_qa_perfil(auth.uid(), ARRAY['administrador']));

-- qa_municoes (cliente_id direto)
ALTER TABLE public.qa_municoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_municoes_staff_select ON public.qa_municoes FOR SELECT TO authenticated USING (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_municoes_owner_select ON public.qa_municoes FOR SELECT TO authenticated USING (cliente_id = public.qa_current_cliente_id(auth.uid()));
CREATE POLICY qa_municoes_staff_insert ON public.qa_municoes FOR INSERT TO authenticated WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_municoes_staff_update ON public.qa_municoes FOR UPDATE TO authenticated USING (public.qa_is_active_staff(auth.uid())) WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_municoes_admin_delete ON public.qa_municoes FOR DELETE TO authenticated USING (public.qa_has_qa_perfil(auth.uid(), ARRAY['administrador']));

-- qa_vendas
ALTER TABLE public.qa_vendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_vendas_staff_select ON public.qa_vendas FOR SELECT TO authenticated USING (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_vendas_owner_select ON public.qa_vendas FOR SELECT TO authenticated USING (cliente_id = public.qa_current_cliente_id(auth.uid()));
CREATE POLICY qa_vendas_staff_insert ON public.qa_vendas FOR INSERT TO authenticated WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_vendas_staff_update ON public.qa_vendas FOR UPDATE TO authenticated USING (public.qa_is_active_staff(auth.uid())) WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_vendas_admin_delete ON public.qa_vendas FOR DELETE TO authenticated USING (public.qa_has_qa_perfil(auth.uid(), ARRAY['administrador']));

-- qa_itens_venda (via venda_id)
ALTER TABLE public.qa_itens_venda ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_itens_venda_staff_select ON public.qa_itens_venda FOR SELECT TO authenticated USING (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_itens_venda_owner_select ON public.qa_itens_venda FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.qa_vendas v WHERE v.id = qa_itens_venda.venda_id AND v.cliente_id = public.qa_current_cliente_id(auth.uid())));
CREATE POLICY qa_itens_venda_staff_insert ON public.qa_itens_venda FOR INSERT TO authenticated WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_itens_venda_staff_update ON public.qa_itens_venda FOR UPDATE TO authenticated USING (public.qa_is_active_staff(auth.uid())) WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_itens_venda_admin_delete ON public.qa_itens_venda FOR DELETE TO authenticated USING (public.qa_has_qa_perfil(auth.uid(), ARRAY['administrador']));

-- qa_casos + cliente_id FK + índice
ALTER TABLE public.qa_casos ADD COLUMN IF NOT EXISTS cliente_id bigint;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='qa_casos' AND constraint_name='qa_casos_cliente_id_fkey'
  ) THEN
    ALTER TABLE public.qa_casos
      ADD CONSTRAINT qa_casos_cliente_id_fkey
      FOREIGN KEY (cliente_id) REFERENCES public.qa_clientes(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_qa_casos_cliente_id ON public.qa_casos(cliente_id);

ALTER TABLE public.qa_casos ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_casos_staff_select ON public.qa_casos FOR SELECT TO authenticated USING (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_casos_staff_insert ON public.qa_casos FOR INSERT TO authenticated WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_casos_staff_update ON public.qa_casos FOR UPDATE TO authenticated USING (public.qa_is_active_staff(auth.uid())) WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_casos_admin_delete ON public.qa_casos FOR DELETE TO authenticated USING (public.qa_has_qa_perfil(auth.uid(), ARRAY['administrador']));
