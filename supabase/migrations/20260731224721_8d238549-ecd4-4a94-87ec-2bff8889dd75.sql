create or replace function public.qa_cliente_ids_do_usuario(_uid uuid)
returns setof integer language sql stable security definer set search_path = public as $$
  select c.id from public.qa_clientes c where c.user_id = _uid
  union
  select l.qa_cliente_id from public.cliente_auth_links l
   where l.user_id = _uid and l.qa_cliente_id is not null
$$;

drop policy if exists "Anyone can read quotes" on public.quotes;
drop policy if exists "Authenticated can read quotes" on public.quotes;
revoke select, update, delete on public.quotes from anon;
revoke select, update, delete on public.quotes from authenticated;

drop policy if exists "Public read revenue_intelligence" on public.revenue_intelligence;
drop policy if exists "Public insert revenue_intelligence" on public.revenue_intelligence;
revoke all on public.revenue_intelligence from anon;
revoke insert, delete on public.revenue_intelligence from authenticated;
grant select on public.revenue_intelligence to authenticated;
create policy "Admins read revenue_intelligence" on public.revenue_intelligence
  for select to authenticated using (public.has_role(auth.uid(),'admin'::lp_app_role));

drop policy if exists "qa_storage_auth_read" on storage.objects;
drop policy if exists "qa_storage_auth_upload" on storage.objects;
drop policy if exists "Authenticated users can read qa-documentos" on storage.objects;
drop policy if exists "Authenticated users can update qa-documentos" on storage.objects;
drop policy if exists "Authenticated users can upload to qa-documentos" on storage.objects;
drop policy if exists "Authenticated can read cadastro selfies" on storage.objects;
drop policy if exists "Authenticated can delete cadastro selfies" on storage.objects;
drop policy if exists "qa_selfies_owner_read" on storage.objects;

create policy "qa_staff_all_buckets" on storage.objects for all to authenticated
  using (bucket_id in ('qa-documentos','qa-templates','qa-geracoes','qa-cadastro-selfies')
         and public.qa_is_active_staff(auth.uid()))
  with check (bucket_id in ('qa-documentos','qa-templates','qa-geracoes','qa-cadastro-selfies')
         and public.qa_is_active_staff(auth.uid()));

create policy "qa_cliente_read_own_docs" on storage.objects for select to authenticated
  using (
    bucket_id = 'qa-documentos' and (
      ((storage.foldername(name))[1] = 'cliente-docs' and (
         (storage.foldername(name))[2] in (select c.id::text from public.customers c where c.user_id = auth.uid())
         or (storage.foldername(name))[2] in (select 'qa-'||id::text from public.qa_cliente_ids_do_usuario(auth.uid()) id)
      ))
      or ((storage.foldername(name))[1] = 'clientes'
          and (storage.foldername(name))[2] in (select id::text from public.qa_cliente_ids_do_usuario(auth.uid()) id))
    )
  );

create policy "qa_cliente_upload_own_docs" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'qa-documentos' and (
      ((storage.foldername(name))[1] = 'cliente-docs' and (
         (storage.foldername(name))[2] in (select c.id::text from public.customers c where c.user_id = auth.uid())
         or (storage.foldername(name))[2] in (select 'qa-'||id::text from public.qa_cliente_ids_do_usuario(auth.uid()) id)
      ))
      or ((storage.foldername(name))[1] = 'clientes'
          and (storage.foldername(name))[2] in (select id::text from public.qa_cliente_ids_do_usuario(auth.uid()) id))
    )
  );

create policy "qa_templates_read_auth" on storage.objects for select to authenticated
  using (bucket_id in ('qa-templates','qa-geracoes'));

drop policy if exists "qa_hist_select_auth" on public.qa_cliente_historico_atualizacoes;
create policy "qa_hist_select_scoped" on public.qa_cliente_historico_atualizacoes
  for select to authenticated using (
    public.qa_is_active_staff(auth.uid())
    or cliente_id in (select id from public.qa_cliente_ids_do_usuario(auth.uid()) id)
  );

drop policy if exists "Authenticated read eventos" on public.qa_solicitacao_eventos;
create policy "qa_solic_eventos_select_scoped" on public.qa_solicitacao_eventos
  for select to authenticated using (
    public.qa_is_active_staff(auth.uid())
    or cliente_id in (select id from public.qa_cliente_ids_do_usuario(auth.uid()) id)
  );

alter table public.qa_cadastro_cr drop column if exists senha_gov;