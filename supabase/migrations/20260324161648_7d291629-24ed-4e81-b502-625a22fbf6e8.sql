insert into storage.buckets (id, name, public)
values ('paid-contracts', 'paid-contracts', false)
on conflict (id) do update set public = excluded.public;

create policy "Authenticated users can read own paid contracts"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'paid-contracts'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Service role can manage paid contracts"
on storage.objects
for all
to service_role
using (bucket_id = 'paid-contracts')
with check (bucket_id = 'paid-contracts');