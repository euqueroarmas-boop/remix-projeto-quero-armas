
create extension if not exists cube;
create extension if not exists earthdistance;

create table if not exists public.qa_iat_credenciados (
  id uuid primary key default gen_random_uuid(),
  uf text not null,
  nome text not null,
  telefone text,
  email text,
  endereco text,
  clube text,
  portaria text,
  validade text,
  lat double precision,
  lng double precision,
  fonte_url text,
  atualizado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (uf, nome, portaria)
);

grant select on public.qa_iat_credenciados to anon, authenticated;
grant all on public.qa_iat_credenciados to service_role;

alter table public.qa_iat_credenciados enable row level security;

create policy "iat publico leitura"
  on public.qa_iat_credenciados for select
  using (true);

create policy "iat service role escreve"
  on public.qa_iat_credenciados for all
  to service_role using (true) with check (true);

create index if not exists qa_iat_uf_idx on public.qa_iat_credenciados (uf);
create index if not exists qa_iat_geo_idx
  on public.qa_iat_credenciados
  using gist (ll_to_earth(lat, lng))
  where lat is not null and lng is not null;

create table if not exists public.qa_iat_credenciados_sync_log (
  id uuid primary key default gen_random_uuid(),
  uf text not null,
  total int,
  com_endereco boolean,
  status text not null,
  mensagem text,
  criado_em timestamptz not null default now()
);

grant select on public.qa_iat_credenciados_sync_log to authenticated;
grant all on public.qa_iat_credenciados_sync_log to service_role;

alter table public.qa_iat_credenciados_sync_log enable row level security;

create policy "iat log auth leitura"
  on public.qa_iat_credenciados_sync_log for select
  to authenticated using (true);

create policy "iat log service role"
  on public.qa_iat_credenciados_sync_log for all
  to service_role using (true) with check (true);

create or replace function public.qa_iat_credenciados_proximos(
  p_lat double precision,
  p_lng double precision,
  p_uf  text default null,
  p_raio_km double precision default 100,
  p_limit int default 50
)
returns table (
  id uuid, uf text, nome text, telefone text, email text,
  endereco text, clube text, portaria text, validade text,
  lat double precision, lng double precision, distancia_km double precision
)
language sql stable
security definer
set search_path = public
as $$
  select c.id, c.uf, c.nome, c.telefone, c.email, c.endereco, c.clube,
         c.portaria, c.validade, c.lat, c.lng,
         earth_distance(ll_to_earth(c.lat, c.lng), ll_to_earth(p_lat, p_lng)) / 1000.0 as distancia_km
  from public.qa_iat_credenciados c
  where c.lat is not null and c.lng is not null
    and (p_uf is null or c.uf = p_uf)
    and earth_distance(ll_to_earth(c.lat, c.lng), ll_to_earth(p_lat, p_lng)) <= p_raio_km * 1000
  order by distancia_km asc
  limit p_limit;
$$;

grant execute on function public.qa_iat_credenciados_proximos(double precision, double precision, text, double precision, int) to anon, authenticated, service_role;
